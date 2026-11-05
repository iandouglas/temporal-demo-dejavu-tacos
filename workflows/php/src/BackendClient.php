<?php

declare(strict_types=1);

namespace Dejavu;

use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Talks to the FastAPI backend's internal API for failure state, SSE events and
 * store order registration.
 */
final class BackendClient
{
    private readonly HttpClientInterface $http;

    public function __construct(private readonly string $baseUrl)
    {
        $this->http = HttpClient::create(['timeout' => 5]);
    }

    /**
     * Sending the order ID lets the backend answer for the browser session that
     * placed the order, so one presenter's outage doesn't hit another.
     */
    public function shouldFail(string $step, string $orderId): bool
    {
        try {
            $response = $this->http->request('GET', "{$this->baseUrl}/api/internal/should-fail/{$step}", [
                'query' => ['order_id' => $orderId],
            ]);
            return (bool) ($response->toArray()['should_fail'] ?? false);
        } catch (\Throwable) {
            return false;
        }
    }

    /** Best effort: a missed UI update shouldn't fail the Activity. */
    public function emitEvent(
        string $orderId,
        string $step,
        string $status,
        int $attempt = 1,
        int $maxAttempts = 1,
        ?string $error = null,
        string $detail = '',
    ): void {
        $this->post('/api/internal/events', [
            'order_id' => $orderId,
            'step' => $step,
            'status' => $status,
            'attempt' => $attempt,
            'max_attempts' => $maxAttempts,
            'error' => $error,
            'detail' => $detail,
            'timestamp' => date(DATE_ATOM),
            'mode' => 'temporal',
        ]);
    }

    /** Best effort, like emitEvent: the Kitchen Display is a view of the order. */
    public function registerStoreOrder(string $orderId, array $order): void
    {
        $this->post("/api/internal/store-orders/{$orderId}", $order);
    }

    private function post(string $path, array $body): void
    {
        try {
            $this->http->request('POST', $this->baseUrl . $path, ['json' => $body])->getStatusCode();
        } catch (\Throwable) {
            // Best effort, see callers.
        }
    }
}
