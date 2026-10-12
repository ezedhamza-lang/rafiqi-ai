# تدقيق منصة رفيقي — خريطة المنصة (المرحلة 1)

> **المنهج**: لا ثقة بأي ادعاء سابق. كل سطر أدناه مبني على قراءة مباشرة للكود أو تنفيذ فعلي.
> **الحالة**: جرد وفهم — لا إصلاحات بعد.
> **التاريخ**: 2026-09-26 — الفرع `main` عند `2e9b9bd` (بعد دفع لعبة حديقة المعرفة).

---

## 1. البطاقة التعريفية

| البند | القيمة (مصدر) |
|---|---|
| الجذر | `D:\WORK\03-education\rafiqi-full-2026-09-02-2\rafiqi` (فحص مباشر) |
| Frontend | React + Vite 6 (171 ملفًا في `src` — عدّ فعلي)، `frontend/src/App.jsx` |
| Backend | Node + Express + Prisma + PostgreSQL (161 ملفًا في `src` — عدّ فعلي)، `backend/src/index.js` |
| قاعدة البيانات | PostgreSQL واحدة (provider في `schema.prisma:1-4`)، **71 model و18 enum** (جرد آلي) |
| المحتوى الدراسي | ملفات JSON (120+ ملف) — السنوات 1-6 ابتدائي تونسي فقط؛ الإعدادي/الثانوي مُعلن بلا محتوى |
| التوثيق السابق | `README` اللعبة كان **قديمًا ومضللًا** (ادعى أن `letters-garden/` بلا `index.html` — كذبته التجربة المباشرة) |
| الخوادم المحلية | Vite `5173` ✅ يعمل — Backend `3001` ✅ يعمل (`/api/health` ‏200) |

---

## 2. الأدوار الستة (مثبتة من الكود + قاعدة البيانات)

`Role` في `schema.prisma:10-16`: `STUDENT, PARENT, TEACHER, SCHOOL_DIRECTOR, ADMIN, SUPER_ADMIN`.

| الدور | مساره | حساب تجريبي في DB (الحالة) |
|---|---|---|
| STUDENT | `/student-space/*` + `/games/letters-garden` | `student@test.tn` ✅ ACTIVE (+ 12 تلميذ `eleveXX@classe.tn`) |
| TEACHER | `/teacher/*` | `teacher@test.tn` ✅ ACTIVE |
| PARENT | `/parent/*` | `parent@test.tn` ✅ ACTIVE |
| SCHOOL_DIRECTOR | `/director/*` | `director@test.tn` ✅ ACTIVE |
| ADMIN | `/admin` + `/director/*` (المالية) | `admin@education.tn` ✅ ACTIVE |
| SUPER_ADMIN | `/superadmin/*` | `super@education.tn` ✅ ACTIVE |

ملاحظات جودة بيانات (مثبتة بالاستعلام، ليست تخمينًا):
- `PARENT test@teacher.tn` — بريد بلا معنى وظيفي apparent (DATA_QUALITY، يحتاج سؤالًا لا حذفًا).
- `STUDENT t32c6b6@refeeqi.tn` بحالة `PENDING_PAYMENT` — دليل حي على مسار الدفع.
- إجمالي المستخدمين 24، الأقسام 13، التلاميذ 14، الاختبارات **0**، الواجبات 1.

### سلسلة الصلاحيات (مثبتة من `backend/src/auth.js:93-159`)
- `authMiddleware`: Bearer إجباري + فحص `accountStatus` من DB في **كل طلب** (PENDING/SUSPENDED/EXPIRED → ‏403).
- Access token: JWT ‏15 دقيقة. Refresh: opaque (SHA-256 في DB) ‏7 أيام مع rotation.
- `teacherMiddleware` = TEACHER/ADMIN/DIRECTOR/SUPER (لا STUDENT/PARENT).
- `studentMiddleware` = **الكل بما فيهم المعلم والإدارة** — والحماية الحقيقية داخل الـhandlers (`role!=='STUDENT'` → ‏403). أي handler ينسى هذا الفحص = ثغرة وصول. (**نقطة فحص إلزامية في المرحلة الأمنية**).
- لا `parentMiddleware` مخصص — فحص inline لكل مسار.

---

## 3. خريطة الواجهات (23 مسارًا — من `App.jsx:103-137`)

عامة: `/ /privacy /help /login /register` — محمية بدور: `/account /dashboard /students /registration /student /my-requests /payment /messages /message-center /admin /teacher/* /student-space/* /parent/* /director/* /superadmin/* /games/letters-garden`.

| المنطقة | عدد الشاشات | ملاحظة |
|---|---|---|
| التلميذ `StudentSpace` | **29 تبويبًا** (twin, dashboard, rewards, books, stories, subjects, plan, adaptive, flashcards, routine, videos, refeeqi, quizzes, official-exams, assignments, live, paper-exam, schedule, calendar, play, experiments, portfolio, daily-challenge, progress, virtual-friend, leaderboard, weekly-challenge, certificates, friendships) | الأكبر — كل تبويب يحتاج تحققًا مستقلًا |
| الأستاذ `TeacherDashboard` | **25 تبويبًا** (تحليل، خطط، مذكرات، جداول، مواد، تمارين، موارد، مكتبة، اختبارات، واجبات، امتحانات رسمية، تصحيح، نتائج، معدلات، سجل، درجات، تحليلات، تقدم، ملاحظات، حضور، صحة، AI، مباشر، اقتراحات) | الثاني |
| الولي `ParentSpace` | 12 تبويبًا | — |
| المدير `DirectorDashboard` | 8 تبويبات (المالية لـADMIN فقط) | — |
| SUPER_ADMIN | 4 تبويبات (تراخيص، اشتراكات، مستخدمون، مدارس) | — |
| ADMIN القديمة | تبويبان داخليان (مساعدة، مفتاح AI) | — |

