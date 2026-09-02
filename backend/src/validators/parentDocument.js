import { z } from 'zod';
import { idParamSchema } from './common.js';

export const parentDocCreateSchema = z.object({
  studentId: z.coerce.number({ error: 'معرف التلميذ غير صحيح' }).int().positive().optional().nullable(),
  docType: z.string({ error: 'يرجى اختيار نوع الوثيقة' }).trim().min(1, { error: 'يرجى اختيار نوع الوثيقة' }).max(100, { error: 'نوع الوثيقة طويل جدا' }),
  title: z.string().trim().max(200, { error: 'العنوان طويل جدا' }).optional().nullable(),
  note: z.string().trim().max(2000, { error: 'الملاحظة طويلة جدا' }).optional().nullable()
});

export const docReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], { error: 'حالة غير صالحة' }),
  directorReply: z.string().trim().max(2000, { error: 'الرد طويل جدا' }).optional().nullable()
});

export const parentDocStatusQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'], { error: 'حالة غير صالحة' })
    .optional()
    .nullable()
});

export { idParamSchema as parentDocIdParamSchema };
