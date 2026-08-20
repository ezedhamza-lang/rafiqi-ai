import { z } from 'zod';

export const completeLessonSchema = z.object({
  gradeId: z.string({ error: 'معرف السنة مطلوب' }).trim().min(1, { error: 'معرف السنة مطلوب' }),
  subjectId: z.string({ error: 'معرف المادة مطلوب' }).trim().min(1, { error: 'معرف المادة مطلوب' }),
  lessonId: z.string({ error: 'معرف الدرس مطلوب' }).trim().min(1, { error: 'معرف الدرس مطلوب' }),
  lessonTitle: z.string({ error: 'عنوان الدرس غير صحيح' }).trim().max(200).optional().nullable()
});

export const progressQuerySchema = z.object({
  gradeId: z.string({ error: 'معرف السنة غير صحيح' }).trim().min(1).optional(),
  subjectId: z.string({ error: 'معرف المادة غير صحيح' }).trim().min(1).optional()
});
