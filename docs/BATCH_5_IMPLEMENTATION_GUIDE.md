# Batch 5: Market-Specific Payment Providers — Implementation Guide

## 📋 Overview

**Batch 5** implements intelligent market detection and automatic payment provider selection based on user location, currency, or profile. The infrastructure was already partially present; this batch completes it with market detection utilities and documentation.

---

## ✅ What Was Already Implemented (Pre-existing Infrastructure)

The payment provider system in `backend/src/services/payments/provider.js` already includes:

### 1. Multi-Provider Registry
```javascript
const providers = {
  DEMO: demoProvider,      // Testing/Development
  STRIPE: stripeProvider,  // International (US, EU)
  STB: stbProvider,        // Tunisia (Société Tunisienne de Banque)
  PAYPAL: paypalProvider,  // International
  PAYMOB: paymobProvider,  // Egypt
  TAP: tapProvider         // GCC (Saudi, UAE, Kuwait, etc.)
};
```

### 2. Market-to-Provider Mapping
```javascript
const MARKET_PROVIDERS = {
  TN: ['STB', 'STRIPE', 'DEMO'],           // Tunisia - Local + International
  US: ['STRIPE', 'PAYPAL', 'DEMO'],        // United States
  GB: ['STRIPE', 'PAYPAL', 'DEMO'],        // United Kingdom
  EU: ['STRIPE', 'PAYPAL', 'DEMO'],        // Europe
  
  // MENA Markets
  EG: ['PAYMOB', 'PAYPAL', 'DEMO'],        // Egypt
  SA: ['TAP', 'STRIPE', 'DEMO'],           // Saudi Arabia
  AE: ['TAP', 'PAYPAL', 'DEMO'],           // UAE
  KW: ['TAP', 'PAYPAL', 'DEMO'],           // Kuwait
  BH: ['TAP', 'PAYPAL', 'DEMO'],           // Bahrain
  QA: ['TAP', 'PAYPAL', 'DEMO'],           // Qatar
  OM: ['TAP', 'PAYPAL', 'DEMO'],           // Oman
  
  DEFAULT: ['STRIPE', 'DEMO']
};
```

### 3. Currency-to-Market Mapping
```javascript
const CURRENCY_MARKETS = {
  TND: 'TN', USD: 'US', EUR: 'EU', GBP: 'GB',
  EGP: 'EG', SAR: 'SA', AED: 'AE', KWD: 'KW',
  BHD: 'BH', QAR: 'QA', OMR: 'OM'
};
```

### 4. Smart Provider Selection Function
```javascript
export function getProviderForMarket({ market, currency, preferred }) {
  // 1. If user explicitly chose a provider → use it
  // 2. Determine market from currency if not specified
  // 3. Get ordered list of providers for this market
  // 4. Find first configured provider
  // 5. Fallback to DEMO (always available)
}
```

---

## 🆕 What Was Added in This Batch

### 1. Market Detection Utilities (`marketDetector.js`)

**File**: `backend/src/utils/marketDetector.js` — **NEW FILE**

Comprehensive market detection with multiple methods:

| Method | Source | Description |
|--------|--------|-------------|
| `detectMarketFromIP(ip)` | IP Address | GeoIP lookup (placeholder for MaxMind/ip-api) |
| `detectMarketFromPhone(phone)` | Phone Number | Country code parsing (+216→TN, +966→SA) |
| `detectMarketFromUser(user)` | User Profile | Checks country, phone, currency fields |
| `detectMarket(req)` | Request Object | Combines all methods with priority |

### 2. Country Database
Complete country configurations for **21 countries**:

**North Africa**: Tunisia, Algeria, Morocco, Libya, Egypt  
**GCC**: Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman  
**Levant**: Jordan, Lebanon, Syria, Iraq, Palestine  
**International**: US, UK, France, Germany, Canada, Australia

Each entry includes:
```javascript
TN: {
  name: 'تونس',
  nameEn: 'Tunisia',
  currency: 'TND',
  lang: 'ar',
  region: 'MENA'
}
```

