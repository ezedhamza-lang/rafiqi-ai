import { Router } from 'express';
import { authMiddleware, studentMiddleware } from '../auth.js';
import prisma from '../db.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { lessonCheckSchema, lessonRevealSchema } from '../validators/lessonGating.js';
import { resolveBlock, gradeBlockAnswer } from '../services/lessonAnswerService.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const bookParamsSchema = z.object({
  gradeId: z.string().regex(/^[a-z0-9-]{1,24}$/),
  subjectId: z.string().regex(/^[a-z0-9-]{1,24}$/),
  lessonId: z.string().regex(/^[a-z0-9-]{1,32}$/i)
});

function attemptWhere(req) {
  const { gradeId, subjectId, lessonId, blockId } = req.body;
  return {
    userId_gradeId_subjectId_lessonId_blockId: {
      userId: req.user.id,
      gradeId,
      subjectId,
      lessonId,
      blockId: blockId || req.body.blockId
    }
  };
}

/**
 * @swagger
 * /api/student/lesson/check:
 *   post:
 *     summary: فحص إجابة التلميذ server-side وتسجيل المحاولة (بدون كشف الإجابة)
 *     tags: [student-book]
 *     security:
 *       - bearerAuth: []
 */
router.post('/lesson/check', studentMiddleware, validateBody(lessonCheckSchema), asyncHandler(async (req, res) => {
  const { gradeId, subjectId, lessonId, blockId, answer } = req.body;
  const found = resolveBlock(gradeId, subjectId, lessonId, blockId);
  if (!found) throw new ApiError(404, 'الدرس أو العنصر غير موجود');
  if (found.block.answer === undefined && found.block.correctAnswer === undefined && found.block.correct === undefined) {
    throw new ApiError(400, 'هذا العنصر لا يحتاج فحصًا');
  }
  const result = gradeBlockAnswer(found.block, answer);
  const row = await prisma.lessonAttempt.upsert({
    where: attemptWhere(req),
    create: {
      userId: req.user.id,
      gradeId,
      subjectId,
      lessonId,
      blockId,
      attempts: 1,
      correct: result.correct,
      lastAnswer: answer
    },
    update: {
      attempts: { increment: 1 },
      correct: result.correct ? true : undefined,
      lastAnswer: answer
    }
  });
  res.json({ attempts: row.attempts, correct: result.correct });
}));

/**
 * @swagger
 * /api/student/lesson/reveal:
 *   post:
 *     summary: كشف الإجابة الصحيحة — مسموح فقط بعد محاولة مسجَّلة
 *     tags: [student-book]
 *     security:
 *       - bearerAuth: []
 */
router.post('/lesson/reveal', studentMiddleware, validateBody(lessonRevealSchema), asyncHandler(async (req, res) => {
  const { gradeId, subjectId, lessonId, blockId } = req.body;
  const existing = await prisma.lessonAttempt.findUnique({
    where: {
      userId_gradeId_subjectId_lessonId_blockId: { userId: req.user.id, gradeId, subjectId, lessonId, blockId }
    }
  });
  if (!existing || existing.attempts < 1) throw new ApiError(403, 'يجب إرسال محاولتك أولًا قبل رؤية الإجابة');
  const found = resolveBlock(gradeId, subjectId, lessonId, blockId);
  if (!found) throw new ApiError(404, 'الدرس أو العنصر غير موجود');
  const raw = found.block.answer ?? found.block.correctAnswer ?? found.block.correct ?? null;
  if (!existing.revealed) {
    await prisma.lessonAttempt.update({ where: { id: existing.id }, data: { revealed: true } });
  }
  res.json({ answer: raw, explanation: found.block.explanation || found.block.solution || null });
}));

/**
 * @swagger
 * /api/student/lesson/attempts/{gradeId}/{subjectId}/{lessonId}:
 *   get:
 *     summary: حالة محاولات التلميذ في درس (استئناف بعد إعادة الفتح)
 *     tags: [student-book]
 *     security:
 *       - bearerAuth: []
 */
router.get('/lesson/attempts/:gradeId/:subjectId/:lessonId', studentMiddleware, validateParams(bookParamsSchema), asyncHandler(async (req, res) => {
  const { gradeId, subjectId, lessonId } = req.params;
  const rows = await prisma.lessonAttempt.findMany({
    where: { userId: req.user.id, gradeId, subjectId, lessonId },
    select: { blockId: true, attempts: true, correct: true, revealed: true, lastAnswer: true }
  });
  res.json(rows);
}));

export default router;
