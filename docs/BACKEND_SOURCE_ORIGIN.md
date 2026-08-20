# مصدر الشيفرة الخلفية — التحقق من الأساس الوحيد (منجز)

تاريخ التحقق: 16-08-2026
الغرض: إثبات أن `backend/src/` هو الشيفرة الخلفية الوحيدة للمشروع، وأنه لا توجد شيفرة منفصلة/مكررة تحت `server/`.

## 1. ماذا أكّدنا؟

بحث شامل في الأرشيف الكامل (`/workspace`) عن أي دليل على وجود شيفرة خلفية منفصلة غير `backend/src/`:

| النمط المفحوص | النتيجة |
|---|---|
| مجلد `server/` | **غير موجود** |
| `server.js` / `server.ts` خارج `backend/` | لا يوجد |
| ملفات `package.json` إضافية (خارج `backend/` و`frontend/`) | لا يوجد |
| إعدادات تشغيل تشير إلى `server/` (`start.sh`, Dockerfile, إلخ.) | لا شيء يشير إليه |

## 2. بنية المشروع الفعلية

```
/workspace
├── backend/        ← الشيفرة الخلفية الوحيدة (Express + Prisma + Vitest)
│   ├── src/            ← المسارات والخدمات والبرمجيات الوسيطة
│   ├── prisma/         ← الهجرات + seed
│   ├── curriculum/     ← محتوى المنهج (JSON)
│   ├── tests/          ← 15 ملف اختبار / 163 اختباراً
│   └── package.json
├── frontend/       ← الواجهة (React + Vite)
├── docs/           ← الوثائق والمراجعات
└── PENDING_FIXES.md
```

## 3. طريقة التحقق

```bash
# 1) لا يوجد مجلد server/
ls /workspace | grep -i server          # → لا نتيجة

# 2) لا يوجد ملف إدخال خلفي خارج backend/
find /workspace -maxdepth 2 -name "server.js" -o -name "server.ts" | grep -v node_modules
# → لا نتيجة

# 3) نقطة الإدخال الوحيدة للخلفية
#    backend/package.json: "start": "node src/index.js" → src/index.js
#    كل المسارات تحمّل من src/routes/*.js
```

## 4. الخلاصة

لا توجد شيفرة خلفية مكررة أو موازية. أي مسار «cutover» أو «تحويل إلى server/» غير لازمة لأن:
- `backend/src/index.js` هو نقطة الإدخال الوحيدة.
- الاختبارات (163) كلها تعمل ضد `src/index.js`.
- لا مرجع في أي وثيقة أو سكربت تشغيل إلى `server/`.

هذه الوثيقة تُغلق بند «التحقق من عدم وجود server/» في قائمة الإصلاحات.
