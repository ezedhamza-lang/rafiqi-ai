import { z } from 'zod';
import { idParamSchema } from './common.js';

export const classSubjectCreateSchema = z.object({
  classId: z.coerce.number({ error: 'القسم مطلوب' }).int().positive({ error: 'معرف القسم غير صحيح' }),
  subject: z.enum(['MATH', 'READING', 'SCIENCE', 'STORIES'], { error: 'مادة غير صالحة' }),
  teacherId: z.coerce.number({ error: 'معرف الأستاذ غير صحيح' }).int().positive().optional().nullable()
});

export const classSubjectUpdateSchema = z.object({
  teacherId: z.coerce.number({ error: 'معرف الأستاذ غير صحيح' }).int().positive().optional().nullable()
});

export { idParamSchema as classSubjectIdParamSchema };
