# الدفعة 5 — مزوّد دفع لكل سوق

## ✅ ما تم إنجازه

### البنية الموجودة مسبقاً (من الدفعة السابقة)
- ✅ `provider.js` — تسجيل مركزي للمزودين
- ✅ `demoProvider.js` — محاكاة داخل المنصة
- ✅ `stripeProvider.js` — Stripe (للسوق الدولي)
- ✅ `stbProvider.js` — STB (بنك تونس)

### المزودين الجدد (الدفعة 5)

#### 1. PayPal Provider (`paypalProvider.js`)
**السوق المستهدف:** دولي (أمريكا، أوروبا، بريطانيا)
**العملات:** USD, EUR, GBP, AUD, CAD, JPY
**الميزات:**
- دعم PayPal REST API v2
- إنشاء طلبات دفع (Orders API)
- التحقق من Webhook
- دعم الـ Capture للاسترداد
- وضع Sandbox/Production

**متغيرات البيئة المطلوبة:**
```
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_SECRET=your_secret
PAYPAL_MODE=sandbox  # أو live
```

#### 2. Paymob Provider (`paymobProvider.js`)
**السوق المستهدف:** مصر والمنطقة العربية
**العملات:** EGP, USD, EUR, GBP, SAR, AED
**الميزات:**
- دعم Paymob Accept API
- طرق دفع متعددة:
  - بطاقات ائتمان/خصم
  - محافظ إلكترونية
  - فواتير Kiosk
  - محافظ جوال (Vodafone, Etisalat, Orange, We)
- HMAC Webhook verification
- معرفات تكامل مختلفة لكل طريقة

**متغيرات البيئة المطلوبة:**
```
PAYMOB_API_KEY=your_api_key
PAYMOB_INTEGRATION_ID=your_integration_id
PAYMOB_HMAC_SECRET=your_hmac_secret
PAYMOB_MODE=test  # أو live
```

**متغيرات اختيارية (لمحافظ الجوال):**
```
PAYMOB_VODAFONE_ID=xxx
PAYMOB_ETISALAT_ID=xxx
PAYMOB_ORANGE_ID=xxx
PAYMOB_WE_ID=xxx
```

#### 3. Tap Provider (`tapProvider.js`)
**السوق المستهدف:** السعودية والخليج
**العملات:** SAR, AED, KWD, BHD, QAR, OMR, USD, EUR, EGP
**الميزات:**
- دعم Tap Payments API v2
- Apple Pay و STC Pay
- إنشاء Invoices و Charges
- Webhook signature verification
- دعم الاستردادات (Refunds)
- وضع Test/Live

**متغيرات البيئة المطلوبة:**
```
TAP_SECRET_KEY=your_secret_key
TAP_PUBLIC_KEY=your_public_key
TAP_WEBHOOK_SECRET=your_webhook_secret
TAP_MODE=test  # أو live
```

---

### تحسين سجل المزودين (`provider.js`)

**الدوال الجديدة:**

| الدالة | الوصف |
|--------|-------|
| `getProviderForMarket({market, currency, preferred})` | اختيار ذكي للمزوّد حسب السوق |
| `getAvailableProvidersForMarket(market)` | قائمة المزودين المتاحين لسوق |
| `isProviderConfigured(name)` | التحقق من تهيئة مزوّد |
| `getProviderForCurrency(currency)` | مزوّد افتراضي حسب العملة |

**خريطة الأسواق:**

| السوق | المزودون (بالترتيب) |
|-------|---------------------|
| 🇹🇳 تونس | STB → STRIPE → DEMO |
| 🇪🇬 مصر | PAYMOB → PAYPAL → DEMO |
| 🇸🇦 السعودية | TAP → STRIPE → DEMO |
| 🇦🇪 الإمارات | TAP → PAYPAL → DEMO |
| 🇺🇸 أمريكا | STRIPE → PAYPAL → DEMO |
| 🇬🇧 بريطانيا | STRIPE → PAYPAL → DEMO |
| 🇪🇺 أوروبا | STRIPE → PAYPAL → DEMO |
| 🇰🇼 الكويت | TAP → PAYPAL → DEMO |
| 🇧🇭 البحرين | TAP → PAYPAL → DEMO |
| 🇶🇦 قطر | TAP → PAYPAL → DEMO |
| 🇴🇲 عُمان | TAP → PAYPAL → DEMO |

---

