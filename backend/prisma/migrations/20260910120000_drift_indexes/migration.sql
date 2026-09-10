-- P0-F: سد فجوة schema↔migrations + فهارس أجنبية ساخنة + توحيد النقدي في التخفيضات
-- (كل العبارات idempotent آمنة التكرار)

-- 1) جدولان كانا يُنشآن فقط بضمانات الإقلاع بلا هجرة رسمية
CREATE TABLE IF NOT EXISTS "SubjectDistribution" (
  "id" SERIAL PRIMARY KEY,
  "classId" INTEGER NOT NULL UNIQUE,
  "grade" INTEGER NOT NULL,
  "subjects" JSONB NOT NULL,
  "timetable" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE
);
ALTER TABLE "SubjectDistribution" ADD COLUMN IF NOT EXISTS "timetable" JSONB;

CREATE TABLE IF NOT EXISTS "LessonSubmission" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "lessonId" TEXT NOT NULL,
  "lessonTitle" TEXT,
  "answers" JSONB NOT NULL,
  "files" JSONB,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "grade" INTEGER,
  "feedback" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gradedAt" TIMESTAMP(3),
  "gradedBy" INTEGER,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "LessonSubmission_userId_lessonId_idx" ON "LessonSubmission"("userId", "lessonId");
CREATE INDEX IF NOT EXISTS "LessonSubmission_userId_status_idx" ON "LessonSubmission"("userId", "status");
CREATE INDEX IF NOT EXISTS "LessonSubmission_status_idx" ON "LessonSubmission"("status");

-- 2) فهارس مفاتيح أجنبية ساخنة (Prisma لا ينشئها تلقائياً)
CREATE INDEX IF NOT EXISTS "Student_userId_idx" ON "Student"("userId");
CREATE INDEX IF NOT EXISTS "Student_classId_idx" ON "Student"("classId");
CREATE INDEX IF NOT EXISTS "Registration_userId_idx" ON "Registration"("userId");
CREATE INDEX IF NOT EXISTS "Registration_studentId_idx" ON "Registration"("studentId");
CREATE INDEX IF NOT EXISTS "Registration_classId_idx" ON "Registration"("classId");
CREATE INDEX IF NOT EXISTS "Payment_paidByUserId_idx" ON "Payment"("paidByUserId");
CREATE INDEX IF NOT EXISTS "Subscription_studentId_idx" ON "Subscription"("studentId");
CREATE INDEX IF NOT EXISTS "Quiz_teacherId_idx" ON "Quiz"("teacherId");
CREATE INDEX IF NOT EXISTS "OfficialExam_teacherId_idx" ON "OfficialExam"("teacherId");
CREATE INDEX IF NOT EXISTS "AnnualPlan_teacherId_idx" ON "AnnualPlan"("teacherId");
CREATE INDEX IF NOT EXISTS "Class_teacherId_idx" ON "Class"("teacherId");
CREATE INDEX IF NOT EXISTS "SubmittedExam_classId_idx" ON "SubmittedExam"("classId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_recordedBy_idx" ON "AttendanceRecord"("recordedBy");
CREATE INDEX IF NOT EXISTS "CalendarEvent_createdBy_idx" ON "CalendarEvent"("createdBy");
CREATE INDEX IF NOT EXISTS "SchoolAnnouncement_createdBy_idx" ON "SchoolAnnouncement"("createdBy");
CREATE INDEX IF NOT EXISTS "Refund_refundedBy_idx" ON "Refund"("refundedBy");
CREATE INDEX IF NOT EXISTS "DiscountCode_createdBy_idx" ON "DiscountCode"("createdBy");
CREATE INDEX IF NOT EXISTS "HelpRequest_userId_idx" ON "HelpRequest"("userId");

-- 3) قيمة التخفيض النقدية: Float → Decimal(12,3) (محمي بفحص النوع كما في money_decimal)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DiscountCode' AND column_name = 'value' AND data_type = 'double precision'
  ) THEN
    ALTER TABLE "DiscountCode" ALTER COLUMN "value" TYPE DECIMAL(12,3) USING "value"::decimal;
  END IF;
END $$;
