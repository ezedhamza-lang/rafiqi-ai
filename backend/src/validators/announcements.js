import { z } from 'zod';

export const announcementCreateSchema = z.object({
  title: z
    .string({ error: 'عنوان الإعلان مطلوب' })
    .trim()
    .min(1, { error: 'عنوان الإعلان مطلوب' })
    .max(200, { error: 'عنوان الإعلان طويل جدا' }),
  body: z
    .string({ error: 'نص الإعلان مطلوب' })
    .trim()
    .min(1, { error: 'نص الإعلان مطلوب' })
    .max(5000, { error: 'نص الإعلان طويل جدا' }),
  category: z.enum(['GENERAL', 'URGENT', 'EXAM', 'EVENT', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  audience: z
    .array(z.enum(['ALL', 'STUDENT', 'PARENT', 'TEACHER', 'DIRECTOR', 'ADMIN']))
    .min(1, { error: 'اختر جمهور الإعلان' })
    .optional(),
  level: z.string().trim().max(100).optional().nullable(),
  link: z.string().trim().max(300).optional().nullable(),
  channels: z.array(z.enum(['IN_APP', 'PUSH', 'EMAIL', 'SMS'])).optional()
});

export const audienceCountQuerySchema = z.object({
  audience: z.string().trim().max(200).optional().nullable(),
  level: z.string().trim().max(100).optional().nullable()
});
