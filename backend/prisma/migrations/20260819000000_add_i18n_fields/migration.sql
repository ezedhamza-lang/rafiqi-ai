-- Batch 3.2: Add i18n (English translation) fields to content models
-- These fields are optional (nullable) and will be populated manually from admin panel

-- Add English fields to Announcement table
ALTER TABLE "Announcement" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Announcement" ADD COLUMN "descriptionEn" TEXT;

-- Add English fields to Article table
ALTER TABLE "Article" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "Article" ADD COLUMN "descriptionEn" TEXT;

-- Add English fields to Faq table
ALTER TABLE "Faq" ADD COLUMN "questionEn" TEXT;
ALTER TABLE "Faq" ADD COLUMN "answerEn" TEXT;
