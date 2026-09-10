import { z } from 'zod';
import { idParamSchema } from './common.js';

export const memoGenerateSchema = z.object({
  subject: z.string({ error: 'المادة مطلوبة' }).trim().min(1, { error: 'المادة مطلوبة' }).max(100, { error: 'المادة طويلة جدا' }),
  level: z.string().trim().max(100, { error: 'المستوى طويل جدا' }).optional().nullable(),
  lessonTitle: z.string({ error: 'عنوان الدرس مطلوب' }).trim().min(1, { error: 'عنوان الدرس مطلوب' }).max(300, { error: 'عنوان الدرس طويل جدا' }),
  unit: z.string().trim().max(300, { error: 'الوحدة طويلة جدا' }).optional().nullable(),
  bookTitle: z.string().trim().max(300, { error: 'عنوان الكتاب طويل جدا' }).optional().nullable()
});

export const memoContentSchema = z.object({
  content: z.unknown({ error: 'المحتوى مطلوب' })
});

export const resourceCreateSchema = z.object({
  kind: z.string({ error: 'النوع مطلوب' }).trim().min(1, { error: 'النوع مطلوب' }).max(50, { error: 'النوع غير صالح' }),
  subject: z.string().trim().max(50, { error: 'المادة غير صالحة' }).optional().nullable(),
  level: z.string().trim().max(100, { error: 'المستوى طويل جدا' }).optional().nullable(),
  lessonTitle: z.string({ error: 'عنوان الدرس مطلوب' }).trim().min(1, { error: 'عنوان الدرس مطلوب' }).max(300, { error: 'عنوان الدرس طويل جدا' }),
  input: z.union([z.string().trim().max(5000), z.record(z.unknown())]).optional().nullable()
});

export const resourceContentSchema = z.object({
  content: z.unknown({ error: 'المحتوى مطلوب' })
});

export const resourceShareSchema = z.object({
  shared: z.boolean({ error: 'قيمة المشاركة غير صحيحة' }).optional().nullable()
});

export const libraryQuerySchema = z.object({
  subject: z.string().trim().max(50).optional().nullable(),
  level: z.string().trim().max(100).optional().nullable(),
  kind: z.string().trim().max(50).optional().nullable()
});

export const teacherExamCreateSchema = z.object({
  title: z.string({ error: 'العنوان مطلوب' }).trim().min(1, { error: 'العنوان مطلوب' }).max(200, { error: 'العنوان طويل جدا' }),
  subject: z.string({ error: 'المادة مطلوبة' }).trim().min(1, { error: 'المادة مطلوبة' }).max(50, { error: 'المادة غير صالحة' }),
  classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive().optional().nullable(),
  trimester: z.coerce.number({ error: 'الثلاثي غير صحيح' }).int().min(1).max(3).optional().nullable(),
  content: z.unknown().optional().nullable()
});

export const teacherExamUpdateSchema = z.object({
  title: z.string().trim().max(200, { error: 'العنوان طويل جدا' }).optional(),
  classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive().optional().nullable(),
  trimester: z.coerce.number({ error: 'الثلاثي غير صحيح' }).int().min(1).max(3).optional().nullable(),
  content: z.unknown().optional().nullable(),
  published: z.boolean({ error: 'قيمة النشر غير صحيحة' }).optional().nullable()
});

export const examSubmissionScoreSchema = z.object({
  score: z.coerce.number({ error: 'النقطة غير صحيحة' }).nonnegative({ error: 'النقطة غير صحيحة' }).optional().nullable(),
  status: z
    .enum(['SENT', 'IN_REVIEW', 'CORRECTED'], { error: 'الحالة غير صالحة' })
    .optional()
    .nullable(),
  aiSuggestion: z.unknown().optional().nullable()
});

export const examSubmissionParamsSchema = z.object({
  id: z.coerce.number({ error: 'معرف الاختبار غير صحيح' }).int().positive({ error: 'معرف الاختبار غير صحيح' }),
  subId: z.coerce.number({ error: 'معرف التسليم غير صحيح' }).int().positive({ error: 'معرف التسليم غير صحيح' })
});

export { idParamSchema as teacherContentIdParamSchema };
