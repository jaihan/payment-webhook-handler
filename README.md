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

## Example Request

```bash
curl -X POST http://localhost:3000/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: super-secret-key" \
  -d '{
    "eventId":"evt_123",
    "eventType":"payment.success",
    "orderId":"order_001"
  }'
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

### payment.success

```json
{
  "eventId": "evt_001",
  "eventType": "payment.success",
  "orderId": "order_123",
  "amount": 99.99,
  "currency": "USD",
  "timestamp": "2026-06-11T10:00:00Z"
}
```

### payment.failed

```json
{
  "eventId": "evt_002",
  "eventType": "payment.failed",
  "orderId": "order_123",
  "amount": 99.99,
  "currency": "USD",
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
  "eventId": "evt_001",
  "eventType": "payment.success",
  "orderId": "order_123",
  "amount": 99.99,
  "currency": "USD",
  "timestamp": "2026-06-11T10:00:00Z"
}'
```

### Database Before

```sql
SELECT * FROM orders WHERE id = 'order_123';
```

Result:

| id        | status  |
| --------- | ------- |
| order_123 | pending |

### Database After

```sql
SELECT * FROM orders WHERE id = 'order_123';
```

Result:

| id        | status |
| --------- | ------ |
| order_123 | paid   |

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
  "eventId": "evt_002",
  "eventType": "payment.failed",
  "orderId": "order_123",
  "amount": 99.99,
  "currency": "USD",
  "timestamp": "2026-06-11T10:00:00Z"
}'
```

### Database After

| id        | status |
| --------- | ------ |
| order_123 | failed |

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

The provider may retry the same event multiple times.

### Request

```json
{
  "eventId": "evt_001",
  "eventType": "payment.success",
  "orderId": "order_123"
}
```

Since `evt_001` has already been processed, the event is ignored.

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

### Request

```http
x-webhook-secret: wrong-secret
```

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

Missing:

- eventId
- orderId

### Response

```json
{
  "message": "Invalid payload"
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
Insert eventId into webhook_events
       │
       ├── Exists?
       │      │
       │      └── Yes → Return 200
       │
       ▼
Update Order Status
       │
       ▼
Commit Transaction
       │
       ▼
Return 200
```
