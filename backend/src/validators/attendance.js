import { z } from 'zod';

export const attendanceRecordSchema = z.object({
  studentId: z.coerce.number({ error: 'معرف التلميذ غير صحيح' }).int().positive({ error: 'معرف التلميذ غير صحيح' }),
  present: z.boolean().optional().nullable(),
  note: z.string().trim().max(500, { error: 'الملاحظة طويلة جدا' }).optional().nullable()
});

export const attendanceSaveSchema = z.object({
  classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive({ error: 'معرف القسم غير صحيح' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'التاريخ غير صحيح (YYYY-MM-DD)' }),
  records: z.array(attendanceRecordSchema).max(100, { error: 'عدد التلاميذ كبير جدا' })
});

export const classIdParamSchema = z.object({
  classId: z.coerce.number({ error: 'معرف القسم غير صحيح' }).int().positive({ error: 'معرف القسم غير صحيح' })
});

export const attendanceQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'التاريخ غير صحيح (YYYY-MM-DD)' })
    .optional()
    .nullable(),
  days: z.coerce.number().int().min(1).max(90).optional().nullable()
});
