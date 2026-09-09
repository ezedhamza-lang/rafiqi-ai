-- إضافة حقل كلمة السر المؤقتة للطالب (لتظهر للولي في صندوقه).
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "tempPassword" TEXT;
