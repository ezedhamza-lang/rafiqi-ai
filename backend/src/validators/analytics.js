import { z } from 'zod';
import { idParamSchema } from './common.js';

export const analyticsStudentParamSchema = z.object({
  studentId: idParamSchema.shape.id
});

export const analyticsClassParamSchema = z.object({
  classId: idParamSchema.shape.id
});

export const analyticsExportQuerySchema = z.object({
  classId: idParamSchema.shape.id.optional().nullable(),
  format: z.enum(['csv', 'pdf']).optional().default('csv')
});
