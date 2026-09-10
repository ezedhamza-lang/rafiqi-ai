-- R2b: حقل lastActiveAt حقيقي للسلاسل اليومية (بدل الاعتماد على updatedAt)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

-- تعبيرة واحدة: من كان يملك نشاطاً مسجلاً في آخر 48 ساعة يُعتبر مستمراً اليوم
UPDATE "User" SET "lastActiveAt" = "updatedAt"
  WHERE "lastActiveAt" IS NULL AND "role" = 'STUDENT' AND "streakDays" > 0;
