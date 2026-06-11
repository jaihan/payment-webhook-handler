import express from 'express';
import { z } from 'zod';
import { withTransaction } from './db';
import { processPaymentWebhook } from './webhookService';

const webhookSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  orderId: z.string().uuid(),
  amount: z.number().optional(),
  currency: z.string().optional(),
});

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/webhooks/payment', async (req, res) => {
    const providedSecret = req.header('x-webhook-secret');

    if (!process.env.WEBHOOK_SECRET) {
      return res.status(500).json({ message: 'Webhook secret is not configured' });
    }

    if (providedSecret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid webhook payload', errors: parsed.error.flatten() });
    }

    try {
      const result = await withTransaction((client) => processPaymentWebhook(client, parsed.data));
      return res.status(200).json({ message: 'Webhook accepted', result });
    } catch (error) {
      console.error('Webhook processing failed', error);
      return res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  return app;
}
