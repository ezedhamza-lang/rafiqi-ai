import { z } from 'zod';

const dateTimeSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { error: 'التاريخ والوقت غير صحيحين (ISO)' });

export const createLiveSessionSchema = z
  .object({
    title: z.string().trim().min(2, { error: 'عنوان الحصة قصير جدا' }).max(150, { error: 'عنوان الحصة طويل جدا' }),
    subject: z.string().trim().max(120, { error: 'المادة طويلة جدا' }).optional().nullable(),
    description: z.string().trim().max(2000, { error: 'وصف الحصة طويل جدا' }).optional().nullable(),
    classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive({ error: 'معرف القسم غير صحيح' }).optional().nullable(),
    provider: z.enum(['LOCAL', 'LIVEKIT']).optional().nullable(),
    maxParticipants: z.coerce.number().int().min(2).max(300).optional().nullable(),
    startsAt: dateTimeSchema,
    endsAt: dateTimeSchema
  })
  .refine((d) => d.endsAt && d.startsAt && new Date(d.endsAt) > new Date(d.startsAt), {
    error: 'وقت النهاية يجب أن يكون بعد وقت البداية'
  });

export const updateLiveSessionSchema = z
  .object({
    title: z.string().trim().min(2, { error: 'عنوان الحصة قصير جدا' }).max(150, { error: 'عنوان الحصة طويل جدا' }).optional(),
    subject: z.string().trim().max(120, { error: 'المادة طويلة جدا' }).optional().nullable(),
    description: z.string().trim().max(2000, { error: 'وصف الحصة طويل جدا' }).optional().nullable(),
    classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive({ error: 'معرف القسم غير صحيح' }).optional().nullable(),
    maxParticipants: z.coerce.number().int().min(2).max(300).optional().nullable(),
    startsAt: dateTimeSchema.optional(),
    endsAt: dateTimeSchema.optional()
  })
  .refine((d) => !d.startsAt || !d.endsAt || new Date(d.endsAt) > new Date(d.startsAt), {
    error: 'وقت النهاية يجب أن يكون بعد وقت البداية'
  });

export const liveSessionIdParamSchema = z.object({
  id: z.coerce.number({ error: 'معرف الحصة غير صحيح' }).int().positive({ error: 'معرف الحصة غير صحيح' })
});

export const liveSessionUserParamSchema = z.object({
  id: z.coerce.number({ error: 'معرف الحصة غير صحيح' }).int().positive({ error: 'معرف الحصة غير صحيح' }),
  userId: z.coerce.number({ error: 'معرف التلميذ غير صحيح' }).int().positive({ error: 'معرف التلميذ غير صحيح' })
});
