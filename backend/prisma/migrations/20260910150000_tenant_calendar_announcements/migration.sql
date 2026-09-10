-- P1-A: عزل مدارس للتقويم والإعلانات — أعمدة schoolId (nullable = عالمي) + فهارس + backfill
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "schoolId" INTEGER;
CREATE INDEX IF NOT EXISTS "CalendarEvent_schoolId_idx" ON "CalendarEvent"("schoolId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_schoolId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "SchoolAnnouncement" ADD COLUMN IF NOT EXISTS "schoolId" INTEGER;
CREATE INDEX IF NOT EXISTS "SchoolAnnouncement_schoolId_idx" ON "SchoolAnnouncement"("schoolId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolAnnouncement_schoolId_fkey') THEN
    ALTER TABLE "SchoolAnnouncement" ADD CONSTRAINT "SchoolAnnouncement_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- تعبئة لمرة واحدة (ledger): أحداث/إعلانات منشئي مدرسة معروفة تُنسب لمدرستهم.
-- ما أنشأه ADMIN/SUPER_ADMIN يبقى NULL = عالمي.
UPDATE "CalendarEvent" ce SET "schoolId" = u."schoolId"
  FROM "User" u WHERE ce."createdBy" = u.id AND ce."schoolId" IS NULL AND u."schoolId" IS NOT NULL;
UPDATE "SchoolAnnouncement" sa SET "schoolId" = u."schoolId"
  FROM "User" u WHERE sa."createdBy" = u.id AND sa."schoolId" IS NULL AND u."schoolId" IS NOT NULL;