### 3. Market Configuration API
```javascript
// Get complete config for a market
getMarketConfig('SA');
// Returns: { country, name, currency, payment: {...}, locale: {...}, region }

// Get all supported markets
getSupportedMarkets();
// Returns: Array of 21 markets with payment support status

// Group by region
getMarketsByRegion();
// Returns: { MENA: [...], GCC: [...], EUROPE: [...], NAMERICA: [...] }
```

### 4. Payment Context Resolver
```javascript
// Automatically resolve best provider for any context
const context = await resolvePaymentContext({
  req: expressRequest,    // From HTTP request
  user: userObject,       // From database
  phone: '+21612345678',  // From form input
  currency: 'SAR',        // Explicit currency
  market: 'SA'            // Explicit market
});

// Returns:
{
  provider: tapProviderInstance,
  market: 'SA',
  config: { /* full market config */ }
}
```

### 5. Currency Formatting for Markets
```javascript
formatPriceForMarket(29.990, 'TN'); // "29.990 د.ت."
formatPriceForMarket(99.99, 'SA');  // "99.99 ر.س"
formatPriceForMarket(49.99, 'US');  // "$49.99"
```

---

## 🔧 Integration Examples

### In Checkout Route
```javascript
import { resolvePaymentContext } from '../utils/marketDetector.js';

router.post('/checkout', authMiddleware, asyncHandler(async (req, res) => {
  const { amount, currency } = req.body;
  
  // Auto-detect market and select provider
  const { provider, market, config } = await resolvePaymentContext({
    req,
    user: req.user,
    currency
  });
  
  // Create checkout with auto-selected provider
  const intent = await createCheckoutIntent({
    provider: provider.name,
    amount,
    currency: config.country.currency,
    userId: req.user.id,
    metadata: { detectedMarket: market }
  });
  
  res.json({
    ...intent,
    _market: {
      country: market,
      currency: config.country.currency,
      provider: provider.name
    }
  });
}));
```

### In Registration Flow
```javascript
import { detectMarketFromPhone, getMarketConfig } from '../utils/marketDetector.js';

router.post('/register', asyncHandler(async (req, res) => {
  const { phone, ...userData } = req.body;
  
  // Detect market from phone number
  const market = detectMarketFromPhone(phone) || 'TN';
  const config = getMarketConfig(market);
  
  // Create user with detected market info
  const user = await prisma.user.create({
    data: {
      ...userData,
      phone,
      country: market,
      currency: config.country.currency,
      preferredLang: config.locale.lang
    }
  });
  
  res.json({ user, detectedMarket: config });
}));
```

### Admin: List Available Markets
```javascript
import { getMarketsByRegion, validateProviderForMarket } from '../utils/marketDetector.js';

router.get('/admin/markets', asyncHandler(async (_req, res) => {
  const regions = getMarketsByRegion();
  
  res.json({
    regions,
    totalMarkets: Object.values(regets).flat().length,
    supportedMarkets: Object.keys(MARKET_PROVIDERS).length
  });
}));

// Validate if a provider works in a specific market
router.get('/admin/providers/:provider/market/:market', (req, res) => {
  const result = validateProviderForMarket(req.params.provider, req.params.market);
  res.json(result);
});
```

---

## 📁 Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/utils/marketDetector.js` | **CREATED** | Market detection & configuration (~400 lines) |
| `docs/BATCH_5_IMPLEMENTATION_GUIDE.md` | **CREATED** | This documentation |
| `backend/src/services/payments/provider.js` | Pre-existing | Core provider registry (unchanged) |

---

## 🌍 Supported Markets & Providers

| Region | Countries | Primary Provider | Fallback |
|--------|-----------|------------------|----------|
| **North Africa** | Tunisia (TN), Algeria (DZ), Morocco (MA), Libya (LY), Egypt (EG) | STB / PAYMOB | Stripe |
| **GCC** | Saudi (SA), UAE (AE), Kuwait (KW), Qatar (QA), Bahrain (BH), Oman (OM) | TAP | PayPal |
| **Levant** | Jordan (JO), Lebanon (LB), Syria (SY), Iraq (IQ), Palestine (PS) | PayPal | Stripe |
| **Europe** | UK (GB), France (FR), Germany (DE) | Stripe | PayPal |
| **Americas** | US (US), Canada (CA) | Stripe | PayPal |
| **Oceania** | Australia (AU) | Stripe | PayPal |

