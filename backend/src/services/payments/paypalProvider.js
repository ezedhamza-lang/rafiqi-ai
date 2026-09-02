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

// إصلاح (27-08-2026): الرابط كان مكتوباً بصفة صلبة على sandbox في كل
// مكان (createCheckout و _getAccessToken و captureOrder)، فحتى لو ضبط
// المستخدم paypalMode=live كان كل شيء يذهب لبيئة sandbox. الآن الرابط
// يُشتق من الوضع الفعلي.
function apiBase() {
  return (config.payment?.paypalMode || 'sandbox') === 'live'
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

  // إصلاح أمني (27-08-2026): كان التحقق يكتفي بفحص "وجود" رؤوس (headers)
  // الطلب دون التحقق من صحتها، وهذا يعني أن أي طرف قادر على تزوير هذه
  // الرؤوس (transmission-id, timestamp...) وتفعيل اشتراك مجاني — نفس فئة
  // ثغرة "تزوير Webhook" التي أُصلحت سابقاً في stb/demo لكن نُسيت هنا.
  // الحل الصحيح مع PayPal هو استدعاء نقطة verify-webhook-signature
  // الرسمية بدل أي تحقق محلي (PayPal لا توفر HMAC بسيط للتحقق محليًا).
  async verifyWebhook(req) {
    const webhookId = config.payment?.paypalWebhookId;
    if (!webhookId) {
      // بلا PAYPAL_WEBHOOK_ID لا يمكن التحقق بأمان — نرفض بدل قبول أعمى.
      return false;
    }

    const transmissionId = req.headers['paypal-transmission-id'];
    const timestamp = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];

    if (!transmissionId || !timestamp || !certUrl || !authAlgo || !transmissionSig) {
      return false;
    }

    let rawBody = req.body;
    if (Buffer.isBuffer(rawBody)) rawBody = rawBody.toString('utf8');
    let webhookEvent;
    try {
      webhookEvent = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch {
      return false;
    }

    try {
      const token = await this._getAccessToken();
      const res = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transmission_id: transmissionId,
          transmission_time: timestamp,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: webhookEvent
        }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.verification_status === 'SUCCESS';
    } catch {
      // أي فشل اتصال أو خطأ = رفض، وليس قبولاً بصمت.
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
