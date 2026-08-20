import { z } from 'zod';
import { idParamSchema } from './common.js';

export const userIdParamSchema = z.object({
  userId: z.coerce.number({ error: 'معرف غير صحيح' }).int().positive({ error: 'معرف غير صحيح' })
});

export const messageCreateSchema = z.object({
  recipientId: z.coerce.number({ error: 'المستلم مطلوب' }).int().positive({ error: 'معرف المستلم غير صحيح' }),
  subject: z.string().trim().max(200, { error: 'الموضوع طويل جدا' }).optional().nullable(),
  body: z.string({ error: 'نص الرسالة مطلوب' }).trim().min(1, { error: 'نص الرسالة مطلوب' }).max(5000, { error: 'الرسالة طويلة جدا' })
});

export const recipientsQuerySchema = z.object({
  q: z.string().trim().max(100, { error: 'بحث طويل جدا' }).optional().nullable()
});

export const archiveQuerySchema = z.object({
  q: z.string().trim().max(100, { error: 'بحث طويل جدا' }).optional().nullable()
});

export const archiveConversationQuerySchema = z.object({
  userA: z.coerce.number({ error: 'معرف المستخدم الأول غير صحيح' }).int().positive({ error: 'معرف المستخدم الأول غير صحيح' }),
  userB: z.coerce.number({ error: 'معرف المستخدم الثاني غير صحيح' }).int().positive({ error: 'معرف المستخدم الثاني غير صحيح' })
});

export { idParamSchema as messageIdParamSchema };
