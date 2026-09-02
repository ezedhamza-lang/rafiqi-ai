# الدفعة 4 — توحيد تنسيق التاريخ/الأرقام حسب locale + دعم LTR

## ✅ ما تم إنجازه

### 1. ملف الأدوات المساعدة المركزي `formatUtils.js`
**المسار:** `frontend/src/utils/formatUtils.js`

**الدوال المتاحة:**

| الدالة | الوصف | المعاملات |
|--------|-------|-----------|
| `getLocale(lang)` | إرجاع locale string | `'ar'` → `'ar-TN'`, `'en'` → `'en-GB'` |
| `isRTL(lang)` | التحقق من RTL | `true` للعربية |
| `formatDate(iso, lang)` | تنسيق تاريخ | يدعم null/invalid |
| `formatDateTime(iso, lang)` | تنسيق تاريخ + وقت | |
| `formatTime(iso, lang)` | تنسيق وقت فقط | |
| `timeAgo(iso, lang, t)` | وقت نسبي ("منذ دقيقة") | يحتاج `t()` من i18n |
| `fullDate(iso, lang)` | تاريخ كامل (مع اليوم) | |
| `formatNumber(value, lang, opts)` | تنسيق أرقام | خيارات toLocaleString |
| `formatPercent(value, lang, decimals)` | تنسيق نسبة مئوية | |
| `formatCurrency(value, {lang, currency, decimals})` | تنسيق عملة | TND/USD/EUR/GBP |
| `getLevelName(index, lang)` | اسم المستوى الدراسي | عربي/إنجليزي |
| `useFormatUtils(lang, t)` | خطاف يجمع كل الدوال | مرتبط بـ lang/t |

**الميزات:**
- تراجع آمن لـ null/undefined/invalid dates
- دعم عملات متعددة (TND, USD, EUR, GBP)
- تنسيق تلقائي حسب اللغة (3 أرقام عشرية لـ TND)
- اتجاه العملة صحيح (عربية: الرقم ثم الرمز)

---

### 2. الملفات المُحدَّثة (إزالة الدوال المكررة)

| الملف | التغيير |
|-------|---------|
| **Header.jsx** | استيراد `timeAgo` من formatUtils، حذف الدالة المحلية |
| **Messages.jsx** | استيراد `timeAgo` + `fullDate`، حذف الدالتين المحليتين |
| **MessageCenter.jsx** | استيراد `timeAgo`، حذف الدالة المحلية |
| **LiveSessions.jsx** | استبدال `fmtDateTime` الثابتة بـ `formatDateTime` من formatUtils |
| **SchoolCalendar.jsx** | إصلاح `'ar-TN'` الثابت لاستخدام `lang` |
| **Assignments.jsx** (teacher) | استيراد `formatDate`، حذف الدالة المحلية |
| **ChildAssignments.jsx** (parent) | نفس التعديل |
| **StudentAssignments.jsx** (student) | نفس التعديل |

**النتيجة:**
- إزالة **6 دوال مكررة**
- توحيد التنسيق في مكان واحد
- سهولة الصيانة المستقبلية

---

### 3. دعم RTL/LTR محسّن

**ملف جديد:** `frontend/src/styles/rtl.css`

**القواعد المضافة:**

| الفئة/المنتقي | الوصف |
|---------------|-------|
| `.margin-left-auto` / `.margin-right-auto` | هوامش تلقائية حسب الاتجاه |
| `.icon-text-row` | عكس ترتيب أيقونة+نص في RTL |
| `.text-start` / `.text-end` | محاذاة نص حسب الاتجاه |
| `.border-start` / `.border-end` | حدود ذكية |
| `.position-start` / `.position-end` | تحديد موضع ذكي |
| `input[type="number"]` | أرقام تبقى LTR حتى في RTL |
| `pre, code` | الكود يبقى LTR |
| `@keyframes slide-in-from-*` | حركات متوافقة مع الاتجاه |

**تم الاستيراد في:** `main.jsx`

---

## ⚠️ ما يحتاج انتباهاً مستقبلاً

### Backend Services (تحتاج معامل locale)
الملفات التالية تحتوي على `'ar-TN'` ثابت:

| الملف | السطر/الأسطر | الحل المقترح |
|-------|-------------|--------------|
| `invoiceService.js` | 74 | قبول `locale` من الطلب أو إرجاع ISO dates |
| `paymentService.js` | 169 | نفس الحل |
| `financialReportService.js` | 61, 396, 429, 456, 481, 501, 517 | نفس الحل |
| `subscriptionRenewalService.js` | 198 | نفس الحل |
| `finance.js` (routes) | 190, 240 | نفس الحل |
| `attendance.js` (routes) | 168 | نفس الحل |

**الحل الموصى به:**
```javascript
// Option A: Return raw ISO dates, let frontend format
res.json({ issuedAt: invoice.issuedAt }); // Frontend uses formatDate()

// Option B: Accept locale from query/header
const locale = req.query.locale || 'ar-TN';
new Date(invoice.issuedAt).toLocaleDateString(locale);
```

---

## 📊 إحصائيات التحسين

| الفئة | قبل | بعد |
|------|-----|-----|
| دوال `timeAgo()` مكررة | 3 نسخ | 1 مركزية |
| دوال `formatDate()` مكررة | 3 نسخ | 1 مركزية |
| تنسيقات تاريخ ثابتة (`'ar-TN'`) | ~12 | 0 (في Frontend) |
| قواعد CSS `[dir='rtl']` | 2 | 30+ |
| أدوات مساعدة للأرقام | 0 | 7 دوال جديدة |

---

## 🧪 اختبار التغييرات

### اختبار تنسيق التاريخ:
```javascript
// In browser console:
import { formatDate } from './utils/formatUtils';

formatDate('2024-08-19', 'ar'); // "19 أغسطس 2024"
formatDate('2024-08-19', 'en'); // "19 Aug 2024"
formatDate(null, 'ar');          // "—"
formatDate('invalid', 'ar');     // "invalid"
```

### اختبار RTL/LTR:
```html
<!-- Switch language and verify -->
<html dir="rtl" lang="ar"> <!-- Arabic layout -->
<html dir="ltr" lang="en"> <!-- English layout -->
```

### اختبار العملة:
```javascript
import { formatCurrency } from './utils/formatUtils';

formatCurrency(150.500, { lang: 'ar' });     // "150.500 د.ت"
formatCurrency(150.500, { lang: 'en' });     // "TND 150.500"
formatCurrency(99.99, { lang: 'en', currency: 'USD' }); // "$99.99"
```
