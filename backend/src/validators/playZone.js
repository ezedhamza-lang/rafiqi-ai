import { z } from 'zod';

export const gameResultSchema = z.object({
  game: z.enum(['QUICK_MATH', 'WORD_BUILD', 'MEMORY'], { error: 'لعبة غير صالحة' }),
  score: z.coerce.number().int().min(0).default(0),
  correct: z.coerce.number().int().min(0).default(0),
  total: z.coerce.number().int().min(0).default(0),
  durationSec: z.coerce.number().int().min(0).optional().nullable()
});
