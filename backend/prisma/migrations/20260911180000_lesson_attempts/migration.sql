-- LessonAttempt: محاولات التلميذ في كتاب التلميذ التفاعلي
-- الإجابات لم تعد تغادر الخادم: فحص server-side + كشف بعد محاولة مسجَّلة
CREATE TABLE IF NOT EXISTS "LessonAttempt" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "gradeId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "blockId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "correct" BOOLEAN NOT NULL DEFAULT false,
  "revealed" BOOLEAN NOT NULL DEFAULT false,
  "lastAnswer" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LessonAttempt_userId_gradeId_subjectId_lessonId_blockId_key"
  ON "LessonAttempt"("userId", "gradeId", "subjectId", "lessonId", "blockId");

CREATE INDEX IF NOT EXISTS "LessonAttempt_userId_gradeId_subjectId_lessonId_idx"
  ON "LessonAttempt"("userId", "gradeId", "subjectId", "lessonId");
