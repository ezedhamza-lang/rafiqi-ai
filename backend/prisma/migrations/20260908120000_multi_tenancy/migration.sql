-- عزل المدارس (Multi-tenancy): جدول School + أعمدة schoolId + تعبئة المدرسة الافتراضية.
-- idempotent بالكامل: لا يكسر قاعدة فيها الجداول أصلاً، ولا يحذف أي شيء.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='SchoolStatus') THEN
    CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "School" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- مواءمة جدول School جزئي/قديم (من db push سابق) مع المخطط الحالي.
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='School_code_key')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='School_code_key') THEN
    ALTER TABLE "School" ADD CONSTRAINT "School_code_key" UNIQUE ("code");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "School_status_idx" ON "School"("status");

ALTER TABLE "User"  ADD COLUMN IF NOT EXISTS "schoolId" INTEGER;
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "schoolId" INTEGER;

CREATE INDEX IF NOT EXISTS "User_schoolId_idx"  ON "User"("schoolId");
CREATE INDEX IF NOT EXISTS "Class_schoolId_idx" ON "Class"("schoolId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='User_schoolId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Class_schoolId_fkey') THEN
    ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- مدرسة افتراضية لكل البيانات القائمة حالياً.
INSERT INTO "School" ("code", "name", "status", "updatedAt")
VALUES ('DEFAULT', 'المدرسة الأساسية', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- تعبئة الصفوف القديمة بالمدرسة الافتراضية (المشرف العام يبقى بلا مدرسة ليرى كل المدارس).
UPDATE "User" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT')
WHERE "schoolId" IS NULL AND "role" <> 'SUPER_ADMIN';

UPDATE "Class" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT')
WHERE "schoolId" IS NULL;
