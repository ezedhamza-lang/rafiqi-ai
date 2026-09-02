# خارطة طريق الإصلاح الشاملة — رفيقي | للتنفيذ المباشر

> **تعليمات للمطور:** افتح هذا الملف فقط، اتبع المراحل بالترتيب، لا تتخطى أي خطوة تحقق. كل مرحلة لها **ملفات + أوامر + تحقق + تراجع**. عند نهاية كل مرحلة شغّل `التحقق` — إذا فشل، لا تنتقل للتالية.

**المشروع:** `D:\rafiqi` — `backend (Express+Prisma) + frontend (React+Vite)` — نشر `https://rafiqi-platform.onrender.com`
**المبدأ:** قوي + آمن + محفوظ + **مجاني 100% حتى تقرير الأشهر القادمة** — لا ترقية مدفوعة.
**الفريق:** 150 مهندس — كل تعديل جراحي محفوظ فوراً مع فحص syntax/build.

---

## المرحلة 0: الوضع الحالي (تم فحصه حياً 2026-08-27)

**تم التحقق حياً:**
- `GET /api/health` → `200 {"status":"ok",uptime:24}` — الحاوية تعمل لكن `uptime` الصغير = cold start متكرر
- `GET /api/public/*` → `200` — البيانات موجودة (26 مندوبية، 13 مستوى)
- `POST /api/auth/login teacher@test.tn` → `200 token`
- `assets/index-CTP8_n8g.js 815KB` تُحمّل لكن **بلا ضغط ولا تخزين** (`Cache-Control: public, max-age=0`)

**المخاطر قبل الإصلاح:**
1. `render.yaml:19` كان `https://rafiqi-ai.onrender.com` ≠ الرابط الفعلي → CORS يعتمد على fallback فقط
2. `backend/Dockerfile:24` كان `migrate deploy && db push && seed` → تضارب + بدء بطيء
3. لا حفظ دائم: DB Render Free تنتهي، uploads على قرص مؤقت
4. `Home.jsx:99 withTimeout 8000ms` → أول زائر بعد نوم 15د يرى `جاري التحميل...` عالقة

---

## المرحلة 1: الإصلاحات الحرجة — ✅ تم تنفيذها وحفظها (2026-08-27)

**لا تعيد تنفيذها — تحقق فقط:**

| الملف | السطر | قبل | بعد | أمر التحقق |
|---|---|---|---|---|
| `render.yaml` | 19 | `https://rafiqi-ai.onrender.com` | `https://rafiqi-platform.onrender.com,https://www.rafiqi-platform.onrender.com` | `Get-Content render.yaml \| Select-String ALLOWED_ORIGINS` |
| `backend/Dockerfile` | 24 | `migrate deploy && db push --skip-generate && seed` | `migrate deploy && seed` | `Get-Content backend\Dockerfile` |
| `backend/src/index.js` | 139-145 | `compression` بعد `health` | `compression` قبل `json` + health عميق `SELECT 1` → `503` إن سقطت DB | `node --check backend/src/index.js` |
| `backend/src/index.js` | 242-261 | `express.static(DIST)` بلا خيارات | `maxAge 1y immutable` للأصول + `no-cache` لـ `index.html` | فحص Headers بعد النشر |
| `backend/src/index.js` | 158-165 | `rateLimit` مزدوج على `/api/auth` | `skip: req.path.startsWith('/auth/')` | `node --check` |
| `frontend/src/pages/Home.jsx` | 99 | `withTimeout 8000ms` | `20000ms + retry 10000ms` | `npm run build` في `frontend` |
| `frontend/dist` | — | `index-CTP8_n8g.js` | `index-umUhxNPB.js` (أُعيد بناؤه) | `dir frontend\dist\assets` |

**معيار الانتقال:** `npm run build` → `✓ built in ~4s` + `node --check` → `syntax OK` (تم).

---

## المرحلة 2: الحفظ الدائم المجاني — الأسبوع 1 (التالي)

**الهدف:** لا فقدان بيانات لأشهر رغم Free.

### 2-1: قاعدة البيانات — Neon المجاني الدائم
- **لماذا:** Render Free DB ينتهي بعد ~90 يوم. Neon Free = 3GB دائم + نسخ احتياطي تلقائي.
- **الملف:** `render.yaml:20-23`
```yaml
# علّق هذا:
#  - key: DATABASE_URL
#    fromDatabase: {name: rafiqi-db, property: connectionString}
# وأضف:
  - key: DATABASE_URL
    sync: false  # ستضعه يدوياً من Neon Dashboard
```
- **الأمر:** أنشئ مشروع Neon → انسخ `DATABASE_URL` → في Render Dashboard → Environment → لصق → Save (يعيد النشر تلقائياً).
- **التحقق:** `Invoke-WebRequest https://rafiqi-platform.onrender.com/api/health` → `200 db:up` + `GET /api/public/delegations` → `26`.
- **التراجع:** أعد `fromDatabase` واحذف `DATABASE_URL`.

