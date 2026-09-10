/**
 * PayPal Payment Provider - Batch 5
 * 
 * Supports international markets (USD, EUR, GBP).
 * Uses PayPal REST API v2 for checkout creation and webhook verification.
 */

import { config } from '../../config.js';
import { ApiError } from '../../middleware/errorHandler.js';

function isConfigured() {
  return Boolean(config.payment?.paypalClientId && config.payment?.paypalSecret);
}

function apiBase() {
  return config.payment?.paypalMode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Supported currencies by PayPal
 */
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY'];

export const paypalProvider = {
  name: 'PAYPAL',
  label: 'PayPal (الدولي)',
  mode: config.payment?.paypalMode || 'sandbox',

  info() {
    return {
      name: this.name,
      label: this.label,
      configured: isConfigured(),
      mode: this.mode,
      currencies: SUPPORTED_CURRENCIES,
      description: 'بوابة PayPal الدولية — تدعم العملات الرئيسية (USD, EUR, GBP) للأسواق غير التونسية'
    };
  },

  async createCheckout({ intent, subscription }) {
    if (!isConfigured()) {
      throw new ApiError(503, 'مزود PayPal غير مضبوط — ضع PAYPAL_CLIENT_ID + PAYPAL_SECRET في .env');
    }

    const currency = (intent.currency || 'USD').toUpperCase();
    
    // Validate currency
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new ApiError(400, `العملة ${currency} غير مدعومة من PayPal — المتاح: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }

    const baseUrl = config.payment.publicBaseUrl || '';
    
    try {
      // Get access token
      const token = await this._getAccessToken();
      
      // Create order
      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: String(intent.id),
          description: `اشتراك ${subscription.plan || 'المنصة'} - Rafiqi`,
          amount: {
            currency_code: currency,
            value: intent.amount.toFixed(2)
          },
          custom_id: String(intent.id),
          invoice_id: `INV-${intent.id}-${Date.now()}`
        }],
        application_context: {
          brand_name: 'Rafiqi Platform',
          locale: 'en-US',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${baseUrl}/api/payments/paypal/return?intent=${intent.id}`,
          cancel_url: `${baseUrl}/api/payments/paypal/cancel?intent=${intent.id}`
        }
      };

      const orderRes = await fetch(`${apiBase()}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData),
        signal: AbortSignal.timeout(15000)
      });

      const order = await orderRes.json().catch(() => ({}));
      
      if (!orderRes.ok) {
        throw new ApiError(502, `فشل إنشاء طلب PayPal: ${order.message || 'خطأ غير معروف'}`);
      }

      // Return approval URL for redirect
      const approvalUrl = order.links?.find(link => link.rel === 'approve')?.href;
      
      if (!approvalUrl) {
        throw new ApiError(502, 'لم يتم استلام رابط دفع من PayPal');
      }

      return {
        checkoutUrl: approvalUrl,
        providerReference: order.id
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, `تعذر الاتصال بـ PayPal: ${error.message}`);
    }
  },

  async _getAccessToken() {
    const clientId = config.payment.paypalClientId;
    const secret = config.payment.paypalSecret;
    
    const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
    
    const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10000)
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok || !data.access_token) {
      throw new Error('فشل الحصول على access token من PayPal');
    }
    
    return data.access_token;
  },

  /**
   * تحقق حقيقي من توقيع أحداث PayPal عبر نقطة /v1/notifications/verify-webhook-signature
   * (المعتمدة رسمياً: تربط cert_url + auth_algo + transmission-id + timestamp + جسم
   * الحدث + webhookId). فشل-مغلق: أي خطأ شبكة/إعداد/توقيع ⇒ رفض. لا يُقبل أي حدث
   * بدون PAYPAL_WEBHOOK_ID مضبوط.
   */
  async verifyWebhook(req) {
    if (!isConfigured()) return false;
    if (!config.payment.paypalWebhookId) {
      console.error('PAYPAL_WEBHOOK_ID غير مضبوط — رفض حدث PayPal (لا يمكن التحقق من التوقيع)');
      return false;
    }
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo) return false;
    // صدقة للدفاع: شهادة PayPal فقط من نطاق paypal.com
    try {
      const cu = new URL(certUrl);
      if (!/(^|\.)paypal\.com$/i.test(cu.hostname) || cu.protocol !== 'https:') return false;
    } catch {
      return false;
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '{}');
    try {
      const token = await this._getAccessToken();
      const res = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          webhook_id: config.payment.paypalWebhookId,
          webhook_event: JSON.parse(rawBody)
        }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.verification_status === 'SUCCESS';
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

    const eventType = body.event_type || '';
    
    // Map PayPal events to our status
    const eventMapping = {
      'PAYMENT.CAPTURE.COMPLETED': 'SUCCEEDED',
      'PAYMENT.CAPTURE.DENIED': 'FAILED',
      'PAYMENT.CAPTURE.PENDING': 'PENDING',
      'PAYMENT.CAPTURE.REFUNDED': 'REFUNDED',
      'PAYMENT.CAPTURE.PARTIALLY_REFUNDED': 'PARTIALLY_REFUNDED',
      'CHECKOUT.ORDER.APPROVED': 'PENDING',
      'CHECKOUT.ORDER.COMPLETED': 'SUCCEEDED'
    };

    const status = eventMapping[eventType] || 'FAILED';
    const resource = body.resource || {};

    return {
      provider: 'PAYPAL',
      type: status,
      providerReference: resource.id || null,
      metadata: {
        orderId: resource.supplementary_data?.related_ids?.order_id,
        captureId: resource.id,
        customId: resource.custom_id
      },
      raw: body
    };
  },

  /**
   * Capture an approved order (called from return URL handler)
   */
  async captureOrder(orderId) {
    if (!isConfigured()) {
      throw new ApiError(503, 'PayPal not configured');
    }

    const token = await this._getAccessToken();
    
    const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      throw new ApiError(502, `Failed to capture PayPal order: ${data.message}`);
    }

    return data;
  }
};
