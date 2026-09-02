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
  // اختيار الدور عند التسجيل — الأولياء/التلاميذ/الأساتذة يسجّلون بأنفسهم،
  // أما المدير والإدارة فتُنشأ من طرف السوبر أدمن فقط (لا يتسجّلون من هنا).
  role: z.enum(['PARENT', 'STUDENT', 'TEACHER']).optional().default('PARENT')
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'كلمة السر مطلوبة' })
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, { error: 'رمز التجديد غير صالح' })
});

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, { error: 'رمز الاستعادة غير صالح' }),
  password: z.string().min(6, { error: 'كلمة السر يجب أن تحتوي على 6 أحرف على الأقل' })
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20, { error: 'رمز التأكيد غير صالح' })
});
