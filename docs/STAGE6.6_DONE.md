# المرحلة 6.6 — ربط المحتوى بالتقدم والشارات

تاريخ الإتمام: 17-08-2026
الحالة: **مكتملة** — إتمام درس تفاعلي يمنح نقاط خبرة (XP) وشارات، مع سجل تقدم دائم لكل تلميذ.

---

## قرار النطاق

الدفعة 6.6 (`docs/PHASES_SPLIT.md`) تنص على ربط المحتوى بالتقدم والشارات،
مع «شارات للدروس المكتملة». بموجب قاعدة المشروع **«لا نختلق محتوى»** (نفس نهج 6.2-6.5):

- **مصدر التقدم = فعل حقيقي للتلميذ**: إتمام درس عبر زر «أنهيت الدرس» في عارض الدروس،
  يُسجَّل مرّة واحدة (idempotent) ولا يمكن مضاعفة نقاطه بإعادة الضغط.
- **شارات الدروس** تُزرع بشرط كمّي واضح (درس/10/50) فوق السجل الحقيقي
  `LessonProgress` — لا ميتاداتا مختلقة ولا شارات وهمية.
- **نقاط الخبرة** تُستثمر بنفس خدمة التلعيب الحالية (`awardXp` + سجل النشاط +
  نشاط يومي + فحص شارات) المثبتة في المراحل السابقة — لا نظام موازٍ.

## ما أُنجز

### 1. نموذج البيانات — `LessonProgress` (هجرة `20260817110000_lesson_progress`)

| الحقل | الوصف |
|---|---|
| `userId` / `gradeId` / `subjectId` / `lessonId` | التلميذ + الكتاب + الدرس (فريد مركّب → منع التكرار) |
| `lessonTitle` | نسخة من عنوان الدرس وقت الإتمام (للعرض السريع) |
| `completedAt` | تاريخ الإتمام (فهرس للفرز) |

### 2. الخدمة — `backend/src/services/progressService.js`

- `completeLesson(userId, {gradeId, subjectId, lessonId, lessonTitle})`:
  فحص سابق → إن وجد يُعيد `{ alreadyDone: true, xpAwarded: 0 }` (idempotent)؛
  وإلا يُنشئ السجل ثم `awardXp(5, 'LESSON')` + `registerDailyActivity` + `checkBadges`.
- `getProgress(userId, gradeId?, subjectId?)`: قائمة الدروس المكتملة + ملخص `bySubject`.
- `countLessonsCompleted(userId)`: العدد الكلي (يُستعمل في الملف الشخصي).

### 3. التلعيب — `backend/src/services/gamificationService.js`

- شرط شارة جديد **`LESSONS_COMPLETED`** في `checkBadges`: عدد سجلات `LessonProgress`
  للتلميذ ≥ القيمة.
- شارات جديدة في `backend/prisma/seed.js`:

| المفتاح | الاسم | الشرط |
|---|---|---|
| `first_lesson` | أول درس | 1 درس |
| `lessons_10` | عشرة دروس | 10 دروس |
| `lessons_50` | خمسون درساً | 50 درساً |

### 4. نقاط نهاية API (`/api/student` — مصادقة تلميذ)

- `POST /api/student/progress/lessons` — `{ gradeId, subjectId, lessonId, lessonTitle? }`
  → `{ progress, alreadyDone, xpAwarded, xp, level, leveledUp, newBadges }`.
- `GET /api/student/progress/lessons?gradeId&subjectId` — قائمة + ملخص حسب المادة.
- `GET /api/student/profile` — أضيف `stats.lessonsCompleted` (عبر `countLessonsCompleted`).

### 5. واجهة المستخدم

- **`frontend/src/components/LessonViewer.jsx`**: زر «أنهيت الدرس» (أخضر) في رأس صفحة
  الدرس يختفي بعد الإتمام ويُستبدل بشارة «مُنجز ✓»؛ تحميل التقدم المسبق عند فتح العارض؛
  إشعار منبثق (toast) يعرض «+XP» وأي شارات جديدة عند الإتمام.
- **`frontend/src/pages/student/StudentProfile.jsx`**: إحصائية «📚 N درساً مكتملاً» في بطاقة الملف.
- **`frontend/src/index.css`**: أنماط `btn-success`، `badge.ok`، `completion-toast`.

## التحقق

| البند | النتيجة |
|---|---|
| اختبارات backend | ✔ **221/221** (19 ملفًا — أُضيف `progress.test.js` بسبعة اختبارات) |
| `vite build` (frontend) | ✔ ناجح |
| ESLint (backend) | ✔ 0 أخطاء في الملفات الجديدة |
| API حيّ | ✔ إتمام → XP 5 + شارة `first_lesson` → إعادة نفس الدرس `alreadyDone:true/xpAwarded:0` → قائمة تقدم → `profile.stats.lessonsCompleted` |
| البذر | ✔ شارات الدروس الثلاثة مزرعة في قاعدة التطوير والاختبار |

## اختبارات جديدة (7) في `backend/tests/progress.test.js`

1. الإتمام يتطلب مصادقة (401).
2. رفض نقص الحقول المطلوبة (400).
3. إتمام أول مرة يمنح 5 XP ويُسجّل التقدم ويحدّث `profile.stats.lessonsCompleted`.
4. إتمام نفس الدرس مرتين لا يمنح نقاطاً إضافية (idempotent).
5. قراءة التقدم تعيد الدروس + ملخص `bySubject`.
6. إتمام درس يستوفي شرط شارة `LESSONS_COMPLETED` يمنحها (`first_lesson`).
7. الملف الشخصي يعرض عدد الدروس المكتملة.

## ما لم يُنجز (مُرجأ)

- **قائمة تفصيلية بالدروس المكتملة في ملف التلميذ** (حسب المادة/التاريخ) — العرض الحالي
  يكفي للعدد؛ القائمة تُضاف عند طلبها.
- **ربط مكافآت التكرار المتكيف (6.5) بنقاط XP** — مراجعات «المراجعة الذكية» لا تمنح
  نقاطاً بعد؛ تُترك لمرحلة التلعيب المتقدم (المرحلة 7).
- **شارات/مكافآت للاختبارات الرسمية والإيقاظ** — تُركّب فوق نفس الخدمة عند الحاجة.
