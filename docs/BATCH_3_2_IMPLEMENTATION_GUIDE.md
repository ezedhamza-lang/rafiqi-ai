# دليل تنفيذ الدفعة 3.2 — ترجمة محتوى الـAPI

## ✅ ما تم إنجازه

### 1. تعديل `schema.prisma` ✅
تمت إضافة حقول اختيارية للترجمة الإنجليزية:

```prisma
model Announcement {
  id          Int      @id @default(autoincrement())
  title       String
  description String
  titleEn       String?  // Batch 3.2: English translation (optional)
  descriptionEn String? // Batch 3.2: English translation (optional)
  imageUrl    String?
  category    String
  date        DateTime @default(now())
  createdAt   DateTime @default(now())
}

model Article {
  // نفس النمط: titleEn?, descriptionEn?
}

model Faq {
  // نفس النمط: questionEn?, answerEn?
}
```

### 2. ملف الهجرة ✅
المسار: `backend/prisma/migrations/20260819000000_add_i18n_fields/migration.sql`

### 3. دالة المساعدة i18nHelper.js ✅
المسار: `backend/src/utils/i18nHelper.js`

الدوال المتاحة:
- `getLocalizedField(record, fieldAr, fieldEn, lang)` — حقل واحد
- `localizeRecord(record, fields, lang)` — سجل كامل
- `localizeRecords(records, fields, lang)` — مصفوفة سجلات
- `validateLang(langParam)` — التحقق من معامل اللغة

### 4. مسارات API المحدّثة ✅
`backend/src/routes/public.js`:

| المسار | المعامل | الوصف |
|--------|---------|-------|
| `/api/public/announcements` | `?lang=en` | إعلانات مترجمة |
| `/api/public/articles` | `?lang=en` | مقالات مترجمة |
| `/api/public/faqs` | `?lang=en` | أسئلة شائعة مترجمة |

**السلوك:**
- `?lang=ar` أو بدون معامل → العربية (افتراضي)
- `?lang=en` → الإنجليزية إذا وُجدت، وإلا تراجع آمن للعربية

---

## ⚠️ ما يحتاج تنفيذاً يدوياً (يتطلب قاعدة بيانات فعلية)

### تشغيل الهجرة
```bash
cd backend
npm run prisma:migrate
# أو
npx prisma migrate dev --name add_i18n_fields
```

---

## 📝 كيفية إضافة حقول EN في نماذج لوحة التحكم

عند بناء/تحديث نماذج إدارة المحتوى، أضف حقولاً اختيارية للترجمة:

### مثال: نموذج إنشاء إعلان (React)

```jsx
// Before (Arabic only):
<form onSubmit={handleSubmit}>
  <input name="title" placeholder="العنوان" />
  <textarea name="description" placeholder="الوصف" />
</form>

// After (with optional English fields):
<form onSubmit={handleSubmit}>
  {/* Arabic (required) */}
  <fieldset>
    <legend>المحتوى العربي</legend>
    <input name="title" placeholder="العنوان" required />
    <textarea name="description" placeholder="الوصف" required />
  </fieldset>
  
  {/* English (optional) */}
  <fieldset>
    <legend>English Content (Optional)</legend>
    <input name="titleEn" placeholder="Title (English)" />
    <textarea name="descriptionEn" placeholder="Description (English)" />
  </fieldset>
</form>
```

### مثال: مسار API لإنشاء محتوى

```javascript
// backend/src/routes/contentAdmin.js (example)

router.post('/announcements', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { title, description, titleEn, descriptionEn, imageUrl, category } = req.body;
  
  const announcement = await prisma.announcement.create({
    data: {
      title,           // مطلوب
      description,     // مطلوب
      titleEn: titleEn || null,           // اختياري
      descriptionEn: descriptionEn || null, // اختياري
      imageUrl,
      category
    }
  });
  
  res.status(201).json(announcement);
}));
```

### مثال: مسار API لتحديث محتوى

```javascript
router.put('/announcements/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, titleEn, descriptionEn, imageUrl, category } = req.body;
  
  // بناء البيانات ديناميكياً - فقط الحقول المرسلة
  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (titleEn !== undefined) data.titleEn = titleEn || null;  // سلسلة فارغة → null
  if (descriptionEn !== undefined) data.descriptionEn = descriptionEn || null;
  if (imageUrl !== undefined) data.imageUrl = imageUrl;
  if (category !== undefined) data.category = category;
  
  const updated = await prisma.announcement.update({
    where: { id: Number(id) },
    data
  });
  
  res.json(updated);
}));
```

---

## 🔧 اختبار الترجمة

### اختبار API مباشر:
```bash
# Arabic (default)
curl http://localhost:3000/api/public/announcements
# → { title: "إشعار مهم", description: "..." }

# English
curl http://localhost:3000/api/public/announcements?lang=en
# → { title: "Important Notice", description: "..." }  (if translated)
# → { title: "إشعار مهم", description: "..." }  (fallback if not)
```

### اختبار التراجع الآمن:
إذا كان `titleEn = null` أو سلسلة فارغة، يتم إرجاع `title` (العربية) تلقائياً.

---

## 📋 قائمة تحقق قبل التشغيل

- [ ] قاعدة بيانات PostgreSQL متصلة (`docker-compose up -d db`)
- [ ] `DATABASE_URL` معرّف في `.env`
- [ ] تشغيل الهجرة: `npm run prisma:migrate`
- [ ] اختبار المسارات مع `?lang=en`
- [ ] إدخال بيانات تجريبية مع حقول EN من لوحة التحكم
- [ ] التحقق من التراجع الآمن عند حذف قيم EN

---

## 📊 ملخص التغييرات

| الملف | نوع التغيير |
|-------|-----------|
| `backend/prisma/schema.prisma` | +6 حقول اختيارية |
| `backend/prisma/migrations/20260819000000_add_i18n_fields/migration.sql` | هجرة SQL جديدة |
| `backend/src/utils/i18nHelper.js` | **ملف جديد** - دوال الترجمة |
| `backend/src/routes/public.js` | +دعم `?lang=` في 3 مسارات |

**ملاحظة:** قصص المنهج (~198 قصة) تبقى عربية عمداً — ترجمتها عمل تحرير تربوي بمراجعة إنسانية.
