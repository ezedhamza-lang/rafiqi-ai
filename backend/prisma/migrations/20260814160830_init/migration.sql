-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "SubscriptionRequestStatus" AS ENUM ('PENDING_APPROVAL', 'REJECTED', 'CANCELLED', 'PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED', 'PROCESSING');

-- CreateEnum
CREATE TYPE "LessonSubject" AS ENUM ('MATH', 'READING', 'SCIENCE', 'STORIES');

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('WORKSHEET', 'HOMEWORK', 'FLASHCARDS', 'PRESENTATION', 'LESSON_PLAN');

-- CreateEnum
CREATE TYPE "ParentDocumentStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('HOLIDAY', 'EXAM', 'MEETING', 'ACTIVITY', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL DEFAULT '2026-2027',
    "teacherId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "classId" INTEGER,
    "accountUserId" INTEGER,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "cin" TEXT,
    "gender" TEXT,
    "level" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL DEFAULT '2026-2027',
    "schoolName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "classId" INTEGER,
    "schoolYear" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'عام',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" SERIAL NOT NULL,
    "subject" "LessonSubject" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'السنة الأولى أساسي',
    "fileUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "classId" INTEGER,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialExam" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "classId" INTEGER,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "trimester" INTEGER,
    "fileUrl" TEXT,
    "content" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialSubmission" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "answers" JSONB,
    "score" DOUBLE PRECISION,
    "aiSuggestion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memo" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "bookTitle" TEXT,
    "unit" TEXT,
    "lessonTitle" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingResource" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "kind" "ResourceKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "lessonTitle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnualPlan" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "teacherId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "senderId" INTEGER NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "attachmentType" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "plan" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL DEFAULT '2026-2027',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "amount" DOUBLE PRECISION,
    "studentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'OFFLINE',
    "reference" TEXT,
    "paidByUserId" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionRequest" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "cin" TEXT,
    "gender" TEXT,
    "level" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "schoolName" TEXT,
    "notes" TEXT,
    "classId" INTEGER,
    "status" "SubscriptionRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "rejectionReason" TEXT,
    "studentId" INTEGER,
    "subscriptionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKey" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "keyEncrypted" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "condition" JSONB NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentBadge" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "badgeId" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentChat" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "requestType" TEXT NOT NULL,
    "delegation" TEXT,
    "description" TEXT,
    "attachment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubject" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "teacherId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "game" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "durationSec" INTEGER,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmittedExam" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "teacherId" INTEGER,
    "classId" INTEGER,
    "subject" TEXT NOT NULL,
    "examTitle" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "imageUrls" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmittedExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentDocument" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "studentId" INTEGER,
    "docType" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "ParentDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "directorReply" TEXT,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "recordedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL DEFAULT 'OTHER',
    "date" DATE NOT NULL,
    "level" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "emergencyPhone" TEXT,
    "bloodType" TEXT,
    "notes" TEXT,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Student_accountUserId_key" ON "Student"("accountUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Delegation_name_key" ON "Delegation"("name");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE INDEX "Submission_quizId_idx" ON "Submission"("quizId");

-- CreateIndex
CREATE INDEX "OfficialSubmission_studentId_idx" ON "OfficialSubmission"("studentId");

-- CreateIndex
CREATE INDEX "OfficialSubmission_examId_idx" ON "OfficialSubmission"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "Memo_hash_key" ON "Memo"("hash");

-- CreateIndex
CREATE INDEX "Memo_hash_idx" ON "Memo"("hash");

-- CreateIndex
CREATE INDEX "TeachingResource_kind_idx" ON "TeachingResource"("kind");

-- CreateIndex
CREATE INDEX "TeachingResource_isShared_idx" ON "TeachingResource"("isShared");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_classId_day_period_key" ON "Schedule"("classId", "day", "period");

-- CreateIndex
CREATE INDEX "Message_senderId_recipientId_idx" ON "Message"("senderId", "recipientId");

-- CreateIndex
CREATE INDEX "Message_recipientId_idx" ON "Message"("recipientId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "License_key_key" ON "License"("key");

-- CreateIndex
CREATE INDEX "License_status_idx" ON "License"("status");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionRequest_parentId_status_idx" ON "SubscriptionRequest"("parentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiKey_teacherId_key" ON "AiKey"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_key_key" ON "Badge"("key");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBadge_studentId_badgeId_key" ON "StudentBadge"("studentId", "badgeId");

-- CreateIndex
CREATE INDEX "ActivityLog_studentId_idx" ON "ActivityLog"("studentId");

-- CreateIndex
CREATE INDEX "StudentChat_studentId_idx" ON "StudentChat"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubject_classId_subject_key" ON "ClassSubject"("classId", "subject");

-- CreateIndex
CREATE INDEX "GameResult_studentId_idx" ON "GameResult"("studentId");

-- CreateIndex
CREATE INDEX "GameResult_game_idx" ON "GameResult"("game");

-- CreateIndex
CREATE INDEX "SubmittedExam_studentId_idx" ON "SubmittedExam"("studentId");

-- CreateIndex
CREATE INDEX "SubmittedExam_teacherId_status_idx" ON "SubmittedExam"("teacherId", "status");

-- CreateIndex
CREATE INDEX "ParentDocument_parentId_status_idx" ON "ParentDocument"("parentId", "status");

-- CreateIndex
CREATE INDEX "ParentDocument_status_idx" ON "ParentDocument"("status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_date_idx" ON "AttendanceRecord"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_classId_studentId_date_key" ON "AttendanceRecord"("classId", "studentId", "date");

-- CreateIndex
CREATE INDEX "CalendarEvent_date_idx" ON "CalendarEvent"("date");

-- CreateIndex
CREATE UNIQUE INDEX "HealthRecord_studentId_key" ON "HealthRecord"("studentId");

-- CreateIndex
CREATE INDEX "HealthRecord_studentId_idx" ON "HealthRecord"("studentId");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_accountUserId_fkey" FOREIGN KEY ("accountUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialExam" ADD CONSTRAINT "OfficialExam_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialExam" ADD CONSTRAINT "OfficialExam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialSubmission" ADD CONSTRAINT "OfficialSubmission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "OfficialExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialSubmission" ADD CONSTRAINT "OfficialSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingResource" ADD CONSTRAINT "TeachingResource_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualPlan" ADD CONSTRAINT "AnnualPlan_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionRequest" ADD CONSTRAINT "SubscriptionRequest_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKey" ADD CONSTRAINT "AiKey_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentChat" ADD CONSTRAINT "StudentChat_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedExam" ADD CONSTRAINT "SubmittedExam_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedExam" ADD CONSTRAINT "SubmittedExam_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedExam" ADD CONSTRAINT "SubmittedExam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentDocument" ADD CONSTRAINT "ParentDocument_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentDocument" ADD CONSTRAINT "ParentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
