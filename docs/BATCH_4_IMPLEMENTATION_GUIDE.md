# Batch 4: Locale-Aware Formatting & RTL/LTR Support — Implementation Guide

## 📋 Overview

**Batch 4** implements locale-aware date/number/currency formatting and bidirectional (RTL/LTR) text support. This enables the platform to properly display content for both Arabic (RTL) and English (LTR) markets.

---

## ✅ What Was Implemented

### 1. Core Locale Formatter (`localeFormatter.js`)

**File**: `backend/src/utils/localeFormatter.js`

A comprehensive utility module providing:

| Feature | Functions | Description |
|---------|-----------|-------------|
| **Direction Detection** | `getDirection()`, `isRTL()`, `isLTR()`, `detectTextDirection()` | Determine text direction for a locale or from content |
| **HTML Attributes** | `getHtmlAttrs()` | Get `lang` and `dir` attributes for `<html>` tag |
| **Date Formatting** | `formatDate()`, `formatTime()`, `formatRelativeTime()`, `formatDateRange()` | Locale-aware date/time formatting |
| **Number Formatting** | `formatNumber()`, `formatPercent()`, `formatCurrency()`, `formatFileSize()`, `formatOrdinal()` | Number/currency formatting with proper separators |
| **List Formatting** | `formatList()` | Conjunction-aware list joining (و/and) |
| **Phone Formatting** | `formatPhoneNumber()` | Country-specific phone number formats |
| **Locale Info** | `getLocaleInfo()`, `getLocaleConfig()`, `getSupportedLocales()` | Metadata for frontend consumption |

### 2. Locale Middleware (`middleware/locale.js`)

**File**: `backend/src/middleware/locale.js`

Express middleware that:
- Extracts `?lang=` parameter from all requests
- Parses `Accept-Language` header (future-ready)
- Sets `req.locale` with full configuration
- Adds response headers: `Content-Language`, `X-Locale-Dir`
- Provides `res.setLocale()` helper method
- Never blocks requests on error (graceful fallback to Arabic)

### 3. Updated API Routes (`routes/public.js`)

Enhanced endpoints now return formatted data:

```javascript
// GET /api/public/announcements?lang=en
// Response now includes:
{
  id: 1,
  title: "Welcome",           // Localized via i18nHelper
  description: "...",
  date: "2024-01-15T10:30:00Z",
  dateFormatted: "Jan 15, 2024",     // NEW: Formatted date
  dateRelative: "5 months ago"        // NEW: Relative time
}
```

### 4. New Locale Endpoint

```
GET /api/public/locale?lang=en
```

Returns complete locale configuration for frontend:

```json
{
  "code": "en",
  "name": "English",
  "dir": "ltr",
  "isRTL": false,
  "currency": "USD",
  "currencySymbol": "$",
  "firstDayOfWeek": 0,
  "weekend": [0, 6],
  "timeZone": "UTC",
  "dateFormat": { ... },
  "htmlAttrs": {
    "lang": "en",
    "dir": "ltr"
  },
  "messages": {
    "direction": "ltr",
    "alignStart": "left",
    "alignEnd": "right"
  }
}
```

### 5. Global Middleware Registration

**File**: `backend/src/index.js`

Added `localeMiddleware` globally after JSON parser:

```javascript
import { localeMiddleware } from './middleware/locale.js';

app.use(express.json({ limit: config.bodyLimit }));
app.use(localeMiddleware);  // ← NEW: Available on ALL routes
```

---

## 🌍 Supported Locales

### Arabic (ar-TN) - Default
```javascript
{
  dir: 'rtl',
  calendar: 'gregory',      // Can be changed to 'islamic-umalqura' for Hijri
  timeZone: 'Africa/Tunis',
  dateFormat: {
    short: 'dd/MM/yyyy',       // 15/01/2024
    medium: 'dd MMMM yyyy',    // 15 جانفي 2024
    long: 'EEEE، dd MMMM yyyy' // الاثنين، 15 جانفي 2024
  },
  numberFormat: {
    decimal: ',',              // Comma for decimals
    thousands: '.',            // Dot for thousands
    currency: 'TND',
    currencySymbol: 'د.ت.',
    currencyPosition: 'after'  // 100.000 د.ت.
  }
}
```

### English (en-US)
```javascript
{
  dir: 'ltr',
  calendar: 'gregory',
  timeZone: 'UTC',
  dateFormat: {
    short: 'MM/dd/yyyy',       // 01/15/2024
    medium: 'MMM dd, yyyy',    // Jan 15, 2024
    long: 'EEEE, MMMM dd, yyyy'// Monday, January 15, 2024
  },
  numberFormat: {
    decimal: '.',              // Dot for decimals
    thousands: ',',            // Comma for thousands
    currency: 'USD',
    currencySymbol: '$',
    currencyPosition: 'before' // $100.00
  }
}
```

