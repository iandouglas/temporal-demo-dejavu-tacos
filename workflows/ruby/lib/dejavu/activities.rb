# frozen_string_literal: true

require 'temporalio/activity'

module Dejavu
  module Activities
    DEFAULT_MAX_ATTEMPTS = 3
    SUBMIT_MAX_ATTEMPTS = 10

    def self.all(backend)
      [ValidateOrder, ValidateStore, AuthorizePayment, ClearCart, SubmitToStore,
       CapturePayment, ReleasePaymentHold, NotifyCustomer].map { |activity| activity.new(backend) }
    end

    # Shared wiring for the order Activities.
    class Base < Temporalio::Activity::Definition
      def initialize(backend)
        super()
        @backend = backend
      end

      private

      def attempt
        Temporalio::Activity::Context.current.info.attempt
      end

      # Show the attempt in the UI, then raise so Temporal retries the Activity.
      def fail_attempt(order, step, message, max_attempts: DEFAULT_MAX_ATTEMPTS)
        @backend.emit_event(order['order_id'], step, 'retrying', attempt:, max_attempts:, error: message)
        raise message
      end
    end

    class ValidateOrder < Base
      def execute(order)
        step = 'validate_order'
        @backend.emit_event(order['order_id'], step, 'running')
        sleep 0.2
        fail_attempt(order, step, 'Order validation failed') if @backend.should_fail?(step, order['order_id'])

        items = order['items']
        total = items.sum { |item| item['price'] * item['quantity'] }
        @backend.emit_event(order['order_id'], step, 'completed',
                            detail: format('Validated %<count>d items, total $%<total>.2f',
                                           count: items.length, total:))
        { 'valid' => true, 'item_count' => items.length, 'total' => total }
      end
    end

    class ValidateStore < Base
      def execute(order)
        step = 'validate_store'
        @backend.emit_event(order['order_id'], step, 'running')
        sleep 0.3
        fail_attempt(order, step, 'Unable to reach store') if @backend.should_fail?(step, order['order_id'])

        @backend.emit_event(order['order_id'], step, 'completed',
                            detail: 'Déjà Vu Tacos #42 is open, ~12 min wait')
        { 'store_id' => 'store-001', 'name' => 'Déjà Vu Tacos #42', 'estimated_wait_minutes' => 12 }
      end
    end

    class AuthorizePayment < Base
      def execute(order)
        step = 'authorize_payment'
        @backend.emit_event(order['order_id'], step, 'running')
        sleep 0.5
        fail_attempt(order, step, 'Payment gateway timeout') if @backend.should_fail?(step, order['order_id'])

        authorization_id = "auth_#{(Time.now.to_f * 1000).to_i % 100_000_000}"
        @backend.emit_event(order['order_id'], step, 'completed',
                            detail: format('Hold placed: $%<total>.2f (auth: %<auth>s)',
                                           total: order['total'], auth: authorization_id))
        { 'authorization_id' => authorization_id, 'amount' => order['total'], 'status' => 'authorized' }
      end
    end

    class ClearCart < Base
      def execute(order)
        step = 'clear_cart'
        @backend.emit_event(order['order_id'], step, 'running')
        sleep 0.1
        @backend.emit_event(order['order_id'], step, 'completed', detail: 'Cart cleared')
        { 'cleared' => true }
      end
    end

    class SubmitToStore < Base
      def execute(order)
        step = 'submit_to_store'
        @backend.emit_event(order['order_id'], step, 'running', attempt:, max_attempts: SUBMIT_MAX_ATTEMPTS)
        sleep 0.5
        if @backend.should_fail?(step, order['order_id'])
          fail_attempt(order, step, 'Store connectivity lost — Bob accidentally unplugged the ethernet',
                       max_attempts: SUBMIT_MAX_ATTEMPTS)
        end

        @backend.register_store_order(order['order_id'], {
                                        order_id: order['order_id'], items: order['items'], total: order['total'],
                                        status: 'preparing', created_at: Time.now.iso8601
                                      })
        @backend.emit_event(order['order_id'], step, 'completed', attempt:, max_attempts: SUBMIT_MAX_ATTEMPTS,
                                                                  detail: 'Store accepted, ready in ~12 min')
        { 'accepted' => true, 'estimated_ready_minutes' => 12 }
      end
    end

    class CapturePayment < Base
      def execute(order)
        step = 'capture_payment'
        @backend.emit_event(order['order_id'], step, 'running')
        sleep 0.3
        @backend.emit_event(order['order_id'], step, 'completed',
                            detail: format('Payment captured: $%.2f', order['total']))
        { 'authorization_id' => order['authorization_id'], 'amount' => order['total'], 'status' => 'captured' }
      end
    end

    # Compensation. The Workflow registers it before the hold is placed, so it
    # has to cope with a hold that doesn't exist.
    class ReleasePaymentHold < Base
      def execute(order)
        authorization_id = order['authorization_id']
        return { 'status' => 'no_hold' } if authorization_id.nil? || authorization_id.empty?

        step = 'release_payment_hold'
        @backend.emit_event(order['order_id'], step, 'running')
        sleep 0.3
        @backend.emit_event(order['order_id'], step, 'completed',
                            detail: format('Payment hold released: $%.2f (compensation)', order['total']))
        { 'authorization_id' => authorization_id, 'status' => 'released' }
      end
    end

    class NotifyCustomer < Base
      def execute(order)
        sleep 0.2
        success = order.fetch('success', true)
        if success
          @backend.emit_event(order['order_id'], 'notify_customer_success', 'completed',
                              detail: 'Customer notified: Your order is ready for pickup!')
        else
          @backend.emit_event(order['order_id'], 'notify_customer_failure', 'completed',
                              detail: "Customer notified: Sorry, we couldn't process your order. " \
                                      'Your payment hold has been released.')
        end
        { 'notified' => true, 'success' => success }
      end
    end
  end
end
