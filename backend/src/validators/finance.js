import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const financePeriodQuerySchema = z
  .object({
    from: z.string().regex(datePattern, { error: 'تاريخ البداية غير صحيح (YYYY-MM-DD)' }).optional().nullable(),
    to: z.string().regex(datePattern, { error: 'تاريخ النهاية غير صحيح (YYYY-MM-DD)' }).optional().nullable(),
    schoolYear: z.string().trim().optional().nullable()
  })
  .refine((v) => !(v.from && v.schoolYear), { error: 'اختر إما فترة زمنية أو سنة دراسية، ليس الاثنين' })
  .refine((v) => !(v.to && v.schoolYear), { error: 'اختر إما فترة زمنية أو سنة دراسية، ليس الاثنين' });

export const anomalyQuerySchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'IGNORED', 'ALL'], { error: 'حالة غير صحيحة' }).optional().default('OPEN'),
  type: z.string().trim().optional().nullable(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50)
});

export const anomalyResolveSchema = z.object({
  status: z.enum(['RESOLVED', 'IGNORED'], { error: 'حالة غير صحيحة' }).optional().default('RESOLVED'),
  resolution: z.string().trim().optional().nullable()
});

export const refundSchema = z.object({
  reason: z.string().trim().optional().nullable()
});

export const financeIdParamSchema = z.object({
  id: z.coerce.number({ error: 'المعرف غير صحيح' }).int().positive({ error: 'المعرف غير صحيح' })
});