## 🔧 كيفية الاستخدام

### اختيار تلقائي حسب السوق:
```javascript
import { getProviderForMarket } from './payments/provider.js';

// للسوق السعودي
const provider = getProviderForMarket({ market: 'SA', currency: 'SAR' });
// → يرجع TAP إذا كان مضبوطاً، وإلا STRIPE، وإلا DEMO

// للسوق المصري
const provider = getProviderForMarket({ market: 'EG', currency: 'EGP' });
// → يرجع PAYMOB إذا كان مضبوطاً
```

### اختيار يدوي:
```javascript
import { getProvider } from './payments/provider.js';

const provider = getProvider('PAYPAL'); // استخدم PayPal بغض النظر عن السوق
```

### في مسارات الدفع:
```javascript
// POST /api/payments/create-intent
router.post('/create-intent', asyncHandler(async (req, res) => {
  const { currency, market, preferredProvider } = req.body;
  
  // اختيار ذكي للمزوّد
  const provider = getProviderForMarket({
    market,
    currency,
    preferred: preferredProvider
  });
  
  // إنشاء جلسة دفع
  const checkout = await provider.createCheckout({
    intent: paymentIntent,
    subscription: sub,
    userFirstName: req.user.firstName,
    // ... بيانات أخرى
  });
  
  res.json(checkout);
}));
```

---

## ⚙️ متغيرات البيئة الكاملة

```env
# === Payment Providers Configuration ===

# Demo (always available)
DEMO_WEBHOOK_SECRET=demo_secret_here

# Stripe (International)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# STB (Tunisia) - if applicable
STB_MERCHANT_ID=xxx
STB_TERMINAL_ID=xxx
STB_KEY=xxx

# PayPal (International)
PAYPAL_CLIENT_ID=Axxx
PAYPAL_SECRET=xxx
PAYPAL_MODE=sandbox

# Paymob (Egypt/MENA)
PAYMOB_API_KEY=xxx
PAYMOB_INTEGRATION_ID=xxx
PAYMOB_HMAC_SECRET=xxx
PAYMOB_MODE=test
# Optional: Mobile wallet integration IDs
PAYMOB_VODAFONE_ID=
PAYMOB_ETISALAT_ID=
PAYMOB_ORANGE_ID=
PAYMOB_WE_ID=

# Tap (Saudi/Gulf)
TAP_SECRET_KEY=sk_test_xxx
TAP_PUBLIC_KEY=pk_xxx
TAP_WEBHOOK_SECRET=whsec_xxx
TAP_MODE=test
```

---

## 📋 خطوات الإنتاج

1. **اختر المزود(ين) المناسب(ين)** لسوقك المستهدف
2. **أضف مفاتيح API** في `.env`
3. **اختبر في وضع Sandbox/Test**
4. **فعّل Webhooks** في لوحة تحكم المزوّد
5. **تحقق من عمليات الدفع** التجريبية
6. **فعّل وضع Live** بعد التحقق الكامل

---

## 🧪 اختبار المزودين

### اختبار PayPal:
```bash
curl -X POST /api/payments/create-intent \
  -H "Content-Type: application/json" \
  -d '{"currency": "USD", "preferredProvider": "PAYPAL"}'
```

### اختبار Paymob:
```bash
curl -X POST /api/payments/create-intent \
  -H "Content-Type: application/json" \
  -d '{"currency": "EGP", "market": "EG"}'
```

### اختبار Tap:
```bash
curl -X POST /api/payments/create-intent \
  -H "Content-Type: application/json" \
  -d '{"currency": "SAR", "market": "SA"}'
```

---

## 📊 ملخص

| المزوّد | السوق | العملات | الحالة |
|--------|-------|---------|--------|
| DEMO | كافة | كافة | ✅ جاهز |
| STB | تونس | TND | ✅ موجود مسبقاً |
| STRIPE | دولي | كثيرة | ✅ موجود مسبقاً |
| **PAYPAL** | **دولي** | **USD/EUR/GBP** | **🆕 جديد** |
| **PAYMOB** | **مصر/عربي** | **EGP/SAR/AED** | **🆕 جديد** |
| **TAP** | **سعودي/خليجي** | **SAR/AED/KWD** | **🆕 جديد** |

**إجمالي المزودين المتاحين:** 6
**الأسواق المدعومة:** 11+ سوق
**العملات المدعومة:** 12+ عملة