---

## 4. خريطة API (~40 نقطة تركيب — من `index.js:262-319`)

النقاط الحرجة المكتشفة بالقراءة (ليست أحكامًا — بنود فحص):
1. **7 ملفات routes بلا أي validation**: `curriculum, public, student, studentFriendships, studentRewards, teacherExtras` + فجوات جزئية (`ai/batch-grade`, `ai/publish-grades`, `teacherContent/instantiate/from-books/generate-ai/generate-docx`, `submittedExams/lesson-submissions`, `grades` certificates, `messages` بعض GETs).
2. **`studentFriendships`**: `decline` و`DELETE` **بلا فحص ملكية** (أي طالب يحذف صداقة غيره؟ — يحتاج إثباتًا بالتجربة).
3. **`studentRewards/leaderboard`**: ترتيب **عام عبر المدارس** (top-20 by XP) — تسريب بيانات عبر المدارس؟ يحتاج إثباتًا.
4. **`messages/teachers`**: كل المعلمين لأي مستخدم مصادق — يحتاج مراجعة سياسة.
5. **الرفع**: أسماء عشوائية + حد 5-12MB + فحص magic bytes — جيد ظاهريًا؛ `/uploads/` العامة تعتمد على عشوائية الاسم فقط؛ المحمي (`exams/documents/recordings`) بتوقيع HMAC ‏15 دقيقة.
6. **المدفوعات**: webhook عام بتوقيع provider + مسار demo محجوب إنتاجيًا — يحتاج اختبارًا منفصلًا (مال حقيقي).
7. **الذكاء الاصطناعي**: `POST /ai/chat` للتلميذ + توليد اختبارات/تصحيح للأستاذ — يجب تحديد حدوده (المرحلة 45).
8. أسرار افتراضية ملتزمة في `seed.js` و`tests/` (للتجربة فقط — خطر إن طابقت الإنتاج).

---

## 5. المحتوى الدراسي (ملفات لا DB)

- `backend/curriculum/registry.json` (schemaVersion 4): سنوات 1-6، مواد (رياضيات/قراءة/إيقاظ/إنتاج + فرنسية للثانية فقط).
- `backend/content/`: بنوك الأسئلة والامتحانات الرسمية، ~11 ملف قصص، كتالوج فيديو، خطط HTML.
- **فجوات معلنة**: مسارات الثانوي بلا محتوى؛ فيديوهات «ستُضاف قريبًا» (`ar.json:1890`، `LessonViewer.jsx:1337`)؛ مواد الأقسام «سيحددها أستاذك قريبًا».
- **لا TODO/FIXME حقيقي في `frontend/src`** (بحث آلي — صفر). العثور السابق على صينية في `SENTENCE_DATA` بـPlayZone يستحق التثبت (بند CONTENT).

---

## 6. ما يعمل ON PAPER مقابل ما تم إثباته فعلًا

| مثبت بالتنفيذ هذه الجلسة | لم يُثبت بعد (Needs Verification) |
|---|---|
| دخول 6 أدوار (200 + JWT) — جزئيًا (STUDENT مُثبت، البقية من DB فقط) | كل رحلات الأدوار end-to-end |
| لعبة حديقة المعرفة كاملة (boot/map/play/submit/state) + جوال | كل الأزرار والنماذج والـ34 تبويبًا الأخرى |
| `vite build` نظيف، صفر console errors في المسارات المفحوصة | الأداء، الطباعة الفعلية، الرفع بأنواعه، التراسل |
| النسخ الليلي يعمل (فرع `db-backups` بتاريخ اليوم) | الاستعادة من النسخة (لم تُختبر) |

---

## 7. قائمة UNKNOWN (لا تخمين — تُحسم بالتجربة)

1. هل `studentMiddleware` الواسع يُستغل في أي handler نسي فحص الدور؟ (فحص آلي لكل ملف + تجربة اختراق مصادق عليها)
2. هل leaderboard العام يسرب بيانات عبر المدارس؟
3. هل حذف الصداقة بلا ملكية قابل للاستغلال؟
4. هل حسابات `grade.js` (المعدلات والنسب) صحيحة حسابيًا؟ (اختبار مستقل بأرقام معروفة)
5. هل التصحيح الآلي للاختبارات يطابق الإجابات فعلًا؟ (إجابة صحيحة/خاطئة مقصودة)
6. هل الولي يرى أبناءه فقط؟ (حسابان لوليين مختلفين)
7. هل المحتوى (سنة/مادة/درس) مخلوط؟ (مراجعة عينات)
8. هل الطباعة العربية RTL سليمة على الورق؟ (PDF فعلي + فحص بصري)
9. هل `/uploads/` العامة تسمح بتخمين/فهرسة؟
10. هل webhook الدفع يتحمل توقيعًا مزورًا؟ (بيئة تجريبية فقط)

---

## 8. الخطوة التالية (حسب قواعد المهمة)

1. `docs/MASTER-AUDIT-REPORT.md` — بعد انتهاء الفحص الوظيفي (Working/Broken/Partial/Risk/Unknown).
2. `docs/MASTER-ISSUES.md` — كل مشكلة برقم وشدة ودليل وإعادة إنتاج.
3. `docs/MASTER-REPAIR-PLAN.md` — مرتبة P0→P3، ولا إصلاح قبلها.
4. الإصلاح → اختبار ارتدادي → `docs/FINAL-PLATFORM-VALIDATION.md`.

**المحطة التالية المقترحة**: التحقق الوظيفي لدور التلميذ (29 تبويبًا) — الأكبر والأهم للمدرسة. ثم الأستاذ. ثم الولي. ثم الأمان.