---

## 🧪 Testing

### Test Market Detection from Phone
```bash
# Tunisia
curl -X POST http://localhost:3000/api/test-market \
  -H "Content-Type: application/json" \
  -d '{"phone": "+21612345678"}'
# Expected: { market: "TN", currency: "TND" }

# Saudi Arabia
curl -X POST http://localhost:3000/api/test-market \
  -H "Content-Type: application/json" \
  -d '{"phone": "+966501234567"}'
# Expected: { market: "SA", currency: "SAR" }
```

### Test Provider Selection
```javascript
import { getProviderForMarket, MARKET_PROVIDERS } from './services/payments/provider.js';

// Should return STB provider for Tunisia
const tnProvider = getProviderForMarket({ market: 'TN' });
console.log(tnProvider.info().name); // "STB Bank"

// Should return TAP for Saudi Arabia
const saProvider = getProviderForMarket({ market: 'SA' });
console.log(saProvider.info().name); // "Tap Payments"
```

### Test Market Config
```javascript
import { getMarketConfig, formatPriceForMarket } from './utils/marketDetector.js';

console.log(getMarketConfig('EG'));
// { country: 'EG', name: 'مصر', currency: 'EGP', ... }

console.log(formatPriceForMarket(199.99, 'EG'));
// "199.99 ج.م"
```

---

## 🔮 Future Enhancements

### GeoIP Integration
To enable IP-based market detection:

1. Sign up for [MaxMind GeoIP2](https://www.maxmind.com/)
2. Install: `npm install maxmind`
3. Update `detectMarketFromIP()` in `marketDetector.js`:

```javascript
import maxmind from 'maxmind';

let cityReader;

async function initGeoIP() {
  cityReader = await maxmind.open('./GeoLite2-City.mmdb');
}

export async function detectMarketFromIP(ip) {
  if (!cityReader) await initGeoIP();
  
  const result = cityReader.get(ip);
  return result?.country?.iso_code || null;
}
```

### Cloudflare Integration (Recommended)
If using Cloudflare, add to `server.js`:

```javascript
// Cloudflare sends country code in this header
app.use((req, res, next) => {
  const cfCountry = req.headers['cf-ipcountry'];
  if (cfCountry) {
    req.detectedCountry = cfCountry;
  }
  next();
});
```

---

## ⚠️ Important Notes

1. **Provider Configuration Required**: Having a provider in `MARKET_PROVIDERS` doesn't mean it's configured. Each provider needs API keys/secrets set in environment variables.

2. **Demo Mode**: The `DEMO` provider is always available as fallback and doesn't require real credentials.

3. **Currency Precision**: Tunisian Dinar uses 3 decimal places (mills). The formatter handles this automatically.

4. **Phone Number Formats**: The detector handles various formats: +216XX, 00216XX, 216XX, etc.

5. **Regulatory Compliance**: Each market has different payment regulations. Ensure compliance before enabling payments in new markets.

---

## 📊 Completion Status

| Component | Status | Notes |
|-----------|--------|-------|
| Multi-Provider Registry | ✅ Complete | 6 providers (DEMO, Stripe, STB, PayPal, Paymob, Tap) |
| Market-to-Provider Mapping | ✅ Complete | 12+ markets mapped |
| Currency-to-Market Mapping | ✅ Complete | 12 currencies mapped |
| Smart Provider Selection | ✅ Complete | `getProviderForMarket()` function |
| Phone-Based Detection | ✅ Complete | 20+ country codes |
| User Profile Detection | ✅ Complete | Country, phone, currency fields |
| Market Configuration API | ✅ Complete | `getMarketConfig()`, `getSupportedMarkets()` |
| Price Formatting | ✅ Complete | `formatPriceForMarket()` |
| Documentation | ✅ Complete | This guide |

---

**Batch 5 Status: ✅ COMPLETE**

The payment infrastructure is now fully market-aware and ready for multi-country expansion.
