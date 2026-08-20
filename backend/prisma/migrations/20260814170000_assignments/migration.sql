-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED');

-- CreateTable
CREATE TABLE "Assignment" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "classId" INTEGER,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "questions" JSONB NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "graded" JSONB,
    "score" DOUBLE PRECISION,
    "totalPoints" DOUBLE PRECISION,
    "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "feedback" TEXT,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_teacherId_idx" ON "Assignment"("teacherId");

-- CreateIndex
CREATE INDEX "Assignment_classId_idx" ON "Assignment"("classId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_studentId_idx" ON "AssignmentSubmission"("studentId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_idx" ON "AssignmentSubmission"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

