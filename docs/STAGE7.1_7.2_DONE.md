# المرحلة 7.1/7.2 — رفيقي الذكي (AI Tutor) + مساعد الأستاذ (AI Assistant)

تاريخ الإتمام: 17-08-2026
الحالة: **مكتملة** — محادثة ذكية سياقية للتلميذ (7.1) وتوليد محتوى بيداغوجي للأستاذ (7.2).

---

## قرار النطاق

الدفعتان 7.1 و7.2 (`docs/PHASES_SPLIT.md`) تنصان على:

- **7.1 — AI Tutor للتلميذ**: روبوت محادثة (سؤال ← شرح مبسط ← تصحيح) مرتبط بمحتوى المنهج.
- **7.2 — AI Assistant للأستاذ**: توليد خطط دروس، أسئلة، ملخصات، وشرائح عرض.

بموجب قاعدة المشروع **«لا نختلق محتوى»**:

- **سياق المحادثة والتوليد = محتوى المنهج الحقيقي** من قاعدة `curriculum/`
  (سنة/مادة/درس بعينه) — لا قوالب مختلقة ولا إجابات عامة.
- **مفتاح LLM يوفره صاحب المشروع** (تُقرأ `GEMINI_API_KEY` من بيئة الخادم أو
  من إعداد القسم عبر `saveAiKey`) — لا يُكتب أي مفتاح في الكود أو الريبو.
- **بدون مفتاح**: يعود النظام لسلوك احتياطي واضح للتلميذ، ورسالة خطأ مبسطة للأستاذ.
- أُنجزت 7.1 و7.2 معاً في دفعة واحدة (يشتركان في البنية التحتية نفسها).

## ما أُنجز

### 1. إصلاح مسبق — طول مفتاح AES في `backend/src/services/aiService.js`

`callGemini` كان يستعمل `slice(0, 32)` من hex المفتاح → مفتاح 16 بايت لـ AES-256-GCM
(يُرمي `RangeError: Invalid key length`)؛ صُحّح إلى `slice(0, 64)` (32 بايت) —
بدونه كان `saveAiKey` يفشل فعلياً.

### 2. الخدمة — `backend/src/services/aiService.js`

- `__setCallProvider` / `__resetCallProvider`: حقنة مزوّد للاختبارات (بدون طلبات شبكة حقيقية).
- `resolveLessonContext({gradeId, subjectId, lessonId})`: يستخرج محتوى درسٍ بعينه من المنهج
  (يقبل المستوى/السنة أو معرف المادة/الدرس) عبر `lessonTextOf`.
- `chatRefeeqiWithContext(prompt, gradeId?, subjectId?, lessonId?)`: محادثة مراعية
  لسياق التلميذ (مستواه، مادته، وموضوع درسه) مع تعليمات الأسلوب المبسّط «رفيقي».
- `generateLessonPlan({subject, level, lessonTitle, objectives, duration})`.
- `generateSummary({subject, level, lessonTitle})`.
- `generatePresentation({subject, level, lessonTitle, slides})`.
- `extractJson(text)`: يستخرج كتلة JSON من استجابة المزوّد (إزالة فواصل markdown).

### 3. المخططات — `backend/src/validators/ai.js`

- `aiChatSchema` امتد بـ `gradeId/subjectId/lessonId` الاختيارية.
- `aiLessonPlanSchema`، `aiSummarySchema`، `aiPresentationSchema` (تحقق Zod).

### 4. النقاط الجديدة في `backend/src/routes/ai.js`

| المسار | الدور | الحماية |
|---|---|---|
| `POST /api/ai/chat` | محادثة رفيقي (تقبل سياق درس اختياري) | تلميذ/ولي/أستاذ |
| `GET /api/ai/student/tutor-context` | مستوى التلميذ + مواده + قائمة دروسه (للتلميذ فقط) | تلميذ |
| `POST /api/ai/generate-lesson-plan` | خطة درس كاملة | أستاذ |
| `POST /api/ai/generate-summary` | ملخص درس | أستاذ |
| `POST /api/ai/generate-presentation` | شرائح عرض | أستاذ |

