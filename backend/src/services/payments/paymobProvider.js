/**
 * Paymob Payment Provider - Batch 5
 * 
 * Supports Egyptian market (EGP) and other MENA regions.
 * Uses Paymob Accept API for payment integration.
 */

import crypto from 'crypto';
import { config } from '../../config.js';
import { ApiError } from '../../middleware/errorHandler.js';

function isConfigured() {
  return Boolean(config.payment?.paymobApiKey && config.payment?.paymobIntegrationId);
}

/**
 * Supported currencies by Paymob
 */
const SUPPORTED_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];

/** Payment methods available in Paymob */
const PAYMENT_METHODS = {
  CARD: 'card',
  WALLET: 'wallet',
  KIOSK: 'kiosk',
  MOBILE_WALLET: 'mobile_wallet'
};

/** Wallet providers for mobile wallets */
const WALLET_PROVIDERS = {
  VODAFONE: 'vodafone',
  ETISALAT: 'etisalat',
  ORANGE: 'orange',
  WE: 'we'
};

export const paymobProvider = {
  name: 'PAYMOB',
  label: 'Paymob (السوق المصري)',
  mode: config.payment?.paymobMode || 'test',

  info() {
    return {
      name: this.name,
      label: this.label,
      configured: isConfigured(),
      mode: this.mode,
      currencies: SUPPORTED_CURRENCIES,
      paymentMethods: Object.values(PAYMENT_METHODS),
      description: 'بوابة Paymob المصرية — تدفع الجنيه المصري وعمارات المنطقة مع محافظة إلكترونية'
    };
  },

  async createCheckout({ intent, subscription, paymentMethod = 'card', walletProvider }) {
    if (!isConfigured()) {
      throw new ApiError(503, 'مزود Paymob غير مضبوط — ضع PAYMOB_API_KEY + PAYMOB_INTEGRATION_ID في .env');
    }

    const currency = (intent.currency || 'EGP').toUpperCase();
    
    // Validate currency
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new ApiError(400, `العملة ${currency} غير مدعومة من Paymob — المتاح: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }

    try {
      // Step 1: Authenticate with Paymob
      const authToken = await this._authenticate();
      
      // Step 2: Create order
      const orderData = {
        amount_cents: Math.round(intent.amount * 100), // Paymob uses cents/piastres
        currency: currency,
        delivery_needed: false,
        merchant_order_id: String(intent.id),
        items: [{
          name: `اشتراك ${subscription.plan || 'المنصة'}`,
          amount_cents: Math.round(intent.amount * 100),
          description: 'Rafiqi Platform Subscription',
          quantity: 1
        }],
        metadata: {
          intentId: String(intent.id),
          subscriptionId: String(intent.subscriptionId || ''),
          provider: 'PAYMOB'
        },
        shipping_data: {}, // Will be filled from user data if needed
        billing_data: {}   // Will be filled from user data if needed
      };

      const orderRes = await fetch('https://accept.paymobsolutions.com/v1/integration/orders', {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData),
        signal: AbortSignal.timeout(15000)
      });

      const order = await orderRes.json().catch(() => ({}));
      
      if (!orderRes.ok || !order.id) {
        throw new ApiError(502, `فشل إنشاء طلب Paymob: ${order.message || 'خطأ غير معروف'}`);
      }

      // Step 3: Create payment key
      const paymentKeyData = {
        amount_cents: order.amount_cents,
        currency: order.currency,
        order_id: order.id,
        integration_id: this._getIntegrationId(paymentMethod, walletProvider),
        billing_data: {
          first_name: intent.userFirstName || 'User',
          last_name: intent.userLastName || '',
          email: intent.userEmail || '',
          phone_number: intent.userPhone || '',
          country: 'EG',
          city: intent.userCity || 'Cairo',
          street: intent.userStreet || '',
          building: intent.userBuilding || '',
          floor: intent.userFloor || '',
          apartment: intent.userApartment || ''
        }
      };

      const keyRes = await fetch('https://accept.paymobsolutions.com/v1/integration/payment_keys', {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentKeyData),
        signal: AbortSignal.timeout(15000)
      });

      const keyData = await keyRes.json().catch(() => ({}));
      
      if (!keyRes.ok || !keyData.token) {
        throw new ApiError(502, `فشل إنشاء مفتاح الدفع: ${keyData.message || 'خطأ غير معروف'}`);
      }

      // Generate checkout URL based on payment method
      let checkoutUrl;
      
      switch (paymentMethod) {
        case PAYMENT_METHODS.KIOSK:
          checkoutUrl = `https://accept.paymobsolutions.com/v1/kiosk-pay?payment_token=${keyData.token}`;
          break;
          
        case PAYMENT_METHODS.MOBILE_WALLET:
          // For mobile wallets, the URL is different
          checkoutUrl = `https://accept.paymobsolutions.com/v1/wallet/pay?payment_token=${keyData.token}`;
          break;
          
        case PAYMENT_METHODS.CARD:
        default:
          // iframe or redirect based on configuration
          const iframe = config.payment?.paymobUseIframe !== false;
          if (iframe) {
            checkoutUrl = `/api/payments/paymob/iframe?token=${keyData.token}`;
          } else {
            checkoutUrl = `https://accept.paymobsolutions.com/v1/iframe/${config.payment.paymobIntegrationId}?payment_token=${keyData.token}`;
          }
      }

      return {
        checkoutUrl,
        providerReference: order.id,
        metadata: {
          orderId: order.id,
          paymentToken: keyData.token,
          paymentMethod
        }
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, `تعذر الاتصال بـ Paymob: ${error.message}`);
    }
  },

  async _authenticate() {
    const apiKey = config.payment.paymobApiKey;
    
    const res = await fetch('https://accept.paymobsolutions.com/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
      signal: AbortSignal.timeout(10000)
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok || !data.token) {
      throw new Error('فشل المصادقة مع Paymob');
    }
    
    return data.token;
  },

  _getIntegrationId(paymentMethod, walletProvider) {
    const baseId = parseInt(config.payment.paymobIntegrationId);
    
    // Different integration IDs for different payment methods
    // This should be configured properly in production
    switch (paymentMethod) {
      case PAYMENT_METHODS.KIOSK:
        return config.payment.paymobKioskIntegrationId || baseId + 1;
        
      case PAYMENT_METHODS.MOBILE_WALLET:
        // Wallet-specific integration IDs
        const walletIds = {
          [WALLET_PROVIDERS.VODAFONE]: config.payment.paymobVodafoneId || baseId + 10,
          [WALLET_PROVIDERS.ETISALAT]: config.payment.paymobEtisalatId || baseId + 11,
          [WALLET_PROVIDERS.ORANGE]: config.payment.paymobOrangeId || baseId + 12,
          [WALLET_PROVIDERS.WE]: config.payment.paymobWeId || baseId + 13
        };
        return walletIds[walletProvider] || baseId + 10;
        
      case PAYMENT_METHODS.WALLET:
        return config.payment.paymobWalletIntegrationId || baseId + 2;
        
      case PAYMENT_METHODS.CARD:
      default:
        return baseId;
    }
  },

  verifyWebhook(req) {
    const secret = config.payment.paymobHmacSecret;
    if (!secret) return false;

    const hmac = req.headers['hmac'];
    if (!hmac) return false;

    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
      
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(hmac, 'hex');
      
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

    const obj = body.obj || {};
    
    // Map Paymob states to our status
    const stateMapping = {
      'AUTHORIZED': 'SUCCEEDED',
      'CAPTURED': 'SUCCEEDED',
      'VOIDED': 'CANCELED',
      'REFUNDED': 'REFUNDED',
      'FAILED': 'FAILED',
      'EXPIRED': 'EXPIRED'
    };

    const status = stateMapping[obj.state] || 'FAILED';

    return {
      provider: 'PAYMOB',
      type: status,
      providerReference: obj.id || null,
      metadata: {
        orderId: obj.order?.id,
        merchantOrderId: obj.order?.merchant_order_id,
        dataMessage: obj.data_message,
        sourceDataPan: obj.source_data?.pan,
        sourceDataSubType: obj.source_data?.sub_type
      },
      raw: body
    };
  },

  /**
   * Process callback (for kiosk/mobile wallet flows)
   */
  processCallback(processedCallback) {
    const { id, success } = processedCallback || {};
    return {
      success: !!success,
      providerReference: id,
      type: success ? 'SUCCEEDED' : 'FAILED'
    };
  }
};
