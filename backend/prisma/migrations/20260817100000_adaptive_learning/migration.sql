-- CreateTable
CREATE TABLE "AdaptiveCard" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "itemKey" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastQuality" INTEGER,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveCard_userId_itemKey_key" ON "AdaptiveCard"("userId", "itemKey");

-- CreateIndex
CREATE INDEX "AdaptiveCard_userId_gradeId_subjectId_dueAt_idx" ON "AdaptiveCard"("userId", "gradeId", "subjectId", "dueAt");

-- CreateIndex
CREATE INDEX "AdaptiveCard_userId_gradeId_subjectId_idx" ON "AdaptiveCard"("userId", "gradeId", "subjectId");

-- AddForeignKey
ALTER TABLE "AdaptiveCard" ADD CONSTRAINT "AdaptiveCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
