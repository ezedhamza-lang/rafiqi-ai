# RAFIQI-HANDOVER — تسليم كامل (06/10/2026)

هذا الملف موجّه **لمن يأتي بعدي**. كل ما يلزم لفهم الحالة والتشغيل مكتمل هنا.
(.gitignore يحجب `*?????*??*.md`، لذلك كل الأسماء هنا لاتينية عمدًا.)

---

## 1) ماذا هو حيّ الآن؟

| الشيء | الرابط | الحالة |
|---|---|---|
| **المدوّنة (كتب التحميل المجانية)** | `https://rafiqitn.blogspot.com` | ✅ 6 بطاقات، كل روابط التحميل على MediaFire |
| **المنصة التفاعلية** | `https://rafiqi-platform.onrender.com` | ✅ تعمل |
| الحزمة الكاملة (5 كتب ZIP) | `mediafire.com/file/jgds3cbxh8vl8ns/rafiqi-books-free-pack.zip` | ✅ 36.24 م.ب |
| مقال الحزمة | `rafiqitn.blogspot.com/2026/10/blog-post_06.html` | ✅ |
| صفحة «شاركنا» | `rafiqitn.blogspot.com/p/blog-page_06.html` | ✅ أزرار واتساب/فيسبوك/تيليغرام/بريد |
| المنصة (صفحة) | `rafiqitn.blogspot.com/p/blog-page.html` | ✅ |
| كيف تحصل على الكتاب | `rafiqitn.blogspot.com/p/blog-page_702.html` | ✅ |
| عن رفيقي | `rafiqitn.blogspot.com/p/blog-page_618.html` | ✅ |
| سياسة الخصوصية | `rafiqitn.blogspot.com/p/blog-page_05.html` | ✅ |

**المقالات الستّة على المدوّنة:**

| # | العنوان | الرابط |
|---|---|---|
| 1 | الإيقاظ العلمي s2 — كتاب التلميذ | `/2026/10/2.html` |
| 2 | القراءة الشامل — الكتاب الكامل | `/2026/10/blog-post.html` |
| 3 | القراءة s2 — كتاب التلميذ | `/2026/10/2_046668266.html` |
| 4 | الرياضيات s1 — كرّاس التمارين | `/2026/10/1.html` |
| 5 | **الإنتاج الكتابي s1 — السنة الأولى** | `/2026/10/s1.html` |
| 6 | الحزمة الكاملة (ZIP) | `/2026/10/blog-post_06.html` |

**روابط الكتب على MediaFire** (لا تُغيّرها إلا بتحويل رابط جديد):

| الكتاب | الرابط |
|---|---|
| إيقاظ علمي s2 | `/file/fr2bq84mzejoouh/rafiqi-iqaid-sciences-s2-pupil-book.pdf` |
| قراءة شامل | `/file/y2pyitwjc3hvqjy/rafiqi-reading-comprehensive-s2-full-book.pdf` |
| قراءة s2 | `/file/a606nq1faw4q3k3/rafiqi-reading-s2-pupil-book.pdf` |
| رياضيات s1 | `/file/0egiul329ldh4yk/rafiqi-math-s1-workbook.pdf` |
| إنتاج كتابي s1 | `/file/4sk4rr3nnwo5ktl/rafiqi-production-s1-pupil-book.pdf` |
| الحزمة ZIP | `/file/jgds3cbxh8vl8ns/rafiqi-books-free-pack.zip` |

**الأغلفة** (نمط `convkey/<2hex>/<quickkey><size>.jpg` — `9g` = كامل 714px، `3g` = مصغّرة):

`convkey/fe86/xulm5tgotswgk4w9g.jpg` · `convkey/9123/gfvbl2bzodofe8a9g.jpg` ·
`convkey/8707/oiergn32sz5oq6w9g.jpg` · `convkey/28ba/tje7tf98h1ignse9g.jpg` ·
`convkey/ed5c/koxj6vbnc4osyd09g.jpg`

---

## 2) أين الملفات؟

