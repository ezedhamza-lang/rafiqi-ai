import { z } from 'zod';
import { idParamSchema } from './common.js';

export const registrationStatusSchema = z.object({
  status: z
    .enum(['PENDING', 'VALIDATED', 'REJECTED', 'PROCESSING'], { error: 'حالة غير صالحة' })
    .default('PENDING'),
  notes: z.string().trim().max(2000, { error: 'الملاحظات طويلة جدا' }).optional().nullable()
});

export const helpRequestStatusSchema = z.object({
  status: z.string().trim().min(1, { error: 'الحالة مطلوبة' }).max(50, { error: 'الحالة غير صالحة' })
});

export const adminIdParamSchema = idParamSchema;
