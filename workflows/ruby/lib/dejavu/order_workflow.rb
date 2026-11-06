# frozen_string_literal: true

require 'temporalio/cancellation'
require 'temporalio/error'
require 'temporalio/retry_policy'
require 'temporalio/workflow'

require_relative 'activities'

module Dejavu
  # Order processing with saga compensation: validation, payment hold, store
  # submission, pickup Signal, capture. If a step fails for good, the Workflow
  # releases the payment hold.
  class OrderWorkflow < Temporalio::Workflow::Definition
    workflow_name 'OrderWorkflow'

    Workflow = Temporalio::Workflow
    RetryPolicy = Temporalio::RetryPolicy

    DEFAULT_RETRY = RetryPolicy.new(max_attempts: 3)
    KITCHEN_WAIT_TIMEOUT = 3600

    def initialize
      @order_ready = false
      @status = 'pending'
    end

    workflow_signal
    def order_ready
      @order_ready = true
    end

    workflow_query name: 'get_status'
    def status
      @status
    end

    def execute(order)
      # Compensation stack, holding the input each release will run with.
      compensations = []

      begin
        @status = 'validating_order'
        Workflow.execute_activity(Activities::ValidateOrder, order,
                                  start_to_close_timeout: 10, retry_policy: DEFAULT_RETRY)

        @status = 'validating_store'
        Workflow.execute_activity(Activities::ValidateStore, order,
                                  start_to_close_timeout: 10, retry_policy: DEFAULT_RETRY)

        # Register the compensation before the hold: the Activity can succeed
        # and still lose its response, leaving a hold the Workflow never heard
        # about.
        @status = 'authorizing_payment'
        compensations << order
        payment = Workflow.execute_activity(Activities::AuthorizePayment, order,
                                            start_to_close_timeout: 15, retry_policy: DEFAULT_RETRY)
        authorization_id = payment['authorization_id']
        compensations[-1] = order.merge('authorization_id' => authorization_id)

        @status = 'clearing_cart'
        Workflow.execute_activity(Activities::ClearCart, order,
                                  start_to_close_timeout: 5, retry_policy: DEFAULT_RETRY)

        # The demo's failure point. The generous policy leaves the presenter
        # time to show retries, then plug the store back in.
        @status = 'submitting_to_store'
        Workflow.execute_activity(
          Activities::SubmitToStore, order,
          start_to_close_timeout: 10,
          retry_policy: RetryPolicy.new(
            initial_interval: 2, backoff_coefficient: 1.5, max_interval: 8, max_attempts: 10
          )
        )

        # Human in the loop: the kitchen sends the order_ready Signal.
        @status = 'preparing'
        begin
          Workflow.timeout(KITCHEN_WAIT_TIMEOUT) { Workflow.wait_condition { @order_ready } }
        rescue Timeout::Error
          # No word from the kitchen: complete the order anyway so the
          # Workflow doesn't stay open.
          Workflow.logger.info("Order #{order['order_id']} auto-completed")
        end

        @status = 'capturing_payment'
        Workflow.execute_activity(Activities::CapturePayment,
                                  order.merge('authorization_id' => authorization_id),
                                  start_to_close_timeout: 15, retry_policy: DEFAULT_RETRY)

        @status = 'completed'
        Workflow.execute_activity(Activities::NotifyCustomer, order.merge('success' => true),
                                  start_to_close_timeout: 10)

        { 'success' => true, 'order_id' => order['order_id'] }
      rescue Temporalio::Error::Failure => e
        Workflow.logger.error("Order #{order['order_id']} failed: #{e.message}")
        @status = 'compensating'

        # A new Cancellation detaches these Activities from Workflow
        # cancellation, so a cancelled order still gets its hold released.
        detached = Temporalio::Cancellation.new
        compensations.reverse_each do |input|
          Workflow.execute_activity(Activities::ReleasePaymentHold, input,
                                    start_to_close_timeout: 10, cancellation: detached,
                                    retry_policy: RetryPolicy.new(max_attempts: 5))
        rescue Temporalio::Error::Failure => compensation_error
          Workflow.logger.error("Compensation failed: #{compensation_error.message}")
        end

        @status = 'failed'
        Workflow.execute_activity(Activities::NotifyCustomer, order.merge('success' => false),
                                  start_to_close_timeout: 10, cancellation: detached)

        { 'success' => false, 'error' => e.message, 'order_id' => order['order_id'] }
      end
    end
  end
end
