# توثيق حالة العمل — المرحلة 1 (الأساسات الهندسية)

> **منصة**: بوابة رفيقي للحياة المدرسية
> **المرحلة المنفّذة**: المرحلة 1 فقط من خارطة الطريق (7 مراحل)
> **تاريخ التوثيق**: 2026-08-14
> **هذا الملف**: دليل لمواصلة العمل في جلسة أخرى دون فقدان السياق.

---

## 0. سجل الجلسات (الأحدث أولاً)

### الجلسة 3 (2026-08-14) — النصف الثاني من سدّ فجوة Validation: 10 مسارات (اكتمال المرحلة 1)

**المُنجز في هذه الجلسة:**
- Validators جديدة في `backend/src/validators/`: `messages.js`، `parentDocument.js`، `superadmin.js`، `director.js`، `teacher.js`، `teacherContent.js`، `teacherPlans.js`، `classSubject.js`، `submittedExam.js`، `ai.js`.
- 10 مسارات عُيدت هيكلتها إلى `validateBody/validateParams/validateQuery` + `asyncHandler` + `ApiError` + توثيق Swagger:
  `messages.js`، `parentDocuments.js`، `superadmin.js`، `director.js`، `teacher.js`، `teacherContent.js`، `teacherPlans.js`، `classSubjects.js`، `submittedExams.js`، `ai.js`.
- `backend/src/swagger.js`: أُضيفت 10 tags جديدة (messages، parent-documents، superadmin، director، teacher، teacher-content، teacher-plans، class-subjects، submitted-exams، ai) → **العدد الكلي للمسارات الموثّقة: 130**.
- إزالة ثوابت مكررة: `VALID_SUBJECTS` في `teacher.js` و`submittedExams.js` (التحقق أصبح عبر zod enum).
- معالجة رسائل استثناءات الخدمات (`NO_AI_KEY`) عبر `ApiError` بدل `res.status(...)` اليدوي.
- التحقق: `npm run lint` (0 أخطاء) + `npm test` (29/29 ناجح) + تشغيل الخادم والتحقق من `/api-docs` (130 path) + اختبار حي للتحقق من الأخطاء (quiz/plan/message/ai key/تلميذ غير موجود/صلاحية).

**الحالة النهائية للمرحلة 1**: **مكتملة بالكامل** — جميع مسارات الـ 24 معاد هيكلتها بطبقة Validation موحدة وموثّقة في Swagger.

### الجلسة 2 (2026-08-14) — النصف الأول من سدّ فجوة Validation: 10 مسارات

**المشكلة المكتشفة في الجلسة 1**: وثيقة الجلسة السابقة ادّعت الإنجاز الكامل للمرحلة 1، لكن الفحص كشف أن 20 مساراً من أصل 24 كانت بلا Validation موحّد (4 فقط كانت معادلة مسبقاً: auth، subscriptionRequests، finance، attendance).

**قرار**: تقسيم ما تبقى من المرحلة 1 إلى جلستين (المستخدم مريض). هذه الجلسة = **النصف الأول** (10 مسارات الأبسط/الأقل تداخلاً).

**المُنجز في هذه الجلسة:**
- Validators جديدة في `backend/src/validators/`: `common.js` (idParamSchema، dateStringSchema، calendarEventsQuerySchema، optionalText) + `registration.js` + `student.js` + `admin.js` + `helpRequest.js` + `calendar.js` + `health.js` + `playZone.js`.
- 10 مسارات عُيدت هيكلتها إلى `validateBody/validateParams/validateQuery` + `asyncHandler` + `ApiError` + توثيق Swagger:
  `registrations.js`، `students.js`، `admin.js`، `helpRequests.js`، `calendar.js`، `health.js`، `parent.js`، `playZone.js`، `public.js`، `curriculum.js`.
- `backend/src/swagger.js`: أُضيفت tags جديدة (registrations، students، admin، help-requests، calendar، health، parent، play-zone، curriculum) → العدد الكلي للمسارات الموثّقة: **50**.
- إصلاح خطأي بناء في `routes/parent.js` (أقواس `asyncHandler` ناقصة في `/children/progress` و`/teacher-list`) + إزالة استيراد `ApiError` غير مستخدم في `helpRequests.js`.
- رسائل zod نوعية عربية بدل الإنجليزية الافتراضية (في `registration.js` و`helpRequest.js`).
- التحقق: `npm run lint` (0 أخطاء) + `npm test` (29/29 ناجح) + تشغيل الخادم والتحقق من `/api-docs` (50 path) والاستجابة الفعلية (400 عربي مع قائمة أخطاء الحقول، 201 للمدخلات الصحيحة).

