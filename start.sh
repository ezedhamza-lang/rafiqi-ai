#!/bin/bash
# سكربت تشغيل منصة الحياة المدرسية بضغطة واحدة
echo "======================================"
echo "  منصة الحياة المدرسية - التشغيل التلقائي"
echo "======================================"

# 1) بدء PostgreSQL
echo "[1/4] جاري بدء قاعدة البيانات PostgreSQL..."
if command -v pg_ctlcluster >/dev/null 2>&1; then
  service postgresql start 2>/dev/null || sudo service postgresql start 2>/dev/null
elif command -v brew >/dev/null 2>&1; then
  brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null
else
  echo "  - لم يتم العثور على PostgreSQL، حاول بدءه يدويا"
fi
sleep 2

# 2) التأكد من قاعدة البيانات والمستخدم
echo "[2/4] جاري التحقق من قاعدة البيانات..."
if su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='school_user'\"" 2>/dev/null | grep -q 1; then
  echo "  - المستخدم school_user موجود"
else
  echo "  - جاري إنشاء المستخدم وقاعدة البيانات..."
  su - postgres -c "psql -c \"CREATE USER school_user WITH PASSWORD 'school_pass';\" -c \"CREATE DATABASE school_platform OWNER school_user;\"" 2>/dev/null || \
  sudo -u postgres psql -c "CREATE USER school_user WITH PASSWORD 'school_pass';" -c "CREATE DATABASE school_platform OWNER school_user;" 2>/dev/null
fi

# 3) تشغيل الهجرات (migrations) بدل db push ثم البذر
echo "[3/4] جاري تشغيل الهجرات وبيانات البذر..."
cd "$(dirname "$0")/backend" || exit 1
npx prisma migrate deploy
node prisma/seed.js

# 4) تشغيل الخادمين
echo "[4/4] جاري تشغيل الخادمين..."
cd "$(dirname "$0")/backend" && node src/index.js > /tmp/school-backend.log 2>&1 &
BACKEND_PID=$!
cd "$(dirname "$0")/frontend" && npm run dev > /tmp/school-frontend.log 2>&1 &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "  تم التشغيل بنجاح!"
echo "  الموقع:  http://localhost:5173"
echo "  توثيق API: http://localhost:3001/api-docs"
echo ""
echo "  حسابات تجريبية: تُنشأ عند تعبئة قاعدة البيانات (prisma/seed.js)"
echo "  وكلمات السرّ تُضبط بمتغيّر البيئة SEED_DEMO_PASSWORD — لا تُكتب في ملفات."
echo ""
echo "  للإيقاف: اضغط Ctrl+C ثم: kill $BACKEND_PID $FRONTEND_PID"
echo "======================================"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
