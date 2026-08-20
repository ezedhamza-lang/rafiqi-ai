import { z } from 'zod';

const emailField = z
  .string({ error: 'البريد الإلكتروني غير صالح' })
  .trim()
  .email({ error: 'صيغة البريد الإلكتروني غير صحيحة' });

export const helpRequestCreateSchema = z.object({
  firstName: z.string({ error: 'الاسم مطلوب' }).trim().min(2, { error: 'الاسم مطلوب' }),
  lastName: z.string({ error: 'اللقب مطلوب' }).trim().min(2, { error: 'اللقب مطلوب' }),
  phone: z.string().trim().max(30, { error: 'رقم الهاتف طويل جدا' }).optional().nullable(),
  email: emailField.optional().nullable(),
  requestType: z.string({ error: 'نوع الطلب مطلوب' }).trim().min(1, { error: 'نوع الطلب مطلوب' }),
  delegation: z.string().trim().optional().nullable(),
  description: z.string().trim().max(5000, { error: 'الوصف طويل جدا' }).optional().nullable(),
  userId: z.coerce.number({ error: 'معرف المستخدم غير صحيح' }).int().positive().optional().nullable()
});

export const contactMessageSchema = z.object({
  name: z.string({ error: 'الاسم مطلوب' }).trim().min(2, { error: 'الاسم مطلوب' }),
  email: emailField,
  phone: z.string().trim().max(30, { error: 'رقم الهاتف طويل جدا' }).optional().nullable(),
  subject: z.string().trim().max(200, { error: 'الموضوع طويل جدا' }).optional().nullable(),
  message: z.string({ error: 'الرسالة مطلوبة' }).trim().min(1, { error: 'الرسالة مطلوبة' }).max(5000, { error: 'الرسالة طويلة جدا' })
});
