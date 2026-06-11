import { PoolClient } from 'pg';
import { PaymentWebhookPayload } from './types';

export type ProcessResult = 'processed' | 'duplicate' | 'ignored';

export async function processPaymentWebhook(
  client: PoolClient,
  payload: PaymentWebhookPayload
): Promise<ProcessResult> {
  const insertEvent = await client.query(
    `
    INSERT INTO webhook_events (event_id, event_type, order_id, payload)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
    `,
    [payload.eventId, payload.eventType, payload.orderId, payload]
  );

  if (insertEvent.rowCount === 0) {
    return 'duplicate';
  }

  const nextStatus = mapEventToOrderStatus(payload.eventType);
  if (!nextStatus) {
    return 'ignored';
  }

  const updateOrder = await client.query(
    `
    UPDATE orders
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id
    `,
    [nextStatus, payload.orderId]
  );

  if (updateOrder.rowCount === 0) {
    throw new Error(`Order not found: ${payload.orderId}`);
  }

  return 'processed';
}

function mapEventToOrderStatus(eventType: string): 'paid' | 'failed' | null {
  switch (eventType) {
    case 'payment.success':
      return 'paid';
    case 'payment.failed':
      return 'failed';
    default:
      return null;
  }
}
