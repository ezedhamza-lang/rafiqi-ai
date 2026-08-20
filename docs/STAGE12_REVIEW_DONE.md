# مراجعة المرحلتين 1 و2 — الأساسات الهندسية + نظام التصميم والواجهة (منجزة)

تاريخ المراجعة: 15-08-2026
النطاق: مراجعة شيفرة المرحلتين 1+2 (backend: مصادقة/أدوار/تحقق/إعداد؛ frontend: نظام التصميم والواجهة) وإصلاح الثغرات المكتشفة، حسب `docs/PHASES_SPLIT.md` وقائمة `PENDING_FIXES.md` (بند «المرحلتان 1+2 و 5 معلّقان»).

## ما تم مراجعته

| الملف | النطاق |
|---|---|
| `backend/src/config.js` | إعداد المتغيرات الإجبارية (`DATABASE_URL`, `JWT_SECRET`, …) |
| `backend/src/auth.js` + `middleware/validate.js` | المصادقة والأدوار والتحقق من المدخلات (`toInt`/`toBool`) |
| `backend/src/swagger.js` | تجميع توثيق OpenAPI |
| `backend/src/routes/{admin,students,attendance,teacher}.js` | أدوار الإدارة والتلاميذ والحضور والاختبارات |
| `backend/src/routes/payments.js` (`/demo-checkout/:intentId/result`) | محاكاة نتيجة الدفع التجريبي DEMO |
| `frontend/src/components/ui/{Modal,Button}.jsx` + `styles/components.css` | نافذة حوار، زر، مؤشرات حية، مفاتيح تبديل |
| `frontend/src/pages/Home.jsx` | إمكانية الوصول للأسئلة الشائعة + ألوان الثيم |
| `frontend/public/sw.js` + `src/main.jsx` | عامل الخدمة وتحديث التطبيق |
| `frontend/src/styles/tokens.css` | متغيرات التصميم |

## الثغرات المكتشفة والإصلاحات

### إعدادات الخادم والتحقق

1. **المتغيرات الإجبارية تقبل فراغاً** — `src/config.js` (`required()`) ✅
   كانت `required()` تعيد `''` عند غياب المتغير بدل رمي خطأ؛ فالخادم «يعمل» فقط لأن `@prisma/client` يحمّل `.env` عند الاستيراد — وأي مسار يستورد `config` قبل `db` يرى فراغات صامتة. الحل: `required()` ترمي `Missing required environment variable: <NAME>` عند غياب القيمة أو فراغها.

2. **`toInt` ينتج `NaN`** — `src/middleware/validate.js` ✅
   عند غياب/فراغ الحقل كان `parseInt` يعيد `NaN` فيمر عبر الزُّد ويُتلف الاستعلامات. الحل: إرجاع الـ fallback (أو `null`) عند `undefined`/`null`/`''`.

3. **مسار `apis` هشّ** — `src/swagger.js` ✅
   كان مسار ملفات المسارات نسبياً (هشّاً حسب `cwd`). الحل: `path.join(__dirname, './routes/*.js')`.

### الأدوار والصلاحيات

4. **قائمة التلاميذ تكشف اشتراكات مالية** — `src/routes/students.js` (`includeForRole`) ✅
   كانت `subscriptions` (بما فيها `amount`) تُضمّن لجميع الأدوار. الحل: الدالة أصبحت تعتمد على الدور — الاشتراكات تُرجع فقط لـ PARENT/ADMIN/SCHOOL_DIRECTOR/SUPER_ADMIN، لا للتلميذ ولا للأستاذ.

5. **تسريب مفاتيح إجابات الاختبارات** — `src/routes/teacher.js` ✅
   كانت `GET /student/quizzes` و `GET /student/quizzes/:id` تعيدان `correctOption`/`correctAnswer`/`orderItems` للتلميذ. الحل: `sanitizeQuizForStudent()` + مجموعة `ANSWER_KEYS` تحذفها قبل الإرسال.

