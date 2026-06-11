# Assumptions

1. The payment provider sends a shared secret using the `x-webhook-secret` header.

2. Each webhook payload contains a unique `eventId`.

3. Duplicate webhook deliveries are expected and should not update an order more than once.

4. Order statuses are limited to:

- paid
- failed

5. Unknown event types are ignored and return HTTP 200.

6. PostgreSQL is the source of truth for order status and webhook processing history.

7. The goal of this exercise is correctness and reliability rather than production-scale throughput.

8. Authentication, authorization, monitoring, and alerting are outside the scope of this assessment.
