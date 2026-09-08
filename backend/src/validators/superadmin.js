import { z } from 'zod';
import { idParamSchema, dateStringSchema } from './common.js';

export const licenseCreateSchema = z.object({
  entityName: z.string({ error: 'اسم المؤسسة مطلوب' }).trim().min(1, { error: 'اسم المؤسسة مطلوب' }).max(200, { error: 'اسم المؤسسة طويل جدا' }),
  expiresAt: dateStringSchema.optional().nullable()
});

export const superAdminSubscriptionCreateSchema = z.object({
  userId: z.coerce.number({ error: 'معرف المستخدم غير صحيح' }).int().positive({ error: 'معرف المستخدم غير صحيح' }),
  type: z.enum(['STUDENT', 'TEACHER'], { error: 'نوع اشتراك غير صالح' }),
  schoolYear: z.string().trim().max(20, { error: 'السنة الدراسية غير صحيحة' }).optional().nullable(),
  amount: z.coerce.number({ error: 'المبلغ غير صحيح' }).nonnegative({ error: 'المبلغ غير صحيح' }).optional().nullable()
});

export const superAdminRoleUpdateSchema = z.object({
  role: z.enum(['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'], { error: 'دور غير صالح' })
});

export const superAdminUsersQuerySchema = z.object({
  q: z.string().trim().max(100, { error: 'بحث طويل جدا' }).optional().nullable(),
  role: z
    .enum(['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'], { error: 'دور غير صالح' })
    .optional()
    .nullable()
});

export { idParamSchema as superAdminIdParamSchema };

export const superAdminPasswordResetSchema = z.object({
  password: z.string().trim().min(6, { error: 'كلمة السر قصيرة جدا (6 أحرف على الأقل)' }).max(100, { error: 'كلمة السر طويلة جدا' }).optional().nullable()
});

export const superAdminUserCreateSchema = z.object({
  firstName: z.string({ error: 'الاسم مطلوب' }).trim().min(2, { error: 'الاسم قصير جدا' }).max(100, { error: 'الاسم طويل جدا' }),
  lastName: z.string({ error: 'اللقب مطلوب' }).trim().min(2, { error: 'اللقب قصير جدا' }).max(100, { error: 'اللقب طويل جدا' }),
  email: z.string({ error: 'البريد مطلوب' }).trim().email({ error: 'البريد غير صحيح' }).max(150, { error: 'البريد طويل جدا' }),
  phone: z.string().trim().max(30, { error: 'الهاتف طويل جدا' }).optional().nullable(),
  role: z.enum(['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'], { error: 'دور غير صالح' }).optional().nullable(),
  password: z.string().trim().min(6, { error: 'كلمة السر قصيرة جدا (6 أحرف على الأقل)' }).max(100, { error: 'كلمة السر طويلة جدا' }).optional().nullable()
});

export const schoolCreateSchema = z.object({
  code: z.string({ error: 'رمز المدرسة مطلوب' }).trim().min(1, { error: 'رمز المدرسة مطلوب' }).max(40, { error: 'الرمز طويل جدا' }),
  name: z.string({ error: 'اسم المدرسة مطلوب' }).trim().min(2, { error: 'الاسم قصير جدا' }).max(200, { error: 'الاسم طويل جدا' }),
  address: z.string().trim().max(250, { error: 'العنوان طويل جدا' }).optional().nullable(),
  phone: z.string().trim().max(30, { error: 'الهاتف طويل جدا' }).optional().nullable(),
  email: z.string().trim().email({ error: 'البريد غير صحيح' }).max(150, { error: 'البريد طويل جدا' }).optional().nullable()
});

export const schoolUpdateSchema = z.object({
  code: z.string().trim().min(1).max(40).optional().nullable(),
  name: z.string().trim().min(2).max(200).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email({ error: 'البريد غير صحيح' }).max(150).optional().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED'], { error: 'حالة غير صالحة' }).optional().nullable()
});

export const assignSchoolSchema = z.object({
  schoolId: z.coerce.number({ error: 'معرف المدرسة غير صحيح' }).int().positive({ error: 'معرف المدرسة غير صحيح' })
});
