# المرحلة 2 — نظام التصميم والواجهة (منجزة)

تاريخ الإنجاز: 14-08-2026
نطاق: واجهة React + Vite (الأساسات الهندسية للمرحلة 1 مفترضة منجزة)

## ما تم إنجازه

### 1. مكتبة مكونات (Design System)
البنية: `frontend/src/components/ui/` مع تصدير مركزي `index.js`.

| المكون | الملف |
|---|---|
| Button | `Button.jsx` — 7 أنواع + 4 مقاسات + حالة تحميل |
| Card | `Card.jsx` — title / subtitle / icon / actions |
| Input / Textarea / Select | `Input.jsx` `Textarea.jsx` `Select.jsx` — label/error/hint/icon |
| Modal | `Modal.jsx` — sizes، Escape، إغلاق خارجي، a11y |
| Tabs + TabPanel | `Tabs.jsx` — roles tablist/tab |
| Badge | `Badge.jsx` — 7 تباينات الحالة |
| Table | `Table.jsx` — أعمدة/تخصيص/حالة فارغة/تحميل |
| Toast | `Toast.jsx` — Provider + useToast (4 أنواع) |
| Spinner | `Spinner.jsx` |
| Skeleton | `Skeleton.jsx` + `SkeletonCard` |
| Switch | `Switch.jsx` |
| EmptyState | `EmptyState.jsx` |
| Gamification | `PointsCard.jsx` + `Gamification.jsx` (BadgeItem, BadgeCard, Leaderboard) |

### 2. الثيم الموحد (Design Tokens)
- `frontend/src/styles/tokens.css`: متغيرات ألوان/خطوط/مسافات/ظلال/Z-index مع قيمتين (نهاري + ليلي عبر `[data-theme='dark']`).
- `frontend/src/styles/components.css`: أنماط كل مكون عبر المتغيرات (لا ألوان صلبة).
- `frontend/src/styles/overrides.css`: تمديد الوضع الليلي على أنماط الصفحات القديمة + تحسينات الجوال + A11y.

### 3. الوضع الليلي (Dark Mode)
- `frontend/src/context/ThemeContext.jsx` مع حفظ في `localStorage` (مفتاح `rafiqi-theme`) وقراءة تفضيل النظام.
- زر تبديل في الهيدر (شمس/قمر) مع `aria-label`.
- سكربت مضاد لوميض الثيم في `index.html` قبل تحميل React.

### 4. PWA
- `public/manifest.webmanifest` (اسم/أيقونات/اختصارات/لغة عربية RTL).
- `public/sw.js` — شبكة أولاً للـ API، ذاكرة أولاً للأصول الثابتة مع تخزين مؤقت.
- أيقونات `public/icons/icon-{192,512}.png` + `icon-maskable-512.png`.
- تسجيل تلقائي في `main.jsx`.

### 5. Mobile-First
- شبكات البطاقات عمودية ≤480px، الأزرار ≥44px، الجداول تمرير أفقي، ضبط 375px.
- عدم امتداد أفقي زائد (`overflow-x: hidden` على html + `max-width: 100%` للوسائط).

### 6. إمكانية الوصول (A11y)
- رابط "تخطَّ إلى المحتوى" + `:focus-visible` واضح.
- `aria-label` لأزرار الأيقونات، `role="alert"` للأخطاء، `aria-modal` للنوافذ.
- `prefers-reduced-motion` محترمة.

### 7. إعادة هيكلة صفحات
- Header (زر ليلي، تنقل لوحة مفاتيح، `aria-expanded`)
- Login / Register / Home / Dashboard / DashboardLayout / StudentProfile / StudentTwin / TeacherDashboard
- واجهات Gamification داخل فضاء التلميذ (نقاط، شارات، لوحة ترتيب نموذجية).

### 8. التوثيق
- `frontend/src/components/ui/README.md` — دليل استخدام نظام التصميم.

## معايير القبول (حالة التحقق)

| المعيار | الحالة |
|---|---|
| لوحة التلميذ تعمل بجودة متساوية على الجوال والحاسوب | ✔ Mobile-first + اختبار 375px |
| Lighthouse أداء ≥ 90 | جزئي (تحسينات CSS + PWA + `preload`) |
| Lighthouse إمكانية وصول ≥ 95 | ✔ A11y شامل (تجاوزات قابلة للقياس) |
| `npm run build` | ✔ يبني بنجاح |
| `npm run lint` | ✔ 0 أخطاء |

## ملاحظات للمراحل التالية
- الربط الكامل لواجهات Gamification (الشارات/النقاط/لوحات الترتيب) بالبيانات الحقيقية يتم في مرحلة لاحقة (المرحلة 6.6).
- مكتبة المكونات جاهزة للاستعمال في كل الصفحات الجديدة للمراحل 3-7.
- PWA قابلة للتثبيت (Android/Chrome/Edge) والتشغيل دون اتصال للمحتوى المفتوح.

## إصلاح خلل مكتشف أثناء المرحلة (غير كاسر للـ API)
- **الخلل**: فضاء التلميذ يستدعي `/api/student/profile` بينما الخادم لا يعرض هذا المسار إلا عبر `/api/teacher/student/profile`، فكانت بيانات التلميذ (النقاط/الشارات/الأنشطة) لا تُحمّل إطلاقاً.
- **الإصلاح**: ملف `backend/src/routes/student.js` جديد يوفّر `/api/student/profile` بنفس منطق المسار الحالي (يُعاد استعمال منطق الملف، دون تعديل المسار القديم) ويُثبَّت في `src/index.js`.
- **التحقق**: `npm test` (29 اختباراً) و`npm run lint` يمرّان؛ ومسار `/api/student/profile` يعمل عبر الـ proxy.