**المتبقي للجلسة القادمة (النصف الثاني — 10 مسارات):**
~~`messages.js`، `parentDocuments.js`، `superadmin.js`، `director.js`، `teacher.js`، `teacherContent.js`، `teacherPlans.js`، `classSubjects.js`، `submittedExams.js`، `ai.js`.~~

> **أُنجز في الجلسة 3 — انظر أعلاه.**

**خطوات الجلسة القادمة:**
1. ~~إعادة هيكلة المسارات العشرة المتبقية~~ ✅ (الجلسة 3)
2. ~~إنشاء validators جديدة~~ ✅ (الجلسة 3)
3. ~~إضافة tags جديدة~~ ✅ (الجلسة 3)
4. ~~`npm run lint` + `npm test`~~ ✅ (الجلسة 3)
5. ~~تحديث هذا الملف نهائياً~~ ✅ (الجلسة 3)
6. ~~Commit + توزيع zip محدّث~~ ✅ (الجلسة 3)

---

## 1. روابط المصدر الأصلي

- ملف المشروع الكامل (المصدر): `https://drive.google.com/file/d/11CsMMOur94VQG4BEN9pswU4H1cj0DJO_/view?usp=sharing`
- خارطة طريق التحسينات (وثيقة ورد): `https://docs.google.com/document/d/1S-xCvT6Aa132-XPrZHrJnDokL_Sbr2sn/edit?usp=sharing`
- **المرحلة المطلوبة: المرحلة الأولى فقط (الأساسات الهندسية)** — الميزانية التقديرية ~1M توكن.

---

## 2. ما تم إنجازه في المرحلة 1

### 2.1 نظام Migrations (بدل prisma db push)
- تم إنشاء أول migration رسمي: `backend/prisma/migrations/20260814160830_init/migration.sql`
- ملف قفل: `backend/prisma/migrations/migration_lock.toml`
- `start.sh` الآن يستخدم `npx prisma migrate deploy` بدل `prisma db push --force-reset`.
- أوامر جديدة في `backend/package.json`: `prisma:deploy`, `prisma:migrate`.

### 2.2 طبقة Validation موحدة (zod v4)
- `backend/src/middleware/validate.js` — وسيط `validate(body|query|params)` + `ValidationError` + `formatZodError`.
- مخططات التحقق:
  - `backend/src/validators/auth.js` (register/login)
  - `backend/src/validators/subscription.js` (طلب اشتراك، دفع، معرف)
  - `backend/src/validators/attendance.js` (حفظ حضور، معرّف قسم، استعلام)
- المسارات المعاد هيكلتها لاستخدامها: `routes/auth.js`, `routes/subscriptionRequests.js`, `routes/finance.js`, `routes/attendance.js`.
- ملاحظة: `.strict()` أُزيلت من المخططات لضمان عدم كسر API الحالي (قبول الحقول الإضافية).

### 2.3 وسطاء أخطاء موحّد + رسائل عربية
- `backend/src/middleware/errorHandler.js` — `ApiError`, `notFoundHandler`, `errorHandler`, `asyncHandler`.
- `backend/src/middleware/messages.js` — قاموس رسائل عربية موحدة (`AR.*`).
- استجابة الخطأ الموحدة: `{ error, details?, errors? }`.
- `backend/src/index.js` الآن يستخدم `notFoundHandler` + `errorHandler` بدل الـ middleware اليدوي القديم.

### 2.4 توثيق API تلقائي (Swagger/OpenAPI)
- `backend/src/swagger.js` — تعريف OpenAPI 3.0 + مخططات.
- المسارات الموثّقة بوسوم JSDoc: auth, subscription-requests, admin/subscriptions, attendance + (الجلسة 2) registrations, students, admin, help-requests, calendar, health, parent, play-zone, curriculum, public + (الجلسة 3) messages, parent-documents, superadmin, director, teacher, teacher-content, teacher-plans, class-subjects, submitted-exams, ai → **130 مساراً**.
- نقطة الوصول: `http://localhost:3001/api-docs`.

### 2.5 إزالة الأسرار + .env.example
- `backend/.env.example` — ملف موثّق لكل الخيارات (DATABASE_URL, JWT_SECRET, AI_ENC_KEY, PORT, NODE_ENV, RATE_LIMIT_*, BODY_LIMIT, UPLOAD_DIR).
- `backend/src/config.js` — قراءة مركزية للمتغيرات مع إجبار المطلوب منها.
- أُزيلت الأسرار المضمّنة من:
  - `src/auth.js` → `config.jwtSecret`
  - `src/ws.js` → `config.jwtSecret`
  - `src/services/aiService.js` → `process.env.JWT_SECRET || ''` + `AI_ENC_KEY`

