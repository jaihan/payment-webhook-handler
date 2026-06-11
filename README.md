# TrueVibe Payment Webhook Handler

A small TypeScript + Express service that handles payment provider webhooks safely.

## Features

- Verifies provider requests using `x-webhook-secret`
- Handles `payment.success` and `payment.failed`
- Updates PostgreSQL `orders.status`
- Handles duplicate webhooks with database-level idempotency
- Uses a transaction so webhook event storage and order updates stay consistent
- Includes unit tests and a local Docker PostgreSQL setup

## Setup

This project does not require the local `psql` command or `tsx`. Migrations run through plain Node.js using the `pg` package.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
```


## Node Compatibility Note

The migration script uses plain JavaScript:

```bash
npm run db:migrate
```

So it does not depend on the PostgreSQL CLI (`psql`) or `tsx`.

## Test

```bash
npm test
```

## Example Request

```bash
curl -X POST http://localhost:3000/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: super-secret-key" \
  -d '{
    "eventId": "evt_001",
    "eventType": "payment.success",
    "orderId": "11111111-1111-1111-1111-111111111111"
  }'
```

## Supported Events

| Event Type | Order Status |
|---|---|
| `payment.success` | `paid` |
| `payment.failed` | `failed` |

## Idempotency Design

Payment providers may send the same webhook more than once. This service stores each provider event in `webhook_events`, where `event_id` is the primary key.

```sql
INSERT INTO webhook_events (event_id, event_type, order_id, payload)
VALUES (...)
ON CONFLICT (event_id) DO NOTHING
```

If the insert does nothing, the event is a duplicate and the endpoint returns HTTP 200 safely.

## Assumptions

- The payment provider sends a shared secret in the `x-webhook-secret` header.
- The webhook payload contains a unique `eventId`.
- Duplicate webhook events should return HTTP 200 to prevent unnecessary retries.
- Unknown event types are stored but ignored safely.
- If an order does not exist, the service returns HTTP 500 so the provider can retry after the issue is fixed.
- In a real payment provider integration, HMAC signature verification would be stronger than a plain shared-secret header.
# payment-webhook-handler
