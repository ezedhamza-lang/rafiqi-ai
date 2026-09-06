import { z } from 'zod';
import { idParamSchema, optionalText } from './common.js';

export const directorRequestApproveSchema = z.object({
  classId: z.coerce.number({ error: 'يرجى اختيار القسم' }).int().positive({ error: 'يرجى اختيار القسم' })
});

export const directorRequestRejectSchema = z.object({
  reason: optionalText(2000, 'سبب الرفض')
});

export const directorBroadcastSchema = z.object({
  title: z.string({ error: 'عنوان التنبيه مطلوب' }).trim().min(1, { error: 'عنوان التنبيه مطلوب' }).max(200, { error: 'العنوان طويل جدا' }),
  message: z.string({ error: 'نص التنبيه مطلوب' }).trim().min(1, { error: 'نص التنبيه مطلوب' }).max(2000, { error: 'النص طويل جدا' })
});

export const directorStatusQuerySchema = z
  .object({
    status: z
      .enum(['PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE', 'REJECTED', 'CANCELLED'], { error: 'حالة غير صالحة' })
      .optional()
      .nullable()
  });

export { idParamSchema as directorRequestIdParamSchema };

export const directorClassCreateSchema = z.object({
  name: z.string({ error: 'اسم القسم مطلوب' }).trim().min(2, { error: 'اسم القسم قصير جدا' }).max(120, { error: 'اسم القسم طويل جدا' }),
  level: z.string({ error: 'المستوى مطلوب' }).trim().min(2, { error: 'المستوى مطلوب' }).max(120, { error: 'المستوى طويل جدا' }),
  teacherId: z.coerce.number({ error: 'معرف الأستاذ غير صحيح' }).int().positive({ error: 'معرف الأستاذ غير صحيح' }).optional().nullable(),
  schoolYear: z.string().trim().max(20, { error: 'السنة الدراسية طويلة جدا' }).optional().nullable()
});

export const directorClassUpdateSchema = z.object({
  name: z.string().trim().min(2, { error: 'اسم القسم قصير جدا' }).max(120, { error: 'اسم القسم طويل جدا' }).optional().nullable(),
  level: z.string().trim().min(2, { error: 'المستوى مطلوب' }).max(120, { error: 'المستوى طويل جدا' }).optional().nullable(),
  teacherId: z.coerce.number({ error: 'معرف الأستاذ غير صحيح' }).int().positive({ error: 'معرف الأستاذ غير صحيح' }).optional().nullable(),
  schoolYear: z.string().trim().max(20, { error: 'السنة الدراسية طويلة جدا' }).optional().nullable()
});

export { idParamSchema as directorClassIdParamSchema };