6. **IDOR في اختبارات التلميذ** — `src/routes/teacher.js` ✅
   كان `findFirst` في GET و POST submit يبحث بالمعرّف دون ربط بقسم التلميذ، فيستطيع التلميذ الوصول لاختبارات أي قسم (وتسريب إجاباتها). الحل: تقييد الشرط بـ `classId` الخاص بالتلميذ (ويعيد 404 عند غيابه).

7. **`try/catch` مفرط يبتلع أخطاء Prisma** — `src/routes/teacher.js` (إنشاء/تعديل اختبار) ✅
   كان `try/catch` يلفّ عملية الإنشاء كلها ويحوّل أي خطأ (بما فيه خطأ قاعدة البيانات) إلى `400` برسالة عامة. الحل: حصر `try/catch` حول `validateQuestions` فقط؛ أما فشل Prisma فيذهب إلى `asyncHandler` (500) كأي مسار آخر.

### إدارة عامة

8. **تحديث عنصر غير موجود يعيد 500** — `src/routes/admin.js` ✅
   كانت `PUT /registrations/:id` و `PUT /help-requests/:id` تستدعيان `prisma.update` مباشرة فتتعثر بـ `P2025` (500). الحل: فحص مسبق بـ `findUnique` وإرجاع `ApiError(404)` برسالة عربية واضحة.

9. **سجل حضور بتلاميذ خارج القسم** — `src/routes/attendance.js` ✅
   كان يمكن حفظ حضور لأي `studentId` في `records` ولو لم يكن من طلاب القسم. الحل: عند الحفظ يُتحقق أن كل `studentId` في سجل قيد القسم (منطقة الأستاذ) وإلا `ApiError(400)` «بعض التلاميذ غير مسجلين في هذا القسم».

### الدفع التجريبي (HIGH)

10. **محاكاة نتيجة DEMO بلا مصادقة** — `src/routes/payments.js` (`/demo-checkout/:intentId/result`) ✅
    النقطة كانت مفتوحة لأي شخص: بمعرفة معرّف نية دفع (أعداد تسلسلية) يستطيع أي زائر POST بنتيجة `success` فيُفعَّل الاشتراك مجاناً. الحل:
    - أضيف `authMiddleware` على المسار + فحص ملكية: يجب أن يكون `intent.userId === req.user.id` (أو دور إداري/نظامي) وإلا `403` «ليست لك صلاحية إتمام هذه العملية».
    - صفحة الدفع التجريبية ترسل الآن توكن الجلسة (`Authorization: Bearer`) من `localStorage` عند إتمام أي نتيجة، مع رسالة خطأ واضحة عند فشل المعالجة.
    - يُحدَّث سكوب Swagger للمسار.

### الواجهة (Frontend)

11. **نافذة مغلقة تحجب النقرات** — `src/components/ui/Modal.jsx` + `components.css` ✅
    كان overlay النافذة المغلقة يبقى شفافاً فوق الصفحة فيمنع النقر على أي عنصر خلفه. الحل: إضافة كلاس `.ui-modal-hidden` (`opacity:0; pointer-events:none; visibility:hidden`) يُطبَّق عند الإغلاق، مع ضبط `aria-hidden` وإنشاء `titleId` فريد عبر `useId`، ونقرة خارجية لا تعمل إلا عندما تكون النافذة مفتوحة.

12. **زر Login/Register بعرض جزئي** — `src/components/ui/Button.jsx` ✅
    كانت خاصية `block` (عرض كامل) تُمرَّر إلى `rest` ثم إلى عنصر `<button>` كخاصية HTML خاطئة. الحل: استخراج `block` من `rest` وضم `SIZES.block` إلى الأصناف.

