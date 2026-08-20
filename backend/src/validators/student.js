import { z } from 'zod';
import { dateStringSchema } from './common.js';

export const studentUpdateSchema = z.object({
  firstName: z.string().trim().min(2, { error: 'الاسم يجب أن يحتوي على حرفين على الأقل' }).optional(),
  lastName: z.string().trim().min(2, { error: 'اللقب يجب أن يحتوي على حرفين على الأقل' }).optional(),
  birthDate: dateStringSchema.optional().nullable(),
  cin: z.string().trim().max(20, { error: 'رقم بطاقة التعريف طويل جدا' }).optional().nullable(),
  gender: z.string().trim().optional().nullable(),
  level: z.string().trim().optional().nullable(),
  schoolYear: z.string().trim().optional().nullable(),
  schoolName: z.string().trim().optional().nullable()
});
