import { z } from 'zod';

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).optional().nullable(),
  type: z.string().trim().max(50).optional().nullable()
});

export const markReadParamsSchema = z.object({
  id: z.coerce.number({ error: 'معرف غير صحيح' }).int().positive({ error: 'معرف غير صحيح' })
});

export const markReadBodySchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).optional().nullable()
});

export const preferencesSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional()
});
