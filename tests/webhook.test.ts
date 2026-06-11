import request from 'supertest';
import { createApp } from '../src/app';
import { withTransaction } from '../src/db';

jest.mock('../src/db', () => ({
  withTransaction: jest.fn(),
}));

jest.mock('../src/webhookService', () => ({
  processPaymentWebhook: jest.fn(async () => 'processed'),
}));

describe('POST /webhooks/payment', () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET = 'test-secret';
    (withTransaction as jest.Mock).mockImplementation(async (handler) => handler({}));
  });

  it('rejects invalid webhook secret', async () => {
    const app = createApp();
    const response = await request(app).post('/webhooks/payment').set('x-webhook-secret', 'wrong').send({});
    expect(response.status).toBe(401);
  });

  it('rejects invalid payload', async () => {
    const app = createApp();
    const response = await request(app).post('/webhooks/payment').set('x-webhook-secret', 'test-secret').send({ eventType: 'payment.success' });
    expect(response.status).toBe(400);
  });

  it('accepts valid payment success webhook', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/webhooks/payment')
      .set('x-webhook-secret', 'test-secret')
      .send({ eventId: 'evt_001', eventType: 'payment.success', orderId: '11111111-1111-1111-1111-111111111111' });
    expect(response.status).toBe(200);
    expect(response.body.result).toBe('processed');
  });
});
