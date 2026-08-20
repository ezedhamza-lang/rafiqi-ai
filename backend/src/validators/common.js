import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number({ error: 'معرف غير صحيح' }).int().positive({ error: 'معرف غير صحيح' })
});

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'التاريخ غير صحيح (YYYY-MM-DD)' });

export const calendarEventsQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, { error: 'الشهر غير صحيح (YYYY-MM)' })
    .optional()
    .nullable()
});

export const optionalText = (max, label) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label || 'النص'} طويل جدا` })
    .optional()
    .nullable();
