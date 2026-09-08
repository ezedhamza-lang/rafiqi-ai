import crypto from 'crypto';
import { config } from '../../config.js';
import { ApiError } from '../../middleware/errorHandler.js';

function isConfigured() {
  return Boolean(config.payment.stbMerchantId && config.payment.stbSecret);
}

export const stbProvider = {
  name: 'STB',
  label: 'البنك التونسي (STB — وضع اختبار)',
  mode: 'sandbox',

  info() {
    return {
      name: this.name,
      label: this.label,
      configured: isConfigured(),
      mode: this.mode,
      description: 'بوابة الدفع للبنك التونسي STB — تتطلب STB_MERCHANT_ID + STB_SECRET'
    };
  },

  async createCheckout({ intent, subscription }) {
    if (!isConfigured()) {
      throw new ApiError(503, 'بوابة STB غير مضبوطة — ضع STB_MERCHANT_ID و STB_SECRET في .env أو استعمل المزود التجريبي DEMO');
    }
    const baseUrl = config.payment.publicBaseUrl || '';
    const payload = {
      merchantId: config.payment.stbMerchantId,
      amount: Number(intent.amount),
      currency: intent.currency || 'TND',
      reference: `INT-${intent.id}`,
      description: `اشتراك ${subscription.plan || 'المنصة'}`,
      successUrl: `${baseUrl}/api/payments/confirm/success?intent=${intent.id}`,
      cancelUrl: `${baseUrl}/api/payments/confirm/cancel?intent=${intent.id}`,
      intentId: intent.id,
      subscriptionId: intent.subscriptionId
    };
    let res;
    try {
      res = await fetch('https://gateway.stb.com.tn/sandbox/v1/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.payment.stbSecret}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      throw new ApiError(502, 'تعذر الاتصال ببوابة STB، حاول لاحقا');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(502, `فشل إنشاء جلسة دفع لدى STB: ${data.message || 'خطأ غير معروف'}`);
    }
    return { checkoutUrl: data.checkoutUrl || data.url, providerReference: data.reference || data.transactionId || null };
  },

  verifyWebhook(req) {
    const secret = config.payment.stbSecret;
    if (!secret) return false;
    const signature = req.headers['x-stb-signature'];
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
    const status = String(body.status || body.result || '').toUpperCase();
    let type = 'FAILED';
    if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID'].includes(status)) type = 'SUCCEEDED';
    if (['CANCELED', 'CANCELLED'].includes(status)) type = 'CANCELED';
    return {
      provider: 'STB',
      type,
      providerReference: body.reference || body.transactionId || null,
      metadata: { intentId: body.intentId, subscriptionId: body.subscriptionId },
      raw: body
    };
  }
};
