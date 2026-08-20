import { z } from 'zod';
import { idParamSchema } from './common.js';

export const submittedExamCreateSchema = z.object({
  subject: z.enum(['MATH', 'READING', 'SCIENCE', 'STORIES'], { error: 'المادة غير صالحة' }),
  examTitle: z.string({ error: 'عنوان الاختبار مطلوب' }).trim().min(1, { error: 'عنوان الاختبار مطلوب' }).max(300, { error: 'عنوان الاختبار طويل جدا' })
});

export const submittedExamUpdateSchema = z.object({
  score: z.coerce.number({ error: 'النقطة غير صحيحة' }).nonnegative({ error: 'النقطة غير صحيحة' }).optional().nullable(),
  feedback: z.string().trim().max(5000, { error: 'الملاحظة طويلة جدا' }).optional().nullable(),
  status: z.enum(['SENT', 'IN_REVIEW', 'CORRECTED'], { error: 'الحالة غير صالحة' }).optional().nullable()
});

export const submittedExamStatusQuerySchema = z
  .object({
    status: z.enum(['SENT', 'IN_REVIEW', 'CORRECTED'], { error: 'حالة غير صالحة' }).optional().nullable()
  });

export { idParamSchema as submittedExamIdParamSchema };
