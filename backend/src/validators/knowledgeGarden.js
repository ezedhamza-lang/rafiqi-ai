import { z } from 'zod';

/**
 * The client is trusted with nothing but counters.
 * `score`, `stars`, `gems` and `mastery` are never accepted from the browser —
 * the server recomputes every one of them from these fields.
 */

const skillId = z.string().min(1).max(64);
const arabicLabel = z.string().min(1).max(80);

export const levelResultSchema = z.object({
  levelId: z.string().min(3).max(20),
  worldId: z.string().min(3).max(40),
  correct: z.coerce.number().int().min(0).max(200),
  wrong: z.coerce.number().int().min(0).max(400).default(0),
  total: z.coerce.number().int().min(1).max(200),
  timeSec: z.coerce.number().int().min(0).max(7200).default(0),
  bestStreak: z.coerce.number().int().min(0).max(200).default(0),
  hintsUsed: z.coerce.number().int().min(0).max(200).default(0),
  // One entry per skill the learner actually touched during the run.
  skills: z.array(z.object({
    skillId,
    skillType: z.string().min(1).max(24),
    label: arabicLabel,
    correct: z.coerce.number().int().min(0).max(200),
    wrong: z.coerce.number().int().min(0).max(400)
  })).max(80).default([])
});

export const dailyResultSchema = z.object({
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  correct: z.coerce.number().int().min(0).max(50),
  total: z.coerce.number().int().min(1).max(50),
  skills: z.array(z.object({
    skillId,
    skillType: z.string().min(1).max(24),
    label: arabicLabel,
    correct: z.coerce.number().int().min(0).max(200),
    wrong: z.coerce.number().int().min(0).max(400)
  })).max(30).default([])
});

export const appearanceSchema = z.object({
  appearance: z.object({
    cap: z.string().min(1).max(32),
    glasses: z.string().min(1).max(32),
    backpack: z.string().min(1).max(32),
    book: z.string().min(1).max(32),
    trail: z.string().min(1).max(32),
    jump: z.string().min(1).max(32)
  })
});