### 2.6 اختبارات (vitest + supertest)
- `backend/vitest.config.js` + `backend/tests/setup.js` + `backend/tests/globalSetup.js`
- `backend/tests/helpers.js` — إعادة تهيئة قاعدة الاختبار + بذر بيانات تجريبية + تسجيل دخول.
- ملفات الاختبار: `tests/auth.test.js` (10), `tests/subscription.test.js` (11), `tests/attendance.test.js` (8) = **29 اختباراً ناجحاً**.
- قاعدة اختبار منفصلة: `school_platform_test` (لا تمسّ قاعدة التطوير).

### 2.7 CI/CD (GitHub Actions)
- `.github/workflows/ci.yml` — يثبّت Postgres 15 كخدمة، يثبّت التبعيات، prisma generate + migrate deploy، lint للخلفية والواجهة، build الواجهة، ثم `npm test`.

### 2.8 Docker Compose
- `docker-compose.yml` — خدمات: postgres (15) + api + web.
- `backend/Dockerfile` + `frontend/Dockerfile` + `.dockerignore` لكل منهما.
- `api` يشغّل `prisma migrate deploy` ثم `seed` ثم `node src/index.js`.

---

## 3. بنية الملفات الجديدة/المعدّلة

| الملف | الحالة |
|---|---|
| `backend/prisma/migrations/` | جديد (نظام الهجرات) |
| `backend/src/middleware/validate.js` | جديد |
| `backend/src/middleware/errorHandler.js` | جديد |
| `backend/src/middleware/messages.js` | جديد |
| `backend/src/config.js` | جديد |
| `backend/src/swagger.js` | جديد |
| `backend/src/validators/` (auth, subscription, attendance, common, registration, student, admin, helpRequest, calendar, health, playZone) | جديد |
| `backend/src/validators/` (messages, parentDocument, superadmin, director, teacher, teacherContent, teacherPlans, classSubject, submittedExam, ai) | جديد (الجلسة 3) |
| `backend/tests/` (auth, subscription, attendance, helpers, setup, globalSetup) | جديد |
| `backend/vitest.config.js` | جديد |
| `backend/.env.example` | جديد |
| `backend/eslint.config.js` | جديد |
| `frontend/eslint.config.js` | جديد |
| `.github/workflows/ci.yml` | جديد |
| `docker-compose.yml` + `backend/Dockerfile` + `frontend/Dockerfile` + `.dockerignore` | جديد |
| `backend/src/index.js` | معدّل (swagger + error handler + config) |
| `backend/src/auth.js` | معدّل (رسائل موحدة + config) |
| `backend/src/ws.js` | معدّل (config.jwtSecret) |
| `backend/src/routes/auth.js` | معدّل (zod + asyncHandler + ApiError) |
| `backend/src/routes/subscriptionRequests.js` | معدّل (zod + asyncHandler) |
| `backend/src/routes/finance.js` | معدّل (zod + asyncHandler) |
| `backend/src/routes/attendance.js` | معدّل (zod + asyncHandler) |
| `backend/src/routes/registrations.js` | معدّل (الجلسة 2 — النصف الأول) |
| `backend/src/routes/students.js` | معدّل (الجلسة 2 — النصف الأول) |
| `backend/src/routes/admin.js` | معدّل (الجلسة 2 — النصف الأول) |
| `backend/src/routes/helpRequests.js` | معدّل (الجلسة 2 — النصف الأول) |
| `backend/src/routes/calendar.js` | معدّل (الجلسة 2 — النصف الأول) |
| `start.sh` | معدّل (migrate deploy بدل db push) |
| `.gitignore` | معدّل (استثناء uploads/assets/books) |

---

## 4. أوامر التشغيل والتحقق

```bash
# تشغيل كامل (سكربت تلقائي)
cd /workspace && ./start.sh

# الخادم فقط
cd backend && node src/index.js          # → http://localhost:3001
# التوثيق:  http://localhost:3001/api-docs

# الواجهة
cd frontend && npm run dev               # → http://localhost:5173

# الاختبارات (تتطلب PostgreSQL محلياً + قاعدة school_platform_test)
cd backend && npm test

# Lint
cd backend && npm run lint
cd frontend && npm run lint

# Migrations
cd backend && npx prisma migrate deploy
```

