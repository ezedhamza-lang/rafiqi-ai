import { Router } from 'express';
import { authMiddleware, studentMiddleware } from '../auth.js';
import prisma from '../db.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { buildSession, analyzeAttempt, buildReport, buildPrereqSession } from '../services/mentalMath.js';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';

const router = Router();
router.use(authMiddleware);

const sessionSchema = z.object({ gradeId: z.string().regex(/^year[1-6]$/), seed: z.number().int().min(1).max(2_000_000_000), count: z.number().int().min(3).max(12).default(6), mode: z.enum(['mental', 'prereq']).default('mental') });
const answerSchema = z.object({
  gradeId: sessionSchema.shape.gradeId,
  seed: z.number().int().min(1).max(2_000_000_000),
  idx: z.number().int().min(0).max(11),
  answer: z.union([z.string().max(40), z.number()]),
  ms: z.number().int().min(0).max(600000).optional(),
  hintUsed: z.boolean().optional()
});

function strip(item) {
  const { answer, truth, similar, explain, hint, ...pub } = item;
  return { ...pub, hasHint: !!hint };
}

router.post('/mental-math/session', studentMiddleware, validateBody(sessionSchema), asyncHandler(async (req, res) => {
  const { gradeId, seed, count, mode } = req.body;
  const items = mode === 'prereq' ? buildPrereqSession(gradeId, seed, count) : buildSession(gradeId, seed, count);
  res.json({ gradeId, seed, count: items.length, items: items.map((x, i) => ({ ...strip(x), idx: i })) });
}));

router.post('/mental-math/answer', studentMiddleware, validateBody(answerSchema), asyncHandler(async (req, res) => {
  const { gradeId, seed, idx, answer, ms, hintUsed } = req.body;
  const items = buildSession(gradeId, seed, Math.max(idx + 1, 12));
  const item = items[idx];
  if (!item) throw new ApiError(400, 'نشاط غير موجود في هذه الجلسة');
  const a = analyzeAttempt(item, answer, ms || 0, hintUsed);
  if (a.correct) {
    await prisma.mentalMathAttempt.create({
      data: { userId: req.user.id, gradeId, itemId: item.id, kind: item.kind, skill: item.skill, strategy: item.strategy || '', prompt: item.prompt, studentAnswer: String(answer), correct: true, errorPattern: null, ms: ms || null, hintUsed: !!hintUsed }
    });
    res.json({ correct: true, explain: item.explain, strategy: item.strategy, skill: item.skill, similar: item.similar ? { prompt: item.similar.prompt } : null });
    return;
  }
  await prisma.mentalMathAttempt.create({
    data: { userId: req.user.id, gradeId, itemId: item.id, kind: item.kind, skill: item.skill, strategy: item.strategy || '', prompt: item.prompt, studentAnswer: String(answer), correct: false, errorPattern: a.errorPattern, ms: ms || null, hintUsed: !!hintUsed }
  });
  res.json({
    correct: false,
    errorPattern: a.errorPattern,
    hint: item.hint,
    explainOnAsk: true,
    similar: item.similar ? { prompt: item.similar.prompt } : null,
    reliesOnCounting: a.reliesOnCounting
  });
}));

router.post('/mental-math/reveal', studentMiddleware, validateBody(answerSchema), asyncHandler(async (req, res) => {
  const { gradeId, seed, idx } = req.body;
  const items = buildSession(gradeId, seed, Math.max(idx + 1, 12));
  const item = items[idx];
  if (!item) throw new ApiError(400, 'نشاط غير موجود');
  res.json({ answer: item.answer, explain: item.explain, similar: item.similar || null });
}));

router.get('/mental-math/report', studentMiddleware, asyncHandler(async (req, res) => {
  const rows = await prisma.mentalMathAttempt.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 300
  });
  const report = buildReport(rows.map((r) => ({ skill: r.skill, strategy: r.strategy, correct: r.correct, ms: r.ms, errorPattern: r.errorPattern })));
  const total = rows.length;
  res.json({
    total,
    accuracy: total ? +(rows.filter((r) => r.correct).length / total).toFixed(2) : 0,
    avgMs: total ? Math.round(rows.reduce((s, r) => s + (r.ms || 0), 0) / total) : 0,
    ...report
  });
}));

export default router;
