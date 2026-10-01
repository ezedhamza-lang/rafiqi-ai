import { z } from 'zod';

export const GAME_CODES = [
  'QUICK_MATH', 'WORD_BUILD', 'MEMORY',
  'SCIENCE_QUIZ', 'SCIENCE_CLASSIFY', 'EXPERIMENT_STEPS',
  'ARABIC_SCRAMBLE', 'SENTENCE_BUILDER', 'FRENCH_MATCH'
];

export const gameResultSchema = z.object({
  game: z.enum(GAME_CODES, { error: 'لعبة غير صالحة' }),
  score: z.coerce.number().int().min(0).default(0),
  correct: z.coerce.number().int().min(0).default(0),
  total: z.coerce.number().int().min(0).default(0),
  durationSec: z.coerce.number().int().min(0).optional().nullable()
});
