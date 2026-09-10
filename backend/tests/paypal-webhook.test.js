import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { paypalProvider } from '../src/services/payments/paypalProvider.js';

let app;

describe('بوابة توقيع PayPal (fail-closed)', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
  });

  it('يرفض حدثاً بلا إعداد PayPal كامل — لا يُفعَّل شيء بمجرد وجود الترويسات', async () => {
    const ok = await paypalProvider.verifyWebhook({
      headers: {
        'paypal-transmission-id': 'fake',
        'paypal-transmission-time': String(Math.floor(Date.now() / 1000)),
        'paypal-cert-url': 'https://api.paypal.com/v1/security/auth-certificate',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      body: Buffer.from(JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED' }))
    });
    expect(ok).toBe(false);
  });

  it('يرفض POST /webhook/PAYPAL المزيف بـ400 عبر المسار الكامل', async () => {
    const res = await request(app)
      .post('/api/payments/webhook/PAYPAL')
      .set('Content-Type', 'application/json')
      .set('paypal-transmission-id', 'fake')
      .set('paypal-transmission-time', String(Math.floor(Date.now() / 1000)))
      .set('paypal-cert-url', 'https://evil.example.com/cert')
      .set('paypal-auth-algo', 'SHA256withRSA')
      .send({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-FAKE' } });
    expect(res.status).toBe(400);
  });
});
