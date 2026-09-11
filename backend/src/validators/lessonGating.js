import { z } from 'zod';

const bookRef = {
  gradeId: z.string().regex(/^[a-z0-9-]{1,24}$/, 'gradeId غير صالح'),
  subjectId: z.string().regex(/^[a-z0-9-]{1,24}$/, 'subjectId غير صالح'),
  lessonId: z.string().regex(/^[a-z0-9-]{1,32}$/i, 'lessonId غير صالح'),
  blockId: z.string().regex(/^b\d{1,4}$/, 'blockId غير صالح')
};

export const lessonCheckSchema = z.object({
  ...bookRef,
  answer: z.union([z.string().max(2000), z.number(), z.boolean(), z.array(z.union([z.string().max(300), z.number()])).max(50)])
});

export const lessonRevealSchema = z.object(bookRef);
