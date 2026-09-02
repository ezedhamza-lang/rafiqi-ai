-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "schoolId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "schoolId" INTEGER;

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE INDEX "School_status_idx" ON "School"("status");

-- CreateIndex
CREATE INDEX "Class_schoolId_idx" ON "Class"("schoolId");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- >>> تعدد المدارس: المدرسة الافتراضية + ربط البيانات القائمة <<<
INSERT INTO "School" ("name", "code", "status", "createdAt", "updatedAt")
SELECT 'المدرسة النموذجية', 'SCH-001', 'ACTIVE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "School" WHERE "code" = 'SCH-001');

UPDATE "User" SET "schoolId" = (SELECT id FROM "School" WHERE code = 'SCH-001')
WHERE "schoolId" IS NULL AND "role" <> 'SUPER_ADMIN';

UPDATE "Class" SET "schoolId" = (SELECT id FROM "School" WHERE code = 'SCH-001')
WHERE "schoolId" IS NULL;
