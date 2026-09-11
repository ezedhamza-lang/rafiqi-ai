-- معاملات المواد + فهرس تعارض جدول الأسبوع
ALTER TABLE "ClassSubject" ADD COLUMN IF NOT EXISTS "coefficient" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "Schedule_teacherId_day_period_idx" ON "Schedule"("teacherId", "day", "period");
