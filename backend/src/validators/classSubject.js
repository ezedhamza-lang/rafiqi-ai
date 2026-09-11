import { z } from 'zod';
import { idParamSchema } from './common.js';

export const classSubjectCreateSchema = z.object({
  classId: z.coerce.number({ error: 'القسم مطلوب' }).int().positive({ error: 'معرف القسم غير صحيح' }),
  subject: z.enum(['MATH', 'READING', 'ANISI', 'SCIENCE', 'STORIES', 'PRODUCTION', 'FRENCH', 'ENGLISH', 'CIVIC', 'SPORTS', 'ART', 'TECH', 'MUSIC', 'QURAN', 'GENERAL'], { error: 'مادة غير صالحة' }),
  coefficient: z.coerce.number({ error: 'المعامل غير صحيح' }).int().min(1).max(6).optional().nullable(),
  teacherId: z.coerce.number({ error: 'معرف الأستاذ غير صحيح' }).int().positive().optional().nullable()
});

export const classSubjectUpdateSchema = z.object({
  coefficient: z.coerce.number({ error: 'المعامل غير صحيح' }).int().min(1).max(6).optional().nullable(),
  teacherId: z.coerce.number({ error: 'معرف الأستاذ غير صحيح' }).int().positive().optional().nullable()
});

export { idParamSchema as classSubjectIdParamSchema };
