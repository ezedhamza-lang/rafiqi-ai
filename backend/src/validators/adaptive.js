import { z } from 'zod';

export const sessionQuerySchema = z.object({
  gradeId: z.string({ error: 'معرف السنة غير صحيح' }).trim().min(1).optional(),
  subjectId: z.string({ error: 'معرف المادة غير صحيح' }).trim().min(1).optional(),
  limit: z.coerce.number({ error: 'الحد غير صحيح' }).int().positive().optional()
});

export const summaryQuerySchema = sessionQuerySchema.partial();

export const planSessionBodySchema = z
  .object({
    gradeId: z.string({ error: 'معرف السنة غير صحيح' }).trim().min(1).optional(),
    subjectId: z.string({ error: 'معرف المادة غير صحيح' }).trim().min(1).optional(),
    limit: z.coerce.number({ error: 'الحد غير صحيح' }).int().positive().max(30).optional()
  })
  .superRefine((val, ctx) => {
    if ((val.gradeId && !val.subjectId) || (!val.gradeId && val.subjectId)) {
      ctx.addIssue({ code: 'custom', path: ['gradeId'], message: 'يجب إرسال السنة والمادة معاً' });
    }
  });

export const reviewBodySchema = z
  .object({
    itemKey: z.string({ error: 'معرف البطاقة مطلوب' }).trim().min(1, { error: 'معرف البطاقة مطلوب' }),
    gradeId: z.string({ error: 'معرف السنة مطلوب' }).trim().min(1, { error: 'معرف السنة مطلوب' }),
    subjectId: z.string({ error: 'معرف المادة مطلوب' }).trim().min(1, { error: 'معرف المادة مطلوب' }),
    quality: z.coerce.number({ error: 'التقييم غير صحيح' }).int().min(0).max(5).optional(),
    correct: z.boolean({ error: 'قيمة الإجابة غير صحيحة' }).optional()
  })
  .superRefine((val, ctx) => {
    if (val.quality === undefined && val.correct === undefined) {
      ctx.addIssue({ code: 'custom', path: ['quality'], message: 'يجب إرسال تقييم (quality) أو صحة الإجابة (correct)' });
    }
  });
