/**
 * Tap Payment Provider - Batch 5
 * 
 * Supports Saudi Arabia (SAR) and Gulf markets.
 * Uses Tap Payments API v2 for checkout and webhook handling.
 */

import crypto from 'crypto';
import { config } from '../../config.js';
import { ApiError } from '../../middleware/errorHandler.js';

function isConfigured() {
  return Boolean(config.payment?.tapSecretKey && config.payment?.tapPublicKey);
}

/**
 * Supported currencies by Tap
 */
const SUPPORTED_CURRENCIES = ['SAR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'USD', 'EUR', 'EGP'];

/** Tap payment modes */
const TAP_MODES = {
  TEST: 'test',
  LIVE: 'live'
};

export const tapProvider = {
  name: 'TAP',
  label: 'Tap (السوق السعودي/الخليجي)',
  mode: config.payment?.tapMode || TAP_MODES.TEST,

  info() {
    return {
      name: this.name,
      label: this.label,
      configured: isConfigured(),
      mode: this.mode,
      currencies: SUPPORTED_CURRENCIES,
      description: 'بوابة Tap السعودية — تدعم الريال السعودي وعملات الخليج مع Apple Pay و STC Pay'
    };
  },

  async createCheckout({ intent, subscription, source = {}}) {
    if (!isConfigured()) {
      throw new ApiError(503, 'مزود Tap غير مضبوط — ضع TAP_SECRET_KEY + TAP_PUBLIC_KEY في .env');
    }

    const currency = (intent.currency || 'SAR').toUpperCase();
    
    // Validate currency
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new ApiError(400, `العملة ${currency} غير مدعومة من Tap — المتاح: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }

    const baseUrl = this._getBaseUrl();
    
    try {
      // Create charge/invoice
      const chargeData = {
        amount: intent.amount,
        currency: currency,
        customer: {
          first_name: intent.userFirstName || 'User',
          last_name: intent.userLastName || '',
          email: intent.userEmail || '',
          phone: {
            country_code: intent.userPhoneCode || '966',
            number: intent.userPhone || ''
          }
        },
        source: source.id ? source : { id: 'src_all' }, // Default to all payment methods
        redirect: {
          url: `${config.payment.publicBaseUrl || ''}/api/payments/tap/callback?intent=${intent.id}`
        },
        post: {
          url: `${config.payment.publicBaseUrl || ''}/api/payments/tap/webhook`
        },
        metadata: {
          intentId: String(intent.id),
          subscriptionId: String(intent.subscriptionId || ''),
          provider: 'TAP'
        },
        description: `اشتراك ${subscription.plan || 'المنصة'} - Rafiqi Platform`,
        reference: {
          transaction: `txn-${intent.id}-${Date.now()}`,
          order: `order-${intent.id}`
        }
      };

      // Use invoice for hosted page, charge for direct
      const useInvoice = config.payment?.tapUseInvoice !== false;
      
      const endpoint = useInvoice ? '/invoices' : '/charges';
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.payment.tapSecretKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(chargeData),
        signal: AbortSignal.timeout(20000)
      });

      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        const errorMsg = data.errors?.[0]?.message || data.message || data.code || 'خطأ غير معروف';
        throw new ApiError(502, `فشل إنشاء عملية دفع Tap: ${errorMsg}`);
      }

      // Get the checkout URL
      let checkoutUrl;
      
      if (useInvoice && data.url) {
        // Invoice URL (hosted payment page)
        checkoutUrl = data.url;
      } else if (data.transaction?.url) {
        // Charge URL
        checkoutUrl = data.transaction.url;
      } else {
        // Fallback: build URL from ID
        const id = data.id || data.charge_id;
        checkoutUrl = `${baseUrl}/${useInvoice ? 'invoices' : 'charges'}/${id}`;
      }

      return {
        checkoutUrl,
        providerReference: data.id || data.charge_id,
        metadata: {
          shortUrl: data.short_url,
          paymentMethods: data.supported_payment_methods
        }
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, `تعذر الاتصال بـ Tap: ${error.message}`);
    }
  },

  _getBaseUrl() {
    return this.mode === TAP_MODES.LIVE 
      ? 'https://api.tap.company/v2' 
      : 'https://api.sandbox.tap.company/v2';
  },

  verifyWebhook(req) {
    const secret = config.payment.tapWebhookSecret;
    if (!secret) return false;

    // Tap sends webhook with signature in header
    const signature = req.headers['tap-signature'];
    if (!signature) return false;

    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(signature, 'hex');
      
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

    const obj = body.obj || body;
    
    // Map Tap statuses to our status
    const statusMapping = {
      'CAPTURED': 'SUCCEEDED',
      'INITIATED': 'PENDING',
      'VOIDED': 'CANCELED',
      'ABANDONED': 'CANCELED',
      'CANCELLED': 'CANCELED',
      'REFUNDED': 'REFUNDED',
      'PARTIALLY_REFUNDED': 'PARTIALLY_REFUNDED',
      'FAILED': 'FAILED',
      'TIMEOUT': 'EXPIRED'
    };

    const tapStatus = obj.status || obj.status_code;
    const status = statusMapping[tapStatus] || 'FAILED';

    return {
      provider: 'TAP',
      type: status,
      providerReference: obj.id || null,
      metadata: {
        referenceId: obj.reference?.transaction,
        orderId: obj.reference?.order,
        responseCode: obj.response_code,
        cardInfo: obj.source?.object === 'card' ? {
          brand: obj.source.brand,
          lastFour: obj.source.last_four
        } : null,
        paymentMethod: obj.source?.object,
        currency: obj.currency,
        amount: obj.amount
      },
      raw: body
    };
  },

  /**
   * Verify charge status (for polling after callback)
   */
  async verifyCharge(chargeId) {
    if (!isConfigured()) {
      throw new ApiError(503, 'Tap not configured');
    }

    const baseUrl = this._getBaseUrl();
    
    const res = await fetch(`${baseUrl}/charges/${chargeId}`, {
      headers: {
        'Authorization': `Bearer ${config.payment.tapSecretKey}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      throw new ApiError(502, `Failed to verify Tap charge`);
    }

    return data;
  },

  /**
   * Create refund
   */
  async createRefund(chargeId, amount, reason = '') {
    if (!isConfigured()) {
      throw new ApiError(503, 'Tap not configured');
    }

    const baseUrl = this._getBaseUrl();
    
    const refundData = {
      charge_id: chargeId,
      amount: amount,
      reason: reason || 'Customer request',
      metadata: {
        refunded_at: new Date().toISOString(),
        provider: 'TAP'
      }
    };

    const res = await fetch(`${baseUrl}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.payment.tapSecretKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(refundData),
      signal: AbortSignal.timeout(15000)
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      throw new ApiError(502, `Refund failed: ${data.message || 'Unknown error'}`);
    }

    return data;
  }
};
