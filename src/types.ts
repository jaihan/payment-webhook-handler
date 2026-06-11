export type PaymentEventType = 'payment.success' | 'payment.failed';

export type PaymentWebhookPayload = {
  eventId: string;
  eventType: PaymentEventType | string;
  orderId: string;
  amount?: number;
  currency?: string;
};