13. **تحديث التطبيق لا يصل للمتصفحات القديمة** — `public/sw.js` + `src/main.jsx` ✅
    كان `CACHE_NAME` ثابتاً فيبقى index.html القديم مخزّناً بعد النشر، والملاحة في الـ SW كانت cache-first. الحل: `rafiqi-cache-v2` + ملاحة network-first مع cache fallback على `/index.html` + معالجة `message` لـ SKIP_WAITING + في `main.jsx` الاستماع لـ `updatefound` وإرسال SKIP_WAITING وإعادة التحميل مرة واحدة عند `controllerchange`.

14. **ألوان غير موجودة في الثيم** — `src/styles/components.css` ✅
    `.live-dot` استخدم `--success`/`--danger` غير المعرّفة في `tokens.css`. الحل: استبدالها بـ `var(--green)`/`var(--red)`.

15. **تحويل مفاتيح التبديل معكوس** — `src/styles/components.css` ✅
    كانت `translateX(20px)` للـ LTR و `translateX(-20px)` للـ RTL بينما الاتجاه الصحيح معكوس (التبديل نحو اليسار في RTL). الحل: `translateX(20px)` في RTL و `translateX(-20px)` في LTR.

16. **أسئلة FAQ بلا إمكانية وصول** — `src/pages/Home.jsx` ✅
    كانت أسئلة شائعة `<div>` قابلة للنقر (لا تفيد لوحة المفاتيح/قارئ الشاشة) بلون ثابت `#555`. الحل: `<button type="button">` مع `aria-expanded`/`aria-controls`، ولون `var(--muted)`، وقسم الإحصاءات يستخدم `var(--gradient-brand)` بدل تدرّج صلب.

17. **متغير تصميم ميت** — `src/styles/tokens.css` ✅
    حذف `--header-height: 0px` (غير مرجع في أي مكان).

## الاختبارات الجديدة (12)

- `review-phases12.test.js` (10 اختبارات):
  - `config.js` يرفض التحميل عند غياب `JWT_SECRET` (خطأ `Missing required environment variable`).
  - `PUT /admin/registrations/999999` و `PUT /admin/help-requests/999999` → 404 برسالة عربية (بدل 500).
  - الأستاذ لا يرى `subscriptions` في `/api/students` بينما يراها الولي.
  - حفظ حضور لتلميذ غير مسجل في القسم → 400.
  - قائمة/تفاصيل اختبار التلميذ لا تحتوي `correctOption`/`correctAnswer`/`orderItems`.
  - تلميذ لا يصل لاختبار قسم آخر → 404 (IDOR).
  - إنشاء اختبار بلا أسئلة → 400 «يجب إضافة سؤال واحد على الأقل».
- `payments.test.js` (اختباران):
  - محاكاة نتيجة DEMO دون تسجيل دخول → 401 وتظل النية `PENDING`.
  - مستخدم لا يملك الاشتراك → 403 وتظل النية `PENDING`.

## نتائج التحقق

| البند | الحالة |
|---|---|
| `npm test` (backend) | ✔ **158/158** (146 سابقة + 12 جديدة) — 14 ملفاً |
| `npm run lint` (backend) | ✔ 0 أخطاء (تنبيهات سابقة فقط) |
| `npm run build` (frontend) | ✔ ناجح |
| `npx eslint` (ملفات frontend المعدّلة) | ✔ 0 أخطاء (تنبيهات سابقة فقط) |

## ملاحظات

- لم تُلمس الاتفاقات العامة للـ API — كل الإصلاحات تمنع سلوكيات خاطئة أو تسريبات.
- عُدّلت مساعدة الاختبار في `tests/payments.test.js` و`tests/subscriptions-invoices.test.js` و`tests/finance-dashboard.test.js` لتمرير توكن المالك إلى مسار نتيجة DEMO (نتيجة إصلاح البند 10).
- بقي `PENDING_FIXES.md` يشير إلى أن مراجعة المرحلتين 1+2 معلّقة؛ هذه الوثيقة تُنهي البند.
