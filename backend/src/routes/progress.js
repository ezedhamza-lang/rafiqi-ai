import { Router } from 'express';
import { authMiddleware, studentMiddleware } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { completeLessonSchema, progressQuerySchema } from '../validators/progress.js';
import { completeLesson, getProgress } from '../services/progressService.js';

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /api/student/progress/lessons:
 *   get:
 *     summary: تقدم التلميذ في الدروس التفاعلية (المرحلة 6.6)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gradeId
 *         schema: { type: string }
 *       - in: query
 *         name: subjectId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الدروس المكتملة + ملخص حسب المادة
 */
router.get('/progress/lessons', studentMiddleware, validateQuery(progressQuerySchema), asyncHandler(async (req, res) => {
  const { gradeId, subjectId } = req.query;
  res.json(await getProgress(req.user.id, gradeId || undefined, subjectId || undefined));
}));

/**
 * @openapi
 * /api/student/progress/lessons:
 *   post:
 *     summary: إتمام درس تفاعلي (يمنح نقاطًا ويعطي شارات)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gradeId, subjectId, lessonId]
 *             properties:
 *               gradeId: { type: string }
 *               subjectId: { type: string }
 *               lessonId: { type: string }
 *               lessonTitle: { type: string }
 *     responses:
 *       200:
 *         description: النقاط المكتسبة والشارات الجديدة
 */
router.post('/progress/lessons', studentMiddleware, validateBody(completeLessonSchema), asyncHandler(async (req, res) => {
  const { gradeId, subjectId, lessonId, lessonTitle } = req.body;
  const result = await completeLesson(req.user.id, { gradeId, subjectId, lessonId, lessonTitle });
  res.json(result);
}));

export default router;