---

## 🔧 Usage Examples

### In Route Handlers

```javascript
import { formatDate, formatCurrency, getDirection } from '../utils/localeFormatter.js';

router.get('/invoice/:id', asyncHandler(async (req, res) => {
  const lang = req.locale?.lang || 'ar';
  const invoice = await prisma.invoice.findUnique({ ... });
  
  res.json({
    ...invoice,
    totalFormatted: formatCurrency(invoice.total, lang, { currency: invoice.currency }),
    dateFormatted: formatDate(invoice.createdAt, lang),
    dueDateFormatted: formatDate(invoice.dueDate, lang, { format: 'long' }),
    direction: getDirection(lang)
  });
}));
```

### In Services

```javascript
import { formatPercent, formatList } from '../utils/localeFormatter.js';

function generateStudentReport(student, lang = 'ar') {
  return {
    name: student.name,
    average: formatPercent(student.average, lang),
    subjects: formatList(student.subjects, lang),
    grade: formatOrdinal(student.rank, lang)
  };
}
```

### Frontend Integration

```javascript
// Fetch locale config on app startup
const response = await fetch('/api/public/locale?lang=en');
const locale = await response.json();

// Apply to <html> tag
document.documentElement.lang = locale.htmlAttrs.lang;
document.documentElement.dir = locale.htmlAttrs.dir;

// Use for CSS
document.body.style.direction = locale.messages.direction;
```

---

## 📁 Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/utils/localeFormatter.js` | **CREATED** | Core formatting utilities (~500 lines) |
| `backend/src/middleware/locale.js` | **CREATED** | Express middleware for locale extraction |
| `backend/src/routes/public.js` | **MODIFIED** | Added date formatting + `/locale` endpoint |
| `backend/src/index.js` | **MODIFIED** | Registered global locale middleware |

---

## 🧪 Testing

### Test Date Formatting
```bash
# Arabic dates
curl "http://localhost:3000/api/public/announcements?lang=ar" | jq '.[0].dateFormatted'
# Expected: "15 جانفي 2024" or similar

# English dates  
curl "http://localhost:3000/api/public/announcements?lang=en" | jq '.[0].dateFormatted'
# Expected: "Jan 15, 2024" or similar
```

### Test Locale Endpoint
```bash
curl "http://localhost:3000/api/public/locale?lang=en" | jq '{ dir, isRTL, currency }'
# Expected: { "dir": "ltr", "isRTL": false, "currency": "USD" }

curl "http://localhost:3000/api/public/locale?lang=ar" | jq '{ dir, isRTL, currency }'
# Expected: { "dir": "rtl", "isRTL": true, "currency": "TND" }
```

### Test Direction Detection
```bash
# In Node.js
import { detectTextDirection, isRTL } from './utils/localeFormatter.js';

console.log(detectTextDirection('مرحبا بالعالم'));  // "rtl"
console.log(detectTextDirection('Hello World'));     // "ltr"
console.log(isRTL('ar'));                            // true
console.log(isRTL('en'));                            // false
```

---

## 🚀 Next Steps for Frontend Integration

Batch 4 provides the **backend foundation** for locale-aware formatting. To complete the picture:

1. **Call `/api/public/locale`** on app startup to get locale config
2. **Set `<html dir>` and `lang`** dynamically based on response
3. **Use CSS logical properties** instead of physical ones:
   ```css
   /* Before */
   .container { margin-left: auto; margin-right: 0; }
   
   /* After */
   .container { margin-inline-start: auto; margin-inline-end: 0; }
   ```
4. **Implement language switcher** that calls APIs with `?lang=en|ar`
5. **Cache locale config** in localStorage/state management

---

## ⚠️ Notes

- **Hijri Calendar**: The formatter supports `'islamic-umalqura'` calendar option but defaults to Gregorian. Change in `LOCALES.ar.calendar` if needed.
- **Time Zones**: Arabic locale uses `Africa/Tunis`. For other Arab countries, update `LOCALES.ar.timeZone`.
- **Currency Symbols**: The `formatCurrency()` function supports 10+ currencies. Add more as needed.
- **Graceful Fallback**: All functions fallback to Arabic if invalid locale provided.

---

## 📊 Completion Status

| Component | Status | Notes |
|-----------|--------|-------|
| Date Formatting | ✅ Complete | Short, medium, long, relative, range |
| Number Formatting | ✅ Complete | Decimals, percentages, ordinals |
| Currency Formatting | ✅ Complete | Multi-currency with symbols |
| RTL/LTR Detection | ✅ Complete | From locale code AND text content |
| Locale Middleware | ✅ Complete | Global + strict variants |
| API Endpoint | ✅ Complete | `/api/public/locale` |
| Documentation | ✅ Complete | This guide |

---

**Batch 4 Status: ✅ COMPLETE**
