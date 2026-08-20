# المرحلة 7.5 — نظام مذكرات المعلم حسب بروفايلات المنهجية (بلا ذكاء اصطناعي)

تاريخ الإتمام: 17-08-2026
الحالة: **مكتملة** — توليد مذكرة الدرس رسمياً من BookContent وفق 9 بروفايلات منهجية رسمية، حتمي وقابل للمشاركة، دون أي استدعاء ذكاء اصطناعي.

---

## النطاق

تحويل مذكرة المعلم من النظام القديم (Gemini) إلى **مولّد محلي حتمي** يستخرج
المذكرة حصرياً من بروفايل المنهجية (`curriculum/shared/methodologies/`) +
محتوى الكتاب المدرسي (`BookContent`). نفس الدرس يولّد نفس المذكرة دائماً
(مفتاح `bookId_lessonId`)، ولا يُختلق أي محتوى خارج المصدرين.

بموجب قاعدة **«لا نختلق محتوى»**: إن لم يوجد كتاب أو لم توجد منهجية معرّفة،
يُرفض التوليد برسالة عربية صريحة (NO_BOOK / NO_METHODOLOGY / LESSON_NOT_FOUND).
النظام القديم محفوظ للتراث وسجل إحصاءات المدير؛ المسار الجديد منفصل تماماً.

## ما أُنجز

### 1. نموذج `LessonMemo` — `backend/prisma/schema.prisma`

جدول جديد منفصل عن `Memo` القديم: `bookId/lessonId/subject/level/methodologyId/content/createdById`
مع `@@unique([bookId, lessonId])` (حتمية + مشاركة) و`@@index([createdById])`.
هجرة `20260817044014_lesson_memos`، وعلاقة `lessonMemos` في `User`.

### 2. قلب اختيار المنهجية — `backend/src/services/methodologyResolver.js` (جديد)

- `RULES`: 9 قواعد (س1 رياضيات/قراءة/إيقاظ علمي/إنتاج كتابي، س2 قراءة/إيقاظ علمي/إنتاج كتابي،
  س4 رياضيات، تواصل شفهي).
- `normalizeSubject` (توحيد الهمزات/ال/اللواحق) و`extractYear` (مطابقة متساهلة للسنة).
- `resolveMethodology` → خطأ `MethodologyError` برمزَي `AMBIGUOUS_METHODOLOGY`/`NO_METHODOLOGY`.

### 3. المستودع — `backend/src/repositories/lessonMemos.js` (جديد)

`findByLesson` / `findById` / `listForTeacher` / `create` / `upsert` / `delete`.
مفتاح التخزين `bookId_lessonId` هو نفسه مفتاح الحتمية.

### 4. الخدمة — `backend/src/services/lessonMemoService.js` (جديد)

- `resolveBook`: مطابقة مادة/سنة من `registry.json` مع `findGradeLenient`.
- `findLesson`: بحث درس بالعنوان داخل صفحات الكتاب (يمرر gradeId).
- `buildHeader/buildPhases/buildTable/buildDomainNotes`: بناء المذكرة من البروفايل
  (العنوان، الحضور، المراحل/بنك التهيئة، جدول المراحل، ملاحظات المجال).
- `injectLessonContent`: حقن المحتوى الرسمي الحقيقي (النص/الحرف/المحور/التمارين)
  في المراحل المناسبة بدل النصوص العامة.
- `generateMemo`/`rebuildMemo` + `MemoBuildError` برموز NO_BOOK/LESSON_NOT_FOUND/NO_METHODOLOGY.
- `hash = md5(bookId|lessonId|methodologyId)`.

### 5. المسارات — `backend/src/routes/memos.js` + `backend/src/validators/memos.js` (جديد)

| المسار | الدور | الوصف |
|--------|-------|--------|
| `GET /api/memos/methodologies` | معلم | بروفايلات المنهجية الرسمية (9) |
| `POST /api/memos/generate` | معلم | توليد/استرجاع المذكرة (`cached` يشير للمصدر) |
| `POST /api/memos/rebuild` | معلم | إعادة البناء من جديد |
| `GET /api/memos` | معلم | قائمة مذكراته مع ترقيم صفحات |
| `DELETE /api/memos/:id` | معلم | حذف مذكرة (المنشئ أو مسؤول) |
| `GET /api/memos/:id` | معلم | جلب مذكرة بمفردها |

مُسجّل في `backend/src/index.js` عبر `app.use('/api/memos', memoRoutes)`.

### 6. سكريبت فحص يدوي — `backend/src/scripts/test-memo-generation.js` (جديد)

`node src/scripts/test-memo-generation.js <مادة> <سنة> <درس>` للتحقق السريع من التوليد والحفظ.

### 7. الواجهة — `frontend/src/pages/teacher/Memos.jsx` (إعادة كتابة)

- قوائم تفاعلية (مستوى/مادة/درس) مع `datalist` عبر
  `/public/curriculum/books/:gradeId/:subjectId/lessons`.
- عرض بروفايل المنهجية + بنك التهيئة + المراحل + الجدول (المراحل/نشاط المعلّم/نشاط المتعلّم/الملاحظات).
- زر طباعة (CSS `.print-section`) وزر «إعادة بناء».
- إضافة `.form-info/.memo-notes/.memo-header-table` في `frontend/src/index.css`.

## التحقق

- **الاختبارات**: `279/279` خضراء (266 سابقة + 13 جديدة في `tests/lesson-memo.test.js`):
  - 401 بدون توكن، 400 لنقص الحقول، 9 بروفايلات، توليد رياضيات/قراءة/إيقاظ علمي س1
    مع تحقق من بروفايل المنهجية والمحتوى الحقيقي، `cached=true` عند التكرار،
    رفض NO_METHODOLOGY (س2) وNO_BOOK (إنتاج كتابي س1)، 404 لدرس غير موجود،
    rebuild، list/delete، وتوحيد «الإيقاظ العلمي».
- **ESLint backend**: 0 أخطاء، 0 تحذيرات جديدة.
- **البناء**: `vite build` ناجح.
- **فحص مباشر (smoke)**: توليد/استرجاع/إعادة بناء/حذف عبر HTTP مع توكن معلم،
  ورسالتا الخطأ العربيتان NO_METHODOLOGY وNO_BOOK صحيحتان.
