import { z } from 'zod';

export const registrationCreateSchema = z.object({
  studentId: z.coerce.number({ error: 'معرف التلميذ غير صحيح' }).int().positive({ error: 'معرف التلميذ غير صحيح' }),
  schoolYear: z.string({ error: 'السنة الدراسية مطلوبة' }).trim().min(1, { error: 'السنة الدراسية مطلوبة' }),
  level: z.string({ error: 'المستوى مطلوب' }).trim().min(1, { error: 'المستوى مطلوب' }),
  notes: z.string().trim().max(2000, { error: 'الملاحظات طويلة جدا' }).optional().nullable()
});
