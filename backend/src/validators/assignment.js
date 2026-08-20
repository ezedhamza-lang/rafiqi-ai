import { z } from 'zod';
import { idParamSchema } from './common.js';
import { questionSchema } from './teacher.js';

export const assignmentCreateSchema = z.object({
  title: z.string({ error: 'عنوان التكليف مطلوب' }).trim().min(1, { error: 'عنوان التكليف مطلوب' }).max(200, { error: 'العنوان طويل جدا' }),
  subject: z.string({ error: 'المادة مطلوبة' }).trim().min(1, { error: 'المادة مطلوبة' }).max(100, { error: 'اسم المادة طويل جدا' }),
  classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive().optional().nullable(),
  description: z.string().trim().max(5000, { error: 'الوصف طويل جدا' }).optional().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/, { error: 'تاريخ التسليم غير صحيح' })
    .optional()
    .nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
  questions: z.array(questionSchema).optional().nullable()
});

export const assignmentUpdateSchema = assignmentCreateSchema.partial();

export const assignmentSubmitSchema = z.object({
  answers: z.record(z.unknown()).optional().nullable(),
  durationSec: z.coerce.number({ error: 'المدة غير صحيحة' }).int().nonnegative().optional().nullable()
});

export const assignmentGradeSchema = z.object({
  score: z
    .coerce.number({ error: 'النقطة غير صحيحة' })
    .nonnegative({ error: 'النقطة لا يمكن أن تكون سالبة' })
    .max(100, { error: 'النقطة لا يمكن أن تتجاوز 100%' }),
  feedback: z.string().trim().max(5000, { error: 'الملاحظة طويلة جدا' }).optional().nullable()
});

export const assignmentSubmissionParamSchema = z.object({
  id: idParamSchema.shape.id,
  submissionId: z.coerce.number({ error: 'معرف التسليم غير صحيح' }).int().positive({ error: 'معرف التسليم غير صحيح' })
});

export { idParamSchema as assignmentIdParamSchema };
