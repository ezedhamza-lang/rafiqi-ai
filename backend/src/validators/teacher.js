import { z } from 'zod';
import { idParamSchema } from './common.js';

export const questionSchema = z
  .object({
    id: z.string().trim().max(100).optional().nullable(),
    type: z.string().trim().max(50).optional().nullable(),
    prompt: z.string().trim().max(5000).optional().nullable(),
    points: z.coerce.number().int().nonnegative().optional().nullable(),
    correctOption: z.string().trim().max(500).optional().nullable(),
    correctAnswer: z.unknown().optional().nullable(),
    options: z.array(z.unknown()).optional().nullable(),
    orderItems: z.array(z.unknown()).optional().nullable()
  })
  .passthrough();

export const quizCreateSchema = z.object({
  title: z.string({ error: 'العنوان مطلوب' }).trim().min(1, { error: 'العنوان مطلوب' }).max(200, { error: 'العنوان طويل جدا' }),
  subject: z.enum(['MATH', 'READING', 'SCIENCE', 'STORIES'], { error: 'مادة غير صالحة' }),
  classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive().optional().nullable(),
  questions: z.array(questionSchema).optional().nullable()
});

export const quizUpdateSchema = z.object({
  title: z.string().trim().max(200, { error: 'العنوان طويل جدا' }).optional(),
  subject: z.enum(['MATH', 'READING', 'SCIENCE', 'STORIES'], { error: 'مادة غير صالحة' }).optional(),
  classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive().optional().nullable(),
  questions: z.array(questionSchema).optional().nullable()
});

export const quizSubmitSchema = z.object({
  answers: z.record(z.unknown()).optional().nullable(),
  durationSec: z.coerce.number({ error: 'المدة غير صحيحة' }).int().nonnegative().optional().nullable()
});

export { idParamSchema as quizIdParamSchema };
