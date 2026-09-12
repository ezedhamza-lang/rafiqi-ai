-- وحدة الحساب الذهني: سجل محاولات التلميذ (دقة/زمن/استراتيجية/نمط خطأ)
CREATE TABLE IF NOT EXISTS "MentalMathAttempt" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "gradeId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "skill" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "studentAnswer" TEXT NOT NULL,
  "correct" BOOLEAN NOT NULL DEFAULT false,
  "errorPattern" TEXT,
  "ms" INTEGER,
  "hintUsed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentalMathAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MentalMathAttempt_userId_skill_idx" ON "MentalMathAttempt"("userId", "skill");
CREATE INDEX IF NOT EXISTS "MentalMathAttempt_userId_createdAt_idx" ON "MentalMathAttempt"("userId", "createdAt");
