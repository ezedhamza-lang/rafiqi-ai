import { z } from 'zod';
import { idParamSchema } from './common.js';

export const annualPlanCreateSchema = z.object({
  subject: z.string({ error: 'المادة مطلوبة' }).trim().min(1, { error: 'المادة مطلوبة' }).max(100, { error: 'المادة طويلة جدا' }),
  level: z.string().trim().max(100, { error: 'المستوى طويل جدا' }).optional().nullable(),
  title: z.string({ error: 'العنوان مطلوب' }).trim().min(1, { error: 'العنوان مطلوب' }).max(300, { error: 'العنوان طويل جدا' }),
  content: z.unknown().optional().nullable()
});

export const annualPlanContentSchema = z.object({
  content: z.unknown({ error: 'المحتوى مطلوب' })
});

const scheduleCellSchema = z
  .object({
    subject: z.string().trim().max(100).optional().nullable(),
    teacherId: z.coerce.number().int().positive().optional().nullable(),
    filled: z.boolean().optional().nullable()
  })
  .passthrough();

export const scheduleGridSchema = z.object({
  grid: z
    .array(z.array(scheduleCellSchema).optional().nullable(), { error: 'الجدول يجب أن يحتوي 6 أيام' })
    .length(6, { error: 'الجدول يجب أن يحتوي 6 أيام' })
});

export const classIdParamSchema = z.object({
  classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive({ error: 'معرف القسم غير صحيح' })
});

export { idParamSchema as annualPlanIdParamSchema };
