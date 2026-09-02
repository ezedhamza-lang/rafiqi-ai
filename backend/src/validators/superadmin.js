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
