import { z } from 'zod';
import { dateStringSchema } from './common.js';

const VALID_TYPES = ['HOLIDAY', 'EXAM', 'MEETING', 'ACTIVITY', 'OTHER'];
const VALID_AUDIENCES = ['ALL', 'STUDENT', 'PARENT', 'TEACHER', 'DIRECTOR'];

export const calendarEventCreateSchema = z.object({
  title: z.string().trim().min(1, { error: 'العنوان مطلوب' }).max(200, { error: 'العنوان طويل جدا' }),
  description: z.string().trim().max(2000, { error: 'الوصف طويل جدا' }).optional().nullable(),
  type: z.enum(VALID_TYPES, { error: 'نوع الحدث غير صالح' }).default('OTHER'),
  date: dateStringSchema,
  level: z.string().trim().optional().nullable(),
  audience: z.enum(VALID_AUDIENCES, { error: 'الجمهور غير صالح' }).default('ALL')
});

export const calendarEventUpdateSchema = z.object({
  title: z.string().trim().min(1, { error: 'العنوان مطلوب' }).max(200, { error: 'العنوان طويل جدا' }).optional(),
  description: z.string().trim().max(2000, { error: 'الوصف طويل جدا' }).optional().nullable(),
  type: z.enum(VALID_TYPES, { error: 'نوع الحدث غير صالح' }).optional(),
  date: dateStringSchema.optional(),
  level: z.string().trim().optional().nullable(),
  audience: z.enum(VALID_AUDIENCES, { error: 'الجمهور غير صالح' }).optional()
});
