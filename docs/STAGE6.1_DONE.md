# المرحلة 6.1 — بنية الدرس التفاعلي (مكتملة)

تاريخ الإتمام: 16-08-2026
الحالة: **مكتملة** — قالب درس موحّد + عارض عام يعملان بكل أنواع البلوكات، وكل محتوى المنهج (رياضيات/قراءة/إيقاظ علمي) يصل للتلميذ بلا فقدان.

---

## ما كانت عليه الحالة عند المراجعة السداسية

- مكوّن `frontend/src/components/LessonViewer.jsx` يعرض الدروس عبر
  `GET /api/public/curriculum/books/:gradeId/:subjectId/lessons`.
- الأنواع المدعومة: `objective` / `concept` / `definition` / `example` / `note` / `question`.
- اختبارات: `backend/tests/curriculum.test.js` (5 اختبارات).
- **ثغرة رئيسية**: محتوى الإيقاظ العلمي (س1) يُفقد جزئياً — 76 صفحة بلا أي بلوكات
  (تجارب، خلاصات، مكافآت، أغلفة)، وأسئلة الاختيار كانت تفقد خياراتها وإجاباتها.

## الثغرات المغلقة (3/3)

### 1. محتوى الإيقاظ العلمي الضائع — `backend/src/services/curriculumService.js`

كان `adaptScienceBook()` يعالج فقط: `lesson`/`observe`/`fact`/`vocab`/`activity`/`quiz`.
وكان يتجاهل الصامت أنواعاً كاملة:

| النوع في `science-book.json` | العدد | قبل | بعد |
|---|---|---|---|
| `cover` (غلاف) | 19 | صفحة فارغة | يتخطّى الغلاف |
| `experiment` (جرّب بنفسك) | 19 | ضائع | كتلة `experiment` بأدوات+خطوات |
| `summary` (خلاصة الوحدة) | 19 | ضائع | كتلة `summary` بنقاط |
| `reward` (أحسنت) | 19 | ضائع | كتلة `reward` تحفيزية |

النتيجة: **298 درساً في الإيقاظ العلمي، 0 صفحة فارغة**.

### 2. خيارات وإجابات MCQ مفلطحة

كانت الخيارات تُدمج في النص: `(العين / الأذن / القدم)`، وحقل `answer` (index) يُحذف.
الآن تُمرَّر `options` + `answer` كما هي في الكتلة — زر «تحقّق» يعمل فعلياً.
(أسئلة أنيسي بلا مفاتيح إجابة في المصدر تبقى خيارات عرض دون تحقّق.)

### 3. العارض لا يعرف الأنواع الغنية — `frontend/src/components/LessonViewer.jsx`

- كتل جديدة: `experiment` (أدوات + خطوات مرقمة)، `summary` (قائمة نقاط)، `reward` (بطاقة تحفيز).
- أسئلة الاختيار تقبل الإجابة بنوعين:
  - **رقم (index)** كما في الإيقاظ العلمي: `answer: 0` ← الخيار الأول.
  - **نص** مطابق لأحد الخيارات.
- بطاقة MCQ بلا إجابة لا تعرض زر «تحقّق» (لا توجد إجابة صحيحة جاهزة).

## الملفات المعدّلة

| الملف | التغيير |
|---|---|
| `backend/src/services/curriculumService.js` | `adaptScienceBook()`: تخطّي الأغلفة + كتل `experiment`/`summary`/`reward` + تمرير `options`/`answer` |
| `backend/src/services/curriculumService.js` | `adaptAnisiLessons()`: تمرير `options` و `answers[0]` عند توفرهما |
| `frontend/src/components/LessonViewer.jsx` | عرض الكتل الغنية + قبول إجابة index/text |
| `frontend/src/index.css` | بطاقات `experiment`/`summary`/`reward` |
| `backend/tests/curriculum.test.js` | +2 اختبارات (لا صفحات فارغة، كل MCQ يحمل إجابة صالحة) |

## التحقق

| البند | النتيجة |
|---|---|
| اختبارات backend | ✔ **165/165** (15 ملفاً — أُضيف اختباران للمناهج) |
| `vite build` (frontend) | ✔ ناجح |
| ESLint | ✔ 0 أخطاء (تنبيهات سابقة فقط) |
| API حيّ | ✔ `/curriculum/books/year1/science/lessons` → 298 درساً، أنواع: concept/example/experiment/keyword/note/question/reward/summary |
| رياضيات س2/س6 | ✔ 63/61 درساً بلا صفحات فارغة |
