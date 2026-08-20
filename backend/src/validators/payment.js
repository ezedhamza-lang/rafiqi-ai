import { z } from 'zod';

export const checkoutSchema = z.object({
  subscriptionId: z.coerce.number({ error: 'معرف الاشتراك غير صحيح' }).int().positive({ error: 'معرف الاشتراك غير صحيح' }),
  provider: z.string().trim().optional().nullable(),
  kind: z.enum(['INITIAL', 'RENEWAL'], { error: 'نوع العملية غير صحيح' }).optional().default('INITIAL'),
  discountCode: z.string().trim().optional().nullable(),
  captchaToken: z.string().trim().min(1, { error: 'رمز التحقق مطلوب' }),
  captchaAnswer: z
    .union([z.string(), z.number()])
    .refine((v) => v !== '' && v !== undefined && v !== null, { error: 'إجابة رمز التحقق مطلوبة' })
});

export const discountCodeSchema = z.object({
  code: z.string().trim().min(2, { error: 'الكود مطلوب' }),
  type: z.enum(['PERCENTAGE', 'AMOUNT'], { error: 'نوع التخفيض غير صحيح' }).default('PERCENTAGE'),
  value: z.coerce.number({ error: 'قيمة التخفيض غير صحيحة' }).positive({ error: 'قيمة التخفيض يجب أن تكون موجبة' }),
  description: z.string().trim().optional().nullable(),
  usageLimit: z.coerce.number().int().positive({ error: 'حد الاستعمال يجب أن يكون موجبا' }).optional().nullable(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'تاريخ الانتهاء غير صحيح (YYYY-MM-DD)' })
    .optional()
    .nullable()
});

export const discountUpdateSchema = z.object({
  description: z.string().trim().optional().nullable(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'تاريخ الانتهاء غير صحيح (YYYY-MM-DD)' })
    .optional()
    .nullable()
});

export const paymentIntentIdSchema = z.object({
  id: z.coerce.number({ error: 'معرف العملية غير صحيح' }).int().positive({ error: 'معرف العملية غير صحيح' })
});

export const demoResultSchema = z.object({
  result: z.enum(['success', 'failure', 'cancel'], { error: 'نتيجة غير معروفة' })
});

export const auditLogsQuerySchema = z.object({
  action: z.string().trim().optional().nullable(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
});
