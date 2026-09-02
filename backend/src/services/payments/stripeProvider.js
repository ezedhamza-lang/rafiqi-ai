import crypto from 'crypto';
import { config } from '../../config.js';
import { ApiError } from '../../middleware/errorHandler.js';

function isConfigured() {
  return Boolean(config.payment.stripeSecretKey && config.payment.stripeWebhookSecret);
}

export const stripeProvider = {
  name: 'STRIPE',
  label: 'Stripe (وضع اختبار Sandbox)',
  mode: 'sandbox',

  info() {
    return {
      name: this.name,
      label: this.label,
      configured: isConfigured(),
      mode: this.mode,
      description: 'بوابة Stripe الرسمية في وضع الاختبار — يتطلب STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET'
    };
  },

  async createCheckout({ intent, subscription }) {
    if (!config.payment.stripeSecretKey) {
      throw new ApiError(503, 'مزود Stripe غير مضبوط — ضع STRIPE_SECRET_KEY في .env أو استعمل المزود التجريبي DEMO');
    }
    const baseUrl = config.payment.publicBaseUrl || '';
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('line_items[0][price_data][currency]', (intent.currency || 'TND').toLowerCase());
    params.set('line_items[0][price_data][product_data][name]', `اشتراك ${subscription.plan || 'المنصة'}`);
    params.set('line_items[0][price_data][unit_amount]', String(Math.round(intent.amount * 100)));
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', `${baseUrl}/api/payments/confirm/success?intent=${intent.id}`);
    params.set('cancel_url', `${baseUrl}/api/payments/confirm/cancel?intent=${intent.id}`);
    params.set('client_reference_id', String(intent.id));
    params.set('metadata[intentId]', String(intent.id));
    params.set('metadata[subscriptionId]', String(intent.subscriptionId));

    let res;
    try {
      res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.payment.stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString(),
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      throw new ApiError(502, 'تعذر الاتصال ببوابة Stripe، حاول لاحقا');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(502, `فشل إنشاء جلسة دفع لدى Stripe: ${data.error?.message || 'خطأ غير معروف'}`);
    }
    return { checkoutUrl: data.url, providerReference: data.id };
  },

  verifyWebhook(req) {
    const signature = req.headers['stripe-signature'];
    if (!signature || !config.payment.stripeWebhookSecret) return false;
    try {
      const parts = signature
        .split(',')
        .map((s) => s.trim())
        .map((s) => {
          const idx = s.indexOf('=');
          return [s.slice(0, idx), s.slice(idx + 1)];
        });
      const ts = parts.find(([k]) => k === 't')?.[1];
      const sig = parts.find(([k]) => k === 'v1')?.[1];
      if (!ts || !sig) return false;
      const payload = typeof req.body === 'string' ? req.body : req.body.toString('utf8');
      const signed = `${ts}.${payload}`;
      const expected = crypto.createHmac('sha256', config.payment.stripeWebhookSecret).update(signed).digest('hex');
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(sig, 'hex');
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
      'checkout.session.async_payment_failed': 'FAILED',
      'payment_intent.payment_failed': 'FAILED',
      'checkout.session.canceled': 'CANCELED',
      'checkout.session.expired': 'EXPIRED'
    };
    const type = mapping[body.type] || 'FAILED';
    const object = body.data?.object || {};
    return {
      provider: 'STRIPE',
      type,
      providerReference: object.id || object.payment_intent || null,
      metadata: object.metadata || null,
      raw: body
    };
  }
};
