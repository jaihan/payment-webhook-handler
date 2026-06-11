# Payment Webhook Handler

## Overview

This project implements a payment webhook endpoint using TypeScript, Express, and PostgreSQL.

Features:

- Shared secret verification (`x-webhook-secret`)
- Handles `payment.success`
- Handles `payment.failed`
- Idempotent webhook processing
- PostgreSQL persistence
- Docker-based local development environment

---

## Prerequisites

- Node.js 18+
- Docker Desktop
- npm

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env` from `.env.example`

```env
PORT=3000

DATABASE_URL=postgres://postgres:postgres@localhost:5432/truevibe

WEBHOOK_SECRET=my-secret-key
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Run database migration

```bash
npm run db:migrate
```

### 5. Start application

```bash
npm run dev
```

Application:

```text
http://localhost:3000
```

---

## Supported Events

- payment.success
- payment.failed

---

## Idempotency

Duplicate webhook deliveries are detected using a unique `event_id`.

Previously processed events return HTTP 200 without re-processing the order.

---

## Database Editor

Adminer is included for local database inspection.

```text
http://localhost:8080
```

Credentials:

```text
System: PostgreSQL
Server: postgres
Username: postgres
Password: postgres
Database: truevibe
```

## API Documentation

### Endpoint

```http
POST /webhooks/payment
```

### Headers

| Header           | Required | Description                                     |
| ---------------- | -------- | ----------------------------------------------- |
| Content-Type     | Yes      | Must be `application/json`                      |
| x-webhook-secret | Yes      | Shared secret used to verify the webhook sender |

Example:

```http
Content-Type: application/json
x-webhook-secret: my-secret-key
```

---

## Request Payload

### Required Fields

| Field     | Type   | Description                                           |
| --------- | ------ | ----------------------------------------------------- |
| eventId   | string | Unique identifier for the webhook event               |
| eventType | string | Supported values: `payment.success`, `payment.failed` |
| orderId   | UUID   | Existing order identifier                             |

### payment.success

```json
{
  "eventId": "evt_1001",
  "eventType": "payment.success",
  "orderId": "11111111-1111-1111-1111-111111111111"
}
```

### payment.failed

```json
{
  "eventId": "evt_1002",
  "eventType": "payment.failed",
  "orderId": "22222222-2222-2222-2222-222222222222"
}
```

### Optional Provider Fields

Additional fields are accepted and stored in the `payload` column of the `webhook_events` table.

Example:

```json
{
  "eventId": "evt_1003",
  "eventType": "payment.success",
  "orderId": "55555555-5555-5555-5555-555555555555",
  "amount": 799.0,
  "currency": "SGD",
  "provider": "stripe",
  "timestamp": "2026-06-11T10:00:00Z"
}
```

---

## Example: Successful Payment

### Request

```bash
curl --location 'http://localhost:3000/webhooks/payment' \
--header 'Content-Type: application/json' \
--header 'x-webhook-secret: my-secret-key' \
--data '{
  "eventId": "evt_1001",
  "eventType": "payment.success",
  "orderId": "11111111-1111-1111-1111-111111111111"
}'
```

### Database Before

```sql
SELECT id, status
FROM orders
WHERE id = '11111111-1111-1111-1111-111111111111';
```

Result:

| id                                   | status  |
| ------------------------------------ | ------- |
| 11111111-1111-1111-1111-111111111111 | pending |

### Database After

```sql
SELECT id, status
FROM orders
WHERE id = '11111111-1111-1111-1111-111111111111';
```

Result:

| id                                   | status |
| ------------------------------------ | ------ |
| 11111111-1111-1111-1111-111111111111 | paid   |

### Response

```json
{
  "message": "Webhook processed successfully"
}
```

Status:

```http
200 OK
```

---

## Example: Failed Payment

### Request

```bash
curl --location 'http://localhost:3000/webhooks/payment' \
--header 'Content-Type: application/json' \
--header 'x-webhook-secret: my-secret-key' \
--data '{
  "eventId": "evt_1002",
  "eventType": "payment.failed",
  "orderId": "22222222-2222-2222-2222-222222222222"
}'
```

### Database After

| id                                   | status |
| ------------------------------------ | ------ |
| 22222222-2222-2222-2222-222222222222 | failed |

### Response

```json
{
  "message": "Webhook processed successfully"
}
```

Status:

```http
200 OK
```

---

## Example: Duplicate Webhook

The payment provider may retry delivery of the same event.

### Request

```json
{
  "eventId": "evt_1001",
  "eventType": "payment.success",
  "orderId": "11111111-1111-1111-1111-111111111111"
}
```

Since `evt_1001` already exists in the `webhook_events` table, the event is ignored.

### Response

```json
{
  "message": "Webhook already processed"
}
```

Status:

```http
200 OK
```

---

## Example: Invalid Secret

### Response

```json
{
  "message": "Invalid webhook secret"
}
```

Status:

```http
401 Unauthorized
```

---

## Example: Invalid Payload

### Request

```json
{
  "eventType": "payment.success"
}
```

Missing required fields:

- eventId
- orderId

### Response

```json
{
  "message": "Invalid webhook payload"
}
```

Status:

```http
400 Bad Request
```

---

## Idempotency Flow

```text
Webhook Received
       │
       ▼
Verify Secret
       │
       ▼
Begin Transaction
       │
       ▼
Insert event_id into webhook_events
       │
       ├── Exists?
       │      │
       │      └── Yes → Commit → Return 200
       │
       ▼
Update orders.status
       │
       ▼
Commit Transaction
       │
       ▼
Return 200
```
