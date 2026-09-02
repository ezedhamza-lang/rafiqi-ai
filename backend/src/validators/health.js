import { z } from 'zod';
import { optionalText } from './common.js';

export const healthRecordSchema = z.object({
  allergies: optionalText(1000, 'الحساسية'),
  chronicConditions: optionalText(1000, 'الأمراض المزمنة'),
  emergencyPhone: optionalText(30, 'رقم الطوارئ'),
  bloodType: optionalText(10, 'فصيلة الدم'),
  notes: optionalText(2000, 'الملاحظات')
});

export const healthStudentIdParamSchema = z.object({
  studentId: z.coerce.number({ error: 'معرف التلميذ غير صحيح' }).int().positive({ error: 'معرف التلميذ غير صحيح' })
});
