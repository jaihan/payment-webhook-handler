# Pull Request: Payment Webhook Handler

## What I Built

Implemented a payment webhook endpoint using TypeScript, Express, and PostgreSQL.

The endpoint:

- Verifies webhook authenticity using the `x-webhook-secret` header.
- Processes `payment.success` and `payment.failed` events.
- Updates the corresponding order status in PostgreSQL.
- Handles duplicate webhook deliveries safely using an idempotency mechanism based on a unique `event_id`.
- Returns HTTP 200 for successfully processed or previously processed events to prevent unnecessary provider retries.

### Key Design Decisions

**Idempotency**

Payment providers often retry webhook deliveries. To prevent duplicate processing, I introduced a `webhook_events` table with a unique constraint on `event_id`.

The webhook event is recorded and the order update is performed within a database transaction. If the same event is received again, it is detected and safely ignored.

**Database Transaction**

Recording the webhook event and updating the order status are executed within a single transaction to avoid partial updates.

**Fail-Safe Response Handling**

Known and already-processed events return HTTP 200. Invalid requests return appropriate 4xx responses, while unexpected failures return 500 so the provider can retry.

**Containerized Development Environment**

Docker Compose was included for PostgreSQL and a browser-based database administration tool to simplify local setup and inspection.

---

## What I Would Add With More Time

### Stronger Signature Verification

Most payment providers use HMAC signatures rather than a simple shared secret header. I would implement provider-style request signing and payload verification.

### Automated Tests

Add:

- Unit tests for webhook business logic
- Integration tests covering database interactions
- Duplicate webhook scenarios
- Invalid signature scenarios

### Structured Logging

Introduce structured logs with correlation IDs to improve observability and troubleshooting.

### Metrics and Monitoring

Add metrics such as:

- Webhook processing latency
- Success/failure counts
- Duplicate event counts
- Retry rates

### Background Processing

For higher traffic volumes, webhook ingestion could acknowledge immediately and publish events to a queue for asynchronous processing.

---

## Questions Before Production Deployment

1. Which payment providers are we integrating with?
2. Are order status transitions restricted?
   - For example, should a paid order ever transition back to failed?
3. What retry behavior does the provider use?
   - Frequency, duration, and maximum retry attempts.
4. What volume of webhook traffic should we expect?
   - This affects whether synchronous processing is sufficient.

5. What audit and compliance requirements exist?
   - Should raw webhook payloads be stored for reconciliation and investigations?

6. Do we need alerting for failed webhook processing?
   - Production systems typically require monitoring and operational visibility.

---

Overall, I prioritized correctness, idempotency, and simplicity while keeping the implementation easy to understand and extend.