### 2-2: نسخ احتياطي يومي مجاني — GitHub Actions
- **الملف الجديد:** `.github/workflows/backup.yml`
```yaml
name: daily-backup
on: { schedule: [{cron: "0 2 * * *"}], workflow_dispatch: {} }
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pg_dump "$DATABASE_URL" | gzip > backup-$(date +%F).sql.gz
        env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
      - uses: actions/upload-artifact@v4
        with: { name: backup, path: "*.sql.gz", retention-days: 90 }
```
- **الإعداد:** Repo → Settings → Secrets → `DATABASE_URL` (رابط Neon).
- **التحقق:** Actions → شغّل `workflow_dispatch` يدوياً → Artifact يظهر.
- **التكلفة:** 0 (2000 دقيقة مجانية/شهر، النسخة < 5 ث).

### 2-3: الملفات المرفوعة — R2 المجاني (10GB)
- **الخيار المجاني:** Cloudflare R2 أو Supabase Storage (1GB).
- **الملف الجديد:** `scripts/sync-uploads.sh` (يُستدعى من Action ليلي ثانٍ)
```bash
rclone sync backend/uploads/ r2:rafiqi-uploads --transfers 4
```
- **التحقق:** بعد أول مزامنة `rclone ls r2:rafiqi-uploads` يظهر الملفات.
- **التراجع:** الملفات الأصلية تبقى على Render حتى النشر التالي.

### 2-4: منع النوم — UptimeRobot المجاني
- **الإعداد:** uptimerobot.com → New Monitor → HTTP(s) → `https://rafiqi-platform.onrender.com/api/health` → كل 5 دقائق → تنبيه بريد.
- **التحقق:** بعد 15د → `uptime` في `/api/health` يبقى متزايداً لا يعود لـ `24`.

**معيار الانتقال للمرحلة 3:** 7 أيام متتالية → `health db:up` + Artifact يومي + R2 به ملفات.

---

## المرحلة 3: الاستقرار والأمان — الأسبوع 2 (مجاني)

| المهمة | الملف | الإجراء |
|---|---|---|
| إخفاء seed التجريبي إن وجدت بيانات | `backend/Dockerfile:24` | `node prisma/seed.js \|\| true` |
| إيقاف swagger في الإنتاج محكم | `backend/src/index.js:180` | يبقى `404` كما هو — لا تلمسه |
| سجل بريد محلي مجاني | `backend/src/config.js:52 smtp` | بدون SMTP يعمل `tmp-mail.log` — لا حاجة لإعداد |
| تنظيف logs | — | لا شيء — `morgan` الحالي يكفي |

**التحقق:** `POST /api/auth/login` ببيانات خاطئة 5 مرات → `429 طلبات كثيرة جداً` (rateLimit يعمل).

---

## المرحلة 4: التجربة الممتدة — أشهر 1-3 (مجاني)

**لا كود — مراقبة فقط:**
- كل أسبوع: افحص `GET /api/health` (يجب `db:up`) + عدد Artifacts في GitHub
- كل شهر: حمّل `backup-*.sql.gz` وجربه محلياً `gunzip < backup.sql.gz | psql`
- Cloudflare Web Analytics (مجاني) لعدد الزيارات — لا تثبيت

**حدود المجاني (للمراقبة):**
- Neon 3GB → راقب `SELECT pg_database_size()` — إن اقترب 2.5GB أبلغ
- R2 10GB → `rclone size r2:rafiqi-uploads`
- Render 750 ساعة/شهر Free (كافٍ لخدمة واحدة)

---

## المرحلة 5: التقرير النهائي بعد أشهر — القرار

- تصدير نهائي: `pg_dump` + `rclone copy r2:rafiqi-uploads ./final-uploads`
- تقرير استهلاك: إذا `DB <3GB` و `files <10GB` → **البقاء مجاناً للأبد** (Neon+R2+Render كافٍ)
- إذا تجاوز → ترقية واحدة فقط: `Render Starter 7$/شهر` **أو** `Neon Scale` — لا كلاهما.

---

## تعليمات التنفيذ للمطور — أمر واحد

```bash
# في D:\rafiqi
git status
# المرحلة 1 محفوظة — ابدأ من 2-1:
# 1) أنشئ Neon → انسخ DATABASE_URL
# 2) عدّل render.yaml:20 كما في 2-1
# 3) أنشئ .github/workflows/backup.yml كما في 2-2
# 4) أضف Secret في GitHub
# 5) سجّل في UptimeRobot كما في 2-4
# بعد كل خطوة: Invoke-WebRequest https://rafiqi-platform.onrender.com/api/health
```

**قاعدة ذهبية:** لا تنفذ مرحلة جديدة حتى تنجح كل `التحقق` في السابقة. عند الشك: `git diff` ثم `git stash` للتراجع.

---

**تم بواسطة فريق 150 مهندس — 2026-08-27 — محفوظ في `docs/REPAIR_ROADMAP_EXECUTABLE.md`**
