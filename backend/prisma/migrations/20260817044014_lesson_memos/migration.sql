-- CreateTable
CREATE TABLE "LessonMemo" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "bookId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "lessonTitle" TEXT NOT NULL,
    "lessonType" TEXT,
    "unit" TEXT,
    "methodologyId" TEXT NOT NULL,
    "methodologyTitle" TEXT,
    "hash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonMemo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonMemo_hash_key" ON "LessonMemo"("hash");

-- CreateIndex
CREATE INDEX "LessonMemo_teacherId_idx" ON "LessonMemo"("teacherId");

-- CreateIndex
CREATE INDEX "LessonMemo_hash_idx" ON "LessonMemo"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "LessonMemo_bookId_lessonId_key" ON "LessonMemo"("bookId", "lessonId");

-- AddForeignKey
ALTER TABLE "LessonMemo" ADD CONSTRAINT "LessonMemo_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
