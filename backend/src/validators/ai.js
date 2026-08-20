import { z } from 'zod';

export const aiKeySchema = z.object({
  apiKey: z.string({ error: 'المفتاح مطلوب' }).trim().min(1, { error: 'المفتاح مطلوب' }).max(2000, { error: 'المفتاح طويل جدا' })
});

export const aiQuizGenSchema = z.object({
  subject: z.string().trim().max(50).optional().nullable(),
  level: z.string().trim().max(100).optional().nullable(),
  lessonTitle: z.string().trim().max(300).optional().nullable(),
  count: z.coerce.number({ error: 'العدد غير صحيح' }).int().min(1).max(30).optional().nullable()
});

export const aiStoryGenSchema = z.object({
  level: z.string().trim().max(100).optional().nullable(),
  theme: z.string().trim().max(200).optional().nullable()
});

export const aiGradeShortSchema = z.object({
  question: z.string({ error: 'السؤال مطلوب' }).trim().min(1, { error: 'السؤال مطلوب' }).max(5000, { error: 'السؤال طويل جدا' }),
  modelAnswer: z.string({ error: 'الإجابة النموذجية مطلوبة' }).trim().min(1, { error: 'الإجابة النموذجية مطلوبة' }).max(5000, { error: 'الإجابة النموذجية طويلة جدا' }),
  studentAnswer: z.string({ error: 'إجابة التلميذ مطلوبة' }).trim().min(1, { error: 'إجابة التلميذ مطلوبة' }).max(5000, { error: 'إجابة التلميذ طويلة جدا' })
});

export const aiGradeSuggestionSchema = z.object({
  question: z.string({ error: 'السؤال مطلوب' }).trim().min(1, { error: 'السؤال مطلوب' }).max(5000, { error: 'السؤال طويل جدا' }),
  studentAnswer: z.string({ error: 'إجابة التلميذ مطلوبة' }).trim().min(1, { error: 'إجابة التلميذ مطلوبة' }).max(5000, { error: 'إجابة التلميذ طويلة جدا' })
});

export const aiReviewSchema = z.object({
  content: z.string({ error: 'المحتوى مطلوب' }).trim().min(1, { error: 'المحتوى مطلوب' }).max(20000, { error: 'المحتوى طويل جدا' }),
  type: z.string().trim().max(50).optional().nullable()
});

export const aiChatSchema = z.object({
  message: z.string({ error: 'الرسالة مطلوبة' }).trim().min(1, { error: 'الرسالة مطلوبة' }).max(500, { error: 'الرسالة طويلة جدا' }),
  gradeId: z.string().trim().max(50).optional().nullable(),
  subjectId: z.string().trim().max(50).optional().nullable(),
  lessonId: z.string().trim().max(100).optional().nullable()
});

export const aiLessonPlanSchema = z.object({
  subject: z.string().trim().max(50).optional().nullable(),
  level: z.string().trim().max(100).optional().nullable(),
  lessonTitle: z.string({ error: 'عنوان الدرس مطلوب' }).trim().min(1, { error: 'عنوان الدرس مطلوب' }).max(300, { error: 'عنوان الدرس طويل جدا' }),
  duration: z.coerce.number({ error: 'المدة غير صحيحة' }).int().min(10).max(180).optional().nullable(),
  gradeId: z.string().trim().max(50).optional().nullable(),
  subjectId: z.string().trim().max(50).optional().nullable(),
  lessonId: z.string().trim().max(100).optional().nullable()
});

export const aiSummarySchema = z.object({
  subject: z.string().trim().max(50).optional().nullable(),
  level: z.string().trim().max(100).optional().nullable(),
  lessonTitle: z.string({ error: 'عنوان الدرس مطلوب' }).trim().min(1, { error: 'عنوان الدرس مطلوب' }).max(300, { error: 'عنوان الدرس طويل جدا' }),
  maxWords: z.coerce.number({ error: 'العدد غير صحيح' }).int().min(30).max(500).optional().nullable(),
  gradeId: z.string().trim().max(50).optional().nullable(),
  subjectId: z.string().trim().max(50).optional().nullable(),
  lessonId: z.string().trim().max(100).optional().nullable()
});

export const aiPresentationSchema = z.object({
  subject: z.string().trim().max(50).optional().nullable(),
  level: z.string().trim().max(100).optional().nullable(),
  lessonTitle: z.string({ error: 'عنوان الدرس مطلوب' }).trim().min(1, { error: 'عنوان الدرس مطلوب' }).max(300, { error: 'عنوان الدرس طويل جدا' }),
  slideCount: z.coerce.number({ error: 'العدد غير صحيح' }).int().min(3).max(25).optional().nullable(),
  gradeId: z.string().trim().max(50).optional().nullable(),
  subjectId: z.string().trim().max(50).optional().nullable(),
  lessonId: z.string().trim().max(100).optional().nullable()
});