| الغرض | المسار |
|---|---|
| **مصادر النشر** (١٨ PDF مُصلَحًا) | `C:\Users\ezedd\OneDrive - ANETI\Bureau\bolg\_FIXED\` |
| نسخة ما قبل الإصلاح | `...\bolg\_FIXED_bak\` |
| ملفات مرفوضة (مولَّدة آليًا) | `...\bolg\_DO_NOT_PUBLISH\` |
| **سجلّ المعرفة** (كل التفاصيل) | `D:\WORK\03-education\RAFIQI-KNOWLEDGE.md` |
| **دليل النشر** | `D:\WORK\03-education\RAFIQI-DAR-NASHR.md` |
| **هذه الوثيقة** | `D:\WORK\03-education\RAFIQI-HANDOVER.md` + نسخة داخل المستودع |
| الأدوات (نسخة دائمة) | `tools/rafiqi-publishing/` في هذا المستودع |

---

## 3) قواعد لا تُكسَر (من تفويض المستخدم)

1. **لا يُنشر محتوى معطوب** — أي خلل يُصلَح قبل النشر.
2. **لا نفقة** — كل شيء على الطبقات المجانية. لا شيء على تخزين Render.
3. **`_FIXED/` هو مصدر النشر الوحيد**؛ الأصلية لا تُلمس.
4. **لا تُسجَّل كلمات المرور في أي ملف.** عمليًا: لا تُكتب في git ولا في وثائق.
5. `dossier-cnte2026/` و`docs/*` و`backend/scripts/*` و`tudentest.txt`
   و`backend/content-deep.txt` و`tasks/` — **لا تُعمل لها stage أبدًا**؛
   استخدم `git add <مسار محدّد>` فقط.
6. المسلسلات العربية تُكتب في ردود الكود كما هي (شرط Sass).
7. Git: الفرع `main`،Remote = `origin` (ezedhamza-lang/rafiqi-ai).

---

## 4) الأدوات المرفقة (كلها في `tools/rafiqi-publishing/`)

**بايثون:** `C:\Users\ezedd\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe`
(فيه `pymupdf` + `Pillow` + `requests`، وليس فيه `fontTools`).

| السكربت | الوظيفة |
|---|---|
| `fileserver.py 8765` | خادم محلّي CORS يخدم `posts/upload` — **الحيلة التي تتجاوز حدّ 5 ميB في رفع MediaFire** |
| `upload_host.py` | رفع إلى catbox (احتياطي بلا حساب) |
| `prod1_fix_header.py` | إصلاح ترويسة كتاب الإنتاج s1 (155 صفحة) — انظر §5 |
| `prod1_verify.py` | تحقّق: لا بكسل تغيّر خارج المستطيل + عدد الصفحات ثابت |
| `prod1_cmp.py / prod1_cmp2.py` | ورقة مقارنة قبل/بعد (تُصدَّر في `prod1_sheets/`) |
| `peek.py <pdf> <page> <x0 y0 x1 y1> [zoom] [out]` | قصّ أي منطقة في PDF لفحصها بالعين |
| `prod1_zoom.py / prod1_top.py / prod1_hdr.py / prod1_cols.py` | أدوات قياس الترويسة |
| `fix_level.py` + `fix_level_run.py pilot|apply` | محرّك تصحيح «التعليم الأساسي» ← «الابتدائي» |
| `fix_level_scan.py` | جرد كل الأسطر التي فيها العبارة (ينتج `level_manifest.json`) |
| `level_scan.py` | مسح سريع للغلاف |
| `promote.py` | نسخ `_out` ← `_FIXED` مع فحص الصفحات/الحجم + نسخة `_FIXED_bak` |
| `fix_titles.py` | تصحيح عناوين البيانات الوصفية (metadata) |
| `mk_pack.py` | بناء حزمة ZIP من الكتب المنشورة + «اقرأني.txt» |
| `mk_announce.py` | توليد نصّ إعلان الحزمة + أزرار المشاركة |
| `posts/p1.html … p6.html` | **HTML الحرفي لكل مقال منشور** (انسخه عند التعديل) |

**بايثون يُشغَّل هكذا:**
```
cmd /c "set PYTHONUTF8=1&& C:\Users\ezedd\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe <script>.py"
```

---

## 5) دروس فنية نتجت عن أخطاء حقيقية (وفّر وقت من يأتي بعدي)

### أ) لا تُفترض «الطبقة النصية»
كتاب الإنتاج s1 لم يشمله الإصلاح التلقائي: حروفه في `get_text()` متباعدة/مقلوبة،
فلم يطابق `cfold()` العبارة «الاساس». الحلّ: **هندسة البكسل لا النص**
(الترويسة ثابتة الموضع على كل الصفحات).

### ب) `add_redact_annot` خطر بين سطرين متلاصقين
صندوق السطر الثاني في `get_text` يبدأ y=48.5 بينما **حبره** يبدأ y=55.3،
فالمحرك مسح أعلى السطر الثاني («بتطاوين» من «مدرسة الامتياز بتطاوين»).
**القاعدة: قِس y للحبر لا لصندوق النص؛ وإن كانت الخلفية بيضاء خالصة استعمل
`draw_rect(fill=(1,1,1))` بدل الإعادة.**

### ج) Blogger يخزّن النص في **مكانين**
CodeMirror **و** textarea مخفي. الكتابة في واحد فقط = تكرار البطاقة في الصفحة.
اكتب في الاثنين دائمًا (انظر `posts/p1.html` … `posts/p6.html`).

### د) زرّ «Publier» لا يستجيب أحيانًا
الحل المُجرَّب: `reload` → انتظار CodeMirror → نقر «Publier» → حوار → **CONFIRMER**
(الأزرار كبيرة في الحوار: `CONFIRMER` لا `Confirmer`).

### هـ) قوائم الصفحات لا تنقر إلا بعد تمرير أفقي
`scrollingElement.scrollLeft = 0` أولًا، وإلا كانت الصفوف خارج النافذة (x سالب).

### و) رابط محرّر الصفحة (بمفردها لا بجمعها)
`blogger.com/blog/**page**/edit/<blogID>/<pageID>`
(«/blog/pages/edit/...» تعطي «Impossible de localiser votre page»).

### ز) الجلسات تنتهي
بعد ساعات ينتهي دخول Google وMediaFire معًا. عندها **يتوقّف العمل** ولا يمكن
استكماله دون دخول المستخدم (لا تُكتب كلمة المرور في أي ملف).

### ح) روابط الأغلفة من سجلّ الشبكة
لا تظهر في لوح الرفع:
`performance.getEntriesByType('resource').filter(n=>n.includes('convkey'))`
داخل تبويب MediaFire → النمط `convkey/<2hex>/<quickkey><size>.jpg`.

### ط) بيانات Blogger الوصفية للصفحة/المقال تُحرَّر من قائمة الصفحات/المقالات،
و«رابط المقال الدائم» لا يُعدَّل (روابط مولَّدة مثل `blog-post_06`).

---

## 6) الخطوة التالية المقترحة

1. **كتاب سادس بعد 2–3 أيام**: الإنجليزية s3 أو كتاب آخر من سلسلة القراءة.
   - قبل النشر: `peek.py <file> 10 200 28 392 82 6` → تأكّد أن الترويسة
     «الابتدائي» لا «الأساسي» (بعض الكتب طبقة نصّها مشوّشة كإنتاج s1).
   - ثم: فحص الغلاف بالعين → رفع PDF + الغلاف إلى MediaFire →
     تعديل `posts/p5.html` بنفس النمط → نشر.
2. **بعد 20 مقالة**: طلب AdSense (الصفحتان التعريفية والخصوصية موجودتان).
3. **اختياري**: نسخة «هدية» دائمة على Archive.org.
4. **اختياري**: شريط تنقّل للصفحات (Gadget «Pages» مقفل في الثيم).

---

## 7) سجلّ التعديلات

- 06/10/2026 — تغيّر توقيت المدوّنة من لوس أنجلوس إلى **(GMT+01:00) تونس**
  (كانت التواريخ تظهر بيوم متأخّر) — انظر `RAFIQI-KNOWLEDGE.md` §14.
- 06/10/2026 — روابط الكتابين الرابع والخامس انتقلت من catbox إلى **MediaFire**.
- 06/10/2026 — تصحيح ترويسة الإنتاج s1 في **155 صفحة** — §15.
- 06/10/2026 — نشر الحزمة الكاملة وصفحة «شاركنا» — §16.
- 06/10/2026 — **ربط المنصة بالمدوّنة (النصف الأول)**: قسم «الكتب المجانية» في
  الصفحة الرئيسية للمنصة + روابط في التذييل + استبدال روابط التواصل الوهمية.
  التزام `ca73fd5`. **النصف الثاني (من المدوّنة إلى المنصة) يحتاج دخول المستخدم.**

---

## 8) تقرير المراجعة الشاملة

`D:\WORK\03-education\RAFIQI-REPORT-2026-10-06.md` — تقرير بالعربي البسيط
لغير المبرمجين: مراجعة المنصة والأدوار، الربط، الخطة، المقارنة مع المنصات العالمية،
وما ينقص/يُحسَّن/يُطوَّر.