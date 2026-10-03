import { z } from 'zod';
import { idParamSchema } from './common.js';

export const memoGenerateSchema = z.object({
  subject: z
    .string({ error: 'المادة مطلوبة' })
    .trim()
    .min(1, { error: 'المادة مطلوبة' })
    .max(100, { error: 'المادة طويلة جدا' }),
  level: z.string().trim().max(100, { error: 'المستوى طويل جدا' }).optional().nullable(),
  lessonTitle: z
    .string({ error: 'عنوان الدرس مطلوب' })
    .trim()
    .max(300, { error: 'عنوان الدرس طويل جدا' })
    .optional()
    .nullable(),
  lessonType: z.string().trim().max(100, { error: 'نوع الدرس طويل جدا' }).optional().nullable(),
  unit: z.string().trim().max(300, { error: 'الوحدة طويلة جدا' }).optional().nullable(),
  useOfficial: z.boolean().optional().nullable(),
  officialRef: z.string().trim().max(50, { error: 'مرجع المذكرة طويل جدا' }).optional().nullable()
}).refine(
  (d) => (d.lessonTitle && d.lessonTitle.trim()) || (d.officialRef && d.officialRef.trim()),
  { error: 'عنوان الدرس مطلوب (أو اختر مذكرة رسمية مباشرة)', path: ['lessonTitle'] }
);

export const memosListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().nullable()
});

export const memosOfficialQuerySchema = z.object({
  subject: z.string().trim().max(100, { error: 'المادة طويلة جدا' }).optional().nullable(),
  level: z.string().trim().max(100, { error: 'المستوى طويل جدا' }).optional().nullable()
});

export { idParamSchema as memoIdParamSchema };
