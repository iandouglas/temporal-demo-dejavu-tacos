<?php

declare(strict_types=1);

namespace Dejavu;

use Temporal\Activity\ActivityOptions;
use Temporal\Common\RetryOptions;
use Temporal\Exception\Failure\TemporalFailure;
use Temporal\Workflow;
use Temporal\Workflow\QueryMethod;
use Temporal\Workflow\Saga;
use Temporal\Workflow\SignalMethod;
use Temporal\Workflow\WorkflowInterface;
use Temporal\Workflow\WorkflowMethod;

/**
 * Order processing with saga compensation: validation, payment hold, store
 * submission, pickup Signal, capture. If a step fails for good, the Workflow
 * releases the payment hold.
 */
#[WorkflowInterface]
class OrderWorkflow
{
    private const KITCHEN_WAIT_TIMEOUT_SECONDS = 3600;

    private bool $orderReady = false;
    private string $status = 'pending';

    #[SignalMethod(name: 'order_ready')]
    public function orderReady(): void
    {
        $this->orderReady = true;
    }

    #[QueryMethod(name: 'get_status')]
    public function getStatus(): string
    {
        return $this->status;
    }

    #[WorkflowMethod(name: 'OrderWorkflow')]
    public function run(array $order)
    {
        $acts = fn (int $seconds) => $this->activities($seconds, RetryOptions::new()->withMaximumAttempts(3));

        // The demo's failure point. The generous policy leaves the presenter
        // time to show retries, then plug the store back in.
        $submitActs = $this->activities(
            10,
            RetryOptions::new()
                ->withInitialInterval('2 seconds')
                ->withBackoffCoefficient(1.5)
                ->withMaximumInterval('8 seconds')
                ->withMaximumAttempts(10),
        );

        $retryFive = RetryOptions::new()->withMaximumAttempts(5);

        // Keep compensating if one undo fails, so one failure can't strand the rest.
        $saga = (new Saga())->setContinueWithError(true);
        $authorizationId = '';

        try {
            $this->status = 'validating_order';
            yield $acts(10)->validateOrder($order);

            $this->status = 'validating_store';
            yield $acts(10)->validateStore($order);

            // Register the compensation before the hold: the Activity can
            // succeed and still lose its response, leaving a hold the Workflow
            // never heard about.
            $this->status = 'authorizing_payment';
            $saga->addCompensation(function () use ($order, &$authorizationId, $retryFive) {
                $releaseActs = $this->activities(10, $retryFive);
                yield $releaseActs->releasePaymentHold([...$order, 'authorization_id' => $authorizationId]);
            });
            $payment = yield $acts(15)->authorizePayment($order);
            $authorizationId = $payment['authorization_id'];

            $this->status = 'clearing_cart';
            yield $acts(5)->clearCart($order);

            $this->status = 'submitting_to_store';
            yield $submitActs->submitToStore($order);

            // Human in the loop: the kitchen sends the order_ready Signal. With no
            // word from the kitchen, the order completes anyway when the wait times out.
            $this->status = 'preparing';
            yield Workflow::awaitWithTimeout(self::KITCHEN_WAIT_TIMEOUT_SECONDS, fn () => $this->orderReady);

            $this->status = 'capturing_payment';
            yield $acts(15)->capturePayment([...$order, 'authorization_id' => $authorizationId]);

            $this->status = 'completed';
            yield $this->activities(10)->notifyCustomer([...$order, 'success' => true]);

            return ['success' => true, 'order_id' => $order['order_id']];
        } catch (TemporalFailure $e) {
            $this->status = 'compensating';
            // compensate() runs in a detached scope, so a cancelled order still
            // gets its hold released.
            yield $saga->compensate();

            $this->status = 'failed';
            yield Workflow::asyncDetached(function () use ($order) {
                yield $this->activities(10)->notifyCustomer([...$order, 'success' => false]);
            });

            $cause = $e->getPrevious();
            $error = $cause instanceof TemporalFailure ? $cause->getOriginalMessage() : $e->getMessage();
            return ['success' => false, 'error' => $error, 'order_id' => $order['order_id']];
        }
    }

    /** @return OrderActivities A proxy that schedules each call as an Activity. */
    private function activities(int $startToCloseSeconds, ?RetryOptions $retry = null): object
    {
        return Workflow::newActivityStub(
            OrderActivities::class,
            ActivityOptions::new()
                ->withStartToCloseTimeout("{$startToCloseSeconds} seconds")
                ->withRetryOptions($retry),
        );
    }
}
