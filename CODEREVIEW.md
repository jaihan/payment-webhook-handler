# Section A

## Four Problems Identified

### 1. Signature Verification Uses `JSON.stringify(req.body)`

#### Risk

The payment provider typically generates the HMAC signature from the **raw request body**.

The code recalculates the signature using:

```ts
JSON.stringify(req.body);
```

After Express parses JSON, field ordering, whitespace, or formatting may differ from the original payload.

This can cause legitimate webhook requests to fail signature verification.

#### Fix

Verify the signature against the **raw request body** before parsing.

---

### 2. Unsafe String Comparison

#### Risk

The code compares signatures using:

```ts
if (signature !== expected)
```

This comparison is vulnerable to timing attacks because it may reveal information about the expected signature based on response timing.

#### Fix

Use:

```ts
crypto.timingSafeEqual();
```

to perform constant-time comparison.

---

### 3. SQL Injection Vulnerability

#### Risk

The query is built using string interpolation:

```ts
await db.query(
  `UPDATE orders SET status = '${status}' WHERE id = '${orderId}'`,
);
```

An attacker could inject malicious SQL through either `status` or `orderId`.

Example:

```json
{
  "orderId": "123'; DROP TABLE orders; --"
}
```

#### Fix

Use parameterized queries:

```ts
await db.query(`UPDATE orders SET status = $1 WHERE id = $2`, [
  status,
  orderId,
]);
```

---

### 4. Returning HTTP 200 on Processing Failure

#### Risk

The catch block returns:

```ts
res.status(200).json({ received: true });
```

even when database operations fail.

This tells the payment provider the webhook was successfully processed, causing retries to stop.

Result:

- Payment provider believes processing succeeded.
- Order status remains incorrect.
- System state becomes inconsistent.

#### Fix

Return an appropriate error code such as:

```ts
res.status(500).json({
  error: "Webhook processing failed",
});
```

so the provider retries the webhook.

---

# Corrected Implementation

```ts
import express from "express";
import crypto from "crypto";
import { db } from "./db";

const router = express.Router();

function verifySignature(rawBody: Buffer, signature?: string) {
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret || !signature) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-signature"] as string | undefined;

    if (!verifySignature(req.body, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    let payload: any;

    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { eventId, event, orderId } = payload;

    if (!eventId || !event || !orderId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const nextStatus =
      event === "payment.success"
        ? "paid"
        : event === "payment.failed"
          ? "failed"
          : null;

    if (!nextStatus) {
      return res.status(400).json({ error: "Unsupported event type" });
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const inserted = await client.query(
        `
        INSERT INTO webhook_events (event_id, event_type, order_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
        `,
        [eventId, event, orderId],
      );

      if (inserted.rowCount === 0) {
        await client.query("COMMIT");
        return res.status(200).json({ received: true, duplicate: true });
      }

      await client.query(
        `
        UPDATE orders
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        `,
        [nextStatus, orderId],
      );

      await client.query("COMMIT");

      return res.status(200).json({ received: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      return res.status(500).json({ error: "Webhook processing failed" });
    } finally {
      client.release();
    }
  },
);

export default router;
```

---

# Section B — Stretch Challenge

## 1. Plain-English Explanation

### Policy

```sql
CREATE POLICY "users can read own orders"
ON orders
FOR SELECT
USING (user_id = auth.uid());
```

### What It Does

This policy allows authenticated users to read only the rows in the `orders` table where:

```sql
orders.user_id = auth.uid()
```

In plain English:

> A user can only view orders that belong to their own account.

For example:

| User   | Order Owner | Can Read? |
| ------ | ----------- | --------- |
| User A | User A      | ✅ Yes    |
| User A | User B      | ❌ No     |
| User B | User B      | ✅ Yes    |

---

## 2. Investigation Approach

Given the report:

> Users can still read other users' orders.

I would investigate the following areas.

### A. Is RLS Enabled?

A policy has no effect if RLS is disabled.

Verify:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
```

---

### B. Is the Application Using a Service Role?

Supabase service-role credentials bypass RLS.

Check:

- Backend services
- API routes
- Scheduled jobs
- Server-side functions

to ensure they are not unintentionally exposing data.

---

### C. Are There Other Policies?

Another policy may grant broader access.

Inspect:

```sql
SELECT *
FROM pg_policies
WHERE tablename = 'orders';
```

---

### D. Is `user_id` Correctly Populated?

Check for:

- Null values
- Incorrect mappings
- Shared IDs
- Data migration issues

---

### E. Is `auth.uid()` Returning the Expected Value?

Verify:

- JWT configuration
- Authentication provider
- User session context

to ensure `auth.uid()` matches the actual logged-in user.

---

## 3. Policy Excluding Draft Orders

### Requirement

Users should:

- Read only their own orders
- Not read orders with status `draft`

### Policy

```sql
CREATE POLICY "users can read own non-draft orders"
ON orders
FOR SELECT
USING (
  user_id = auth.uid()
  AND status <> 'draft'
);
```

### Plain English

A user can only view:

1. Orders they own.
2. Orders that are not in draft status.

Examples:

| Owner        | Status | Visible? |
| ------------ | ------ | -------- |
| Current User | paid   | ✅ Yes   |
| Current User | failed | ✅ Yes   |
| Current User | draft  | ❌ No    |
| Another User | paid   | ❌ No    |

---

# Summary

### Security Issues Found

1. Signature verification uses parsed JSON instead of raw body.
2. Signature comparison vulnerable to timing attacks.
3. SQL injection through string interpolation.
4. Incorrect success response when processing fails.

### Additional Improvement

The original implementation also lacks webhook idempotency. In production, payment providers may retry events, so a unique `event_id` table should be used to safely detect and ignore duplicate webhook deliveries.

### RLS Findings

The policy restricts reads to a user's own orders. If data leakage occurs, I would first verify:

1. RLS is enabled.
2. Service-role credentials are not bypassing RLS.
3. No additional permissive policies exist.
4. `user_id` values are correct.
5. `auth.uid()` resolves to the expected user.