### قاعدة البيانات
- تطوير: `postgresql://school_user:school_pass@localhost:5432/school_platform`
- اختبار: `postgresql://school_user:school_pass@localhost:5432/school_platform_test`
- ملاحظة: مستخدم `school_user` يحتاج صلاحية `CREATEDB` لتشغيل migrations (shadow database).
- ملاحظة مهمة للاختبارات: `tests/helpers.js::resetDatabase` يستثني `_prisma_migrations` من `TRUNCATE` وإلا تفشل الهجرات لاحقاً.

### حسابات تجريبية
| الدور | البريد | كلمة السر |
|---|---|---|
| نظامي | super@education.tn | super123 |
| مدير عام | admin@education.tn | admin123 |
| مدير مدرسة | director@test.tn | director123 |
| أستاذ | teacher@test.tn | teacher123 |
| ولي | parent@test.tn | parent123 |
| تلميذ | student@test.tn | student123 |

---

## 5. معايير قبول المرحلة 1 — الحالة

| المعيار | الحالة |
|---|---|
| `npm test` يمر بالكامل | ✅ 29/29 |
| `docker compose up` يشغّل المشروع | ✅ (ملفات جاهزة — تحتاج Docker محلياً للتحقق العملي) |
| لا أسرار في الريبو | ✅ (فُحصت `grep school-platform-secret-key` في src → لا نتائج؛ `.env` في `.gitignore`) |
| Migration رسمية بدل db push | ✅ |
| Validation موحدة للمسارات الحرجة | ✅ **24/24 مساراً** — اكتملت في الجلسة 3 |
| وسطاء أخطاء موحّد + رسائل عربية | ✅ |
| Swagger/OpenAPI | ✅ |
| .env.example موثّق | ✅ |
| CI/CD | ✅ |
| Docker Compose | ✅ |

---

## 6. قواعد عمل ملزمة للمراحل القادمة (من خارطة الطريق)

- **لا كسر للـ API الحالي** — أي تغيير موثّق ويعالج التوافق.
- لا أسرار أو مفاتيح في الكود أو الريبو.
- كل ميزة جديدة مقرونة باختبارات ومعايير قبول.
- المراحل لا تُدمج قبل استيفاء معايير القبول.
- أي عملية حذف تتطلب تأكيداً مسبقاً.
- الالتزام بالأدوار الستة مع أقل صلاحية ممكنة.
- **بعد كل مرحلة**: يجب تقديم رابط تحميل ملف المشروع الكامل المحدّث (zip) لتجنّب ضياع المحادثة.

---

## 7. المراحل القادمة (لم تُنفّذ بعد — جاهزة للبدء في جلسة لاحقة)

> **المرحلة 1 مكتملة بالكامل** (الجلسة 3). الخطوة التالية: **المرحلة 2**.

- **المرحلة 2**: نظام التصميم والواجهة (Design System، Dark Mode، PWA، Mobile-First، A11y) — ~1.5-2M توكن.
- **المرحلة 3**: التكليفات المنزلية + التحليلات + التواصل — ~1-1.5M توكن.
- **المرحلة 4**: المدفوعات الإلكترونية — ~0.8-1.2M توكن.
- **المرحلة 5**: الحصص المباشرة + التواصل الفوري — ~1-1.5M توكن.
- **المرحلة 6**: المحتوى التعليمي التفاعلي — ~20-30M توكن (تُنفّذ على دفعات).
- **المرحلة 7**: الذكاء الاصطناعي — ~0.8-1.2M توكن + تكلفة API.

ترتيب التنفيذ المقترح: الدفعة 1 (المرحلتان 1+2)، الدفعة 2 (3+5)، الدفعة 3 (4)، الدفعة 4 (6)، الدفعة 5 (7).

---

## 8. تحذيرات وملاحظات تقنية

1. **Docker**: `docker-compose.yml` يستخدم `volumes` (pgdata, uploads) — عند أول تشغيل ينشئ المجلدات تلقائياً. بيئة التطوير الحالية لا تحتوي Docker، فلم يُجرَّب عملياً هناك.
2. **zod v4**: تثبيت `zod@^4.4.3` — صياغة الرسائل عبر `{ error: '...' }` وليس `{ message: '...' }`، والحقول عبر `issues` وليس `errors` (تمت معالجة كليهما في `formatZodError`).
3. **uploads**: مجلد `backend/uploads/assets/books` (191MB) مستثنى من git؛ عند توزيع المشروع تأكد من نسخه إذا كانت الكتب التفاعلية مطلوبة وقت التشغيل.
4. **AI_ENC_KEY**: إذا تغيّرت قيمته بعد تخزين مفاتيح Gemini القديمة في `AiKey` فلن تُفك تشفيرها (اختياري للتطوير).
