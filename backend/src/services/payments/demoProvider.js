import crypto from 'crypto';
import { config } from '../../config.js';

function isConfigured() {
  return Boolean(config.payment.demoWebhookSecret);
}

export const demoProvider = {
  name: 'DEMO',
  label: 'المزود التجريبي (محاكاة داخل المنصة)',
  mode: 'sandbox',

  info() {
    return {
      name: this.name,
      label: this.label,
      configured: isConfigured(),
      mode: this.mode,
      description: 'دفع تجريبي يُحاكى بالكامل داخل المنصة دون أي بوابة خارجية — مناسب للاختبار والمعاينة'
    };
  },

  async createCheckout({ intent }) {
    return {
      checkoutUrl: `/api/payments/demo-checkout/${intent.id}`,
      providerReference: `DEMO-${intent.id}-${Date.now().toString(36)}`
    };
  },

  verifyWebhook(req) {
    const secret = config.payment.demoWebhookSecret;
    if (!secret) return false;
    const signature = req.headers['x-demo-signature'];
    if (!signature) return false;
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(String(signature).replace(/^sha256=/, ''), 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  parseWebhook(req) {
    let body = req.body || {};
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf8'));
      } catch {
        body = {};
      }
    }
    const mapping = {
      'checkout.session.completed': 'SUCCEEDED',
      'payment_intent.succeeded': 'SUCCEEDED',
      'checkout.session.failed': 'FAILED',
      'payment_intent.payment_failed': 'FAILED',
      'checkout.session.canceled': 'CANCELED',
      'checkout.session.expired': 'EXPIRED'
    };
    let type = body.type;
    if (!['SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED'].includes(type)) {
      type = mapping[type] || 'FAILED';
    }
    return {
      provider: 'DEMO',
      type,
      providerReference: body.providerReference || body.id || null,
      metadata: body.metadata || null,
      raw: body
    };
  }
};
