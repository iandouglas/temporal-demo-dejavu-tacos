<?php

declare(strict_types=1);

namespace Dejavu;

use Temporal\Activity;
use Temporal\Activity\ActivityInterface;

#[ActivityInterface(prefix: 'OrderActivities.')]
class OrderActivities
{
    private const DEFAULT_MAX_ATTEMPTS = 3;
    private const SUBMIT_MAX_ATTEMPTS = 10;

    public function __construct(private readonly BackendClient $backend) {}

    public function validateOrder(array $order): array
    {
        $step = 'validate_order';
        $this->backend->emitEvent($order['order_id'], $step, 'running');
        usleep(200_000);
        if ($this->backend->shouldFail($step, $order['order_id'])) {
            $this->failAttempt($order, $step, 'Order validation failed');
        }

        $total = array_sum(array_map(
            static fn (array $item) => $item['price'] * $item['quantity'],
            $order['items'],
        ));
        $count = count($order['items']);
        $this->backend->emitEvent(
            $order['order_id'],
            $step,
            'completed',
            detail: sprintf('Validated %d items, total $%.2f', $count, $total),
        );
        return ['valid' => true, 'item_count' => $count, 'total' => $total];
    }

    public function validateStore(array $order): array
    {
        $step = 'validate_store';
        $this->backend->emitEvent($order['order_id'], $step, 'running');
        usleep(300_000);
        if ($this->backend->shouldFail($step, $order['order_id'])) {
            $this->failAttempt($order, $step, 'Unable to reach store');
        }

        $this->backend->emitEvent(
            $order['order_id'],
            $step,
            'completed',
            detail: 'Déjà Vu Tacos #42 is open, ~12 min wait',
        );
        return ['store_id' => 'store-001', 'name' => 'Déjà Vu Tacos #42', 'estimated_wait_minutes' => 12];
    }

    public function authorizePayment(array $order): array
    {
        $step = 'authorize_payment';
        $this->backend->emitEvent($order['order_id'], $step, 'running');
        usleep(500_000);
        if ($this->backend->shouldFail($step, $order['order_id'])) {
            $this->failAttempt($order, $step, 'Payment gateway timeout');
        }

        $authorizationId = 'auth_' . ((int) (microtime(true) * 1000) % 100_000_000);
        $this->backend->emitEvent(
            $order['order_id'],
            $step,
            'completed',
            detail: sprintf('Hold placed: $%.2f (auth: %s)', $order['total'], $authorizationId),
        );
        return ['authorization_id' => $authorizationId, 'amount' => $order['total'], 'status' => 'authorized'];
    }

    public function clearCart(array $order): array
    {
        $step = 'clear_cart';
        $this->backend->emitEvent($order['order_id'], $step, 'running');
        usleep(100_000);
        $this->backend->emitEvent($order['order_id'], $step, 'completed', detail: 'Cart cleared');
        return ['cleared' => true];
    }

    public function submitToStore(array $order): array
    {
        $step = 'submit_to_store';
        $attempt = Activity::getInfo()->attempt;
        $this->backend->emitEvent(
            $order['order_id'],
            $step,
            'running',
            attempt: $attempt,
            maxAttempts: self::SUBMIT_MAX_ATTEMPTS,
        );
        usleep(500_000);
        if ($this->backend->shouldFail($step, $order['order_id'])) {
            $this->failAttempt(
                $order,
                $step,
                'Store connectivity lost — Bob accidentally unplugged the ethernet',
                self::SUBMIT_MAX_ATTEMPTS,
            );
        }

        $this->backend->registerStoreOrder($order['order_id'], [
            'order_id' => $order['order_id'],
            'items' => $order['items'],
            'total' => $order['total'],
            'status' => 'preparing',
            'created_at' => date(DATE_ATOM),
        ]);
        $this->backend->emitEvent(
            $order['order_id'],
            $step,
            'completed',
            attempt: $attempt,
            maxAttempts: self::SUBMIT_MAX_ATTEMPTS,
            detail: 'Store accepted, ready in ~12 min',
        );
        return ['accepted' => true, 'estimated_ready_minutes' => 12];
    }

    public function capturePayment(array $order): array
    {
        $step = 'capture_payment';
        $this->backend->emitEvent($order['order_id'], $step, 'running');
        usleep(300_000);
        $this->backend->emitEvent(
            $order['order_id'],
            $step,
            'completed',
            detail: sprintf('Payment captured: $%.2f', $order['total']),
        );
        return [
            'authorization_id' => $order['authorization_id'],
            'amount' => $order['total'],
            'status' => 'captured',
        ];
    }

    /**
     * Compensation. The Workflow registers it before the hold is placed, so it
     * has to cope with a hold that doesn't exist.
     */
    public function releasePaymentHold(array $order): array
    {
        $authorizationId = $order['authorization_id'] ?? '';
        if ($authorizationId === '') {
            return ['status' => 'no_hold'];
        }

        $step = 'release_payment_hold';
        $this->backend->emitEvent($order['order_id'], $step, 'running');
        usleep(300_000);
        $this->backend->emitEvent(
            $order['order_id'],
            $step,
            'completed',
            detail: sprintf('Payment hold released: $%.2f (compensation)', $order['total']),
        );
        return ['authorization_id' => $authorizationId, 'status' => 'released'];
    }

    public function notifyCustomer(array $order): array
    {
        usleep(200_000);
        $success = $order['success'] ?? true;
        if ($success) {
            $this->backend->emitEvent(
                $order['order_id'],
                'notify_customer_success',
                'completed',
                detail: 'Customer notified: Your order is ready for pickup!',
            );
        } else {
            $this->backend->emitEvent(
                $order['order_id'],
                'notify_customer_failure',
                'completed',
                detail: "Customer notified: Sorry, we couldn't process your order. "
                    . 'Your payment hold has been released.',
            );
        }
        return ['notified' => true, 'success' => $success];
    }

    /** Show the attempt in the UI, then throw so Temporal retries the Activity. */
    private function failAttempt(
        array $order,
        string $step,
        string $message,
        int $maxAttempts = self::DEFAULT_MAX_ATTEMPTS,
    ): never {
        $this->backend->emitEvent(
            $order['order_id'],
            $step,
            'retrying',
            attempt: Activity::getInfo()->attempt,
            maxAttempts: $maxAttempts,
            error: $message,
        );
        throw new \RuntimeException($message);
    }
}
