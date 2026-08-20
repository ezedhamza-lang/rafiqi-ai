import { z } from 'zod';

export const subscriptionRequestSchema = z.object({
  firstName: z.string().trim().min(2, { error: 'الاسم مطلوب' }),
  lastName: z.string().trim().min(2, { error: 'اللقب مطلوب' }),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'تاريخ الازدياد غير صحيح (YYYY-MM-DD)' }),
  cin: z.string().trim().optional().nullable(),
  gender: z.string().trim().optional().nullable(),
  level: z.string().trim().min(1, { error: 'المستوى مطلوب' }),
  schoolYear: z.string().trim().optional().nullable(),
  schoolName: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable()
});

export const paymentSchema = z.object({
  amount: z.number({ error: 'المبلغ يجب أن يكون رقما' }).positive({ error: 'المبلغ يجب أن يكون موجبا' }).optional().nullable(),
  method: z.string().trim().optional().nullable(),
  reference: z.string().trim().optional().nullable()
});

export const idParamSchema = z.object({
  id: z.coerce.number({ error: 'معرف غير صحيح' }).int().positive({ error: 'معرف غير صحيح' })
});