- مساعد `levelToCurriculumTitle` يحوّل «السنة الأولى أساسي» (تسمية DB) إلى
  «السنة الأولى ابتدائي» (تسمية المنهج) حتى يتطابق بحث الدروس.

### 5. واجهة المستخدم

- **`frontend/src/pages/student/AskRefeeqi.jsx`**: أُعيدت كتابتها — قائمتا
  مادة ثم درس (من `tutor-context`)، حقل سؤال، وإشعار أن الرد «مبني على الدرس:
  …». تحافظ على منطق حفظ المحادثة الحالي في `studentChat`.
- **`frontend/src/pages/teacher/TeacherAI.jsx`**: أُعيدت كتابتها — تبويبات
  (خطة / أسئلة / ملخص / شرائح / قصة) + زر «حفظ كمورد» عبر
  `POST/PUT /api/teacher/resources` (LESSON_PLAN / PRESENTATION / WORKSHEET / HOMEWORK).
- **`frontend/src/index.css`**: أنماط `.ai-context-row`، `.ai-tabs/.ai-tab`.

## التحقق

| البند | النتيجة |
|---|---|
| اختبارات backend | ✔ **233/233** (30 ملفًا — أُضيف `ai.test.js` بـ 12 اختباراً) |
| `vite build` (frontend) | ✔ ناجح |
| ESLint (backend + frontend المعدّلة) | ✔ 0 أخطاء |
| API حيّ | ✔ `tutor-context` يعيد (سنة/مادة/دروس فعلية) · `generate-*` يرجع برسالة «لم يُضبط مفتاح» عند غيابه · `saveAiKey` ينجح (بعد إصلاح AES) |
| مبدأ المفاتيح | ✔ لا مفتاح في الكود؛ يُقرأ من بيئة الخادم أو إعداد القسم |

## اختبارات جديدة (12) في `backend/tests/ai.test.js`

1. `saveAiKey` يعيد الحالة ولا يُسرب قيمة المفتاح.
2. `GET /ai/key` بعد الحفظ يعيد `configured: true` مع `hasValue: false`.
3. `chat` بدون مفتاح يرجع الإجابة الاحتياطية (200).
4. `chat` مع `__setCallProvider` يمرر السياق للمزوّد ويُعيد ردّه.
5. `chat` يمرر سياق درس حقيقي (gradeId/subjectId/lessonId) للمزوّد.
6. `chat` يحفظ الحوار في `studentChat` ويُسجل XP.
7. `tutor-context` يتطلب تلميذاً (401 للأستاذ) ويعيد مستوى + مواد + دروس.
8. `generate-lesson-plan` يتطلب أستاذاً (401 للتلميذ).
9. `generate-lesson-plan` بدون مفتاح يرجع `لم يتم ضبط مفتاح Gemini بعد`.
10. `generate-lesson-plan` بمزوّد مزيف يُعيد `lessonPlan` ويُخزّنه في `TeachingResource`.
11. `generate-summary` يعمل بنفس النمط.
12. `generate-presentation` يعمل بنفس النمط.

## معايير القبول

- **7.1**: تلميذ يختار مادةً ودرساً فيسأل شرحاً → الرد مبنى على محتوى ذلك الدرس ✔
- **7.2**: أستاذ يولّد خطة درس / ملخص / شرائح بنقرة ويحفظها كمورد ✔

## ما لم يُنجز (مُرجأ)

- **7.3 — AI للولي + محرك التوقع**: تلخيص تقرير الابن + اقتراح أنشطة +
  محرك توقع التعثر المبكر (دفعة مستقلة بميزانيتها).
- **واجهة حصرية لضبط مفتاح Gemini** في لوحة الإدارة (متاح حالياً عبر
  `POST /api/ai/key` و`GEMINI_API_KEY` البيئية) — تُضاف عند الحاجة.
- **تدويل ردود المزوّد وتوثيق الـ citations** للمصادر المستخرجة من المنهج.
