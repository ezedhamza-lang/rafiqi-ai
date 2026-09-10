import { z } from 'zod';

const emailSchema = z
  .string({ error: 'البريد الإلكتروني مطلوب' })
  .trim()
  .email({ error: 'صيغة البريد الإلكتروني غير صحيحة' })
  .toLowerCase();

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, { error: 'الاسم يجب أن يحتوي على حرفين على الأقل' }),
  lastName: z.string().trim().min(2, { error: 'اللقب يجب أن يحتوي على حرفين على الأقل' }),
  email: emailSchema,
  phone: z.string().trim().optional().nullable(),
  password: z.string().min(6, { error: 'كلمة السر يجب أن تحتوي على 6 أحرف على الأقل' }),
  schoolId: z.coerce.number().int().positive({ error: 'المدرسة غير صالحة' }).optional().nullable()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'كلمة السر مطلوبة' })
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, { error: 'رمز التجديد غير صالح' })
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: 'كلمة السر الحالية مطلوبة' }),
  newPassword: z.string().min(6, { error: 'كلمة السر الجديدة يجب أن تحتوي على 6 أحرف على الأقل' })
});
