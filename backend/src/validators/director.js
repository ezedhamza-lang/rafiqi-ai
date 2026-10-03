import { z } from 'zod';
import { idParamSchema, optionalText } from './common.js';

export const directorRequestApproveSchema = z.object({
  classId: z.coerce.number({ error: 'يرجى اختيار القسم' }).int().positive({ error: 'يرجى اختيار القسم' })
});

export const directorRequestRejectSchema = z.object({
  reason: optionalText(2000, 'سبب الرفض')
});

export const directorBroadcastSchema = z.object({
  title: z.string({ error: 'عنوان التنبيه مطلوب' }).trim().min(1, { error: 'عنوان التنبيه مطلوب' }).max(200, { error: 'العنوان طويل جدا' }),
  message: z.string({ error: 'نص التنبيه مطلوب' }).trim().min(1, { error: 'نص التنبيه مطلوب' }).max(2000, { error: 'النص طويل جدا' })
});

export const directorStatusQuerySchema = z
  .object({
    status: z
      .enum(['PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE', 'REJECTED', 'CANCELLED'], { error: 'حالة غير صالحة' })
      .optional()
      .nullable()
  });

export { idParamSchema as directorRequestIdParamSchema };

export const directorClassCreateSchema = z.object({
  name: z.string({ error: 'اسم القسم مطلوب' }).trim().min(2, { error: 'اسم القسم قصير جدا' }).max(120, { error: 'اسم القسم طويل جدا' }),
  level: z.string({ error: 'المستوى مطلوب' }).trim().min(2, { error: 'المستوى مطلوب' }).max(120, { error: 'المستوى طويل جدا' }),
  teacherId: z.coerce.number({ error: 'معرف الأستاذ غير صحيح' }).int().positive({ error: 'معرف الأستاذ غير صحيح' }).optional().nullable(),
  schoolYear: z.string().trim().max(20, { error: 'السنة الدراسية طويلة جدا' }).optional().nullable()
});

export const directorClassUpdateSchema = z.object({
  name: z.string().trim().min(2, { error: 'اسم القسم قصير جدا' }).max(120, { error: 'اسم القسم طويل جدا' }).optional().nullable(),
  level: z.string().trim().min(2, { error: 'المستوى مطلوب' }).max(120, { error: 'المستوى طويل جدا' }).optional().nullable(),
  teacherId: z.coerce.number({ error: 'معرف الأستاذ غير صحيح' }).int().positive({ error: 'معرف الأستاذ غير صحيح' }).optional().nullable(),
  schoolYear: z.string().trim().max(20, { error: 'السنة الدراسية طويلة جدا' }).optional().nullable()
});

export { idParamSchema as directorClassIdParamSchema };

// ── بطاقات الدخول (المرحلة C) ────────────────────────────────────────────────
const cardPassword = z
  .string({ error: 'كلمة السر غير صالحة' })
  .trim()
  .min(6, { error: 'كلمة السر قصيرة جدا (6 أحرف على الأقل)' })
  .max(64, { error: 'كلمة السر طويلة جدا' })
  .refine((v) => !/\s/.test(v), { error: 'كلمة السر لا يجب أن تحتوي فراغات' })
  .optional()
  .nullable();

export const directorCredentialsStudentParamSchema = z.object({
  studentId: z.coerce.number({ error: 'معرّف التلميذ غير صحيح' }).int().positive({ error: 'معرّف التلميذ غير صحيح' })
});

export const directorCredentialsIssueSchema = z.object({  // كلمة سر اختيارية: إن تُركت يولّدها الخادم رقمًا من 6 أرقام
  password: cardPassword,
  // card = بطاقة تُطبع وتبقى صالحة · temporary = كلمة سر تُسلَّم ويغيّرها التلميذ عند أول دخول
  mode: z.enum(['card', 'temporary'], { error: 'نوع البطاقة غير معروف' }).optional()
});

export const directorCredentialsBulkSchema = z.object({
  classId: z.coerce.number({ error: 'يرجى اختيار القسم' }).int().positive({ error: 'يرجى اختيار القسم' }),
  mode: z.enum(['card', 'temporary'], { error: 'نوع البطاقة غير معروف' }).optional(),
  // يسلّم كلمة سر واحدة لكل تلميذ (أبسط للطباعة)؛ إن تُركت يولّد الخادم واحدة لكل تلميذ
  password: cardPassword,
  // افتراضيًا: نُصدر لمن لا كلمة سر له فقط — لا نكتب فوق كلمة سر حيّة
  onlyMissing: z.boolean().optional()
});
