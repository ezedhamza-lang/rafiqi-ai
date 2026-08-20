import { Router } from 'express';
import { authMiddleware, studentMiddleware, requireRole } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateQuery, validateBody } from '../middleware/validate.js';
import { sessionQuerySchema, summaryQuerySchema, reviewBodySchema, planSessionBodySchema } from '../validators/adaptive.js';
import { buildSession, applyReview, summarize } from '../services/adaptiveService.js';
import { buildLearningPlan, buildRecommendedSession } from '../services/adaptivePlanService.js';
import { findGradeByLevel } from '../services/curriculumService.js';
import { getStudentLevel } from '../services/studentLevelService.js';

const router = Router();

router.use(authMiddleware);

async function enforceOwnGrade(req, res, gradeId) {
  const level = await getStudentLevel(req.user.id);
  const ownGradeId = level ? findGradeByLevel(level)?.id || null : null;
  if (gradeId && ownGradeId && gradeId !== ownGradeId) {
    res.status(403).json({ error: 'لا يمكنك تصفح محتوى مستوى آخر' });
    return null;
  }
  return gradeId || ownGradeId || null;
}

/**
 * @openapi
 * /api/student/adaptive/session:
 *   get:
 *     summary: جلسة مراجعة تكيفية (المرحلة 6.5) — بطاقات مستحقة ثم جديدة حسب الكتاب
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
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 30 }
 *     responses:
 *       200:
 *         description: جلسة المراجعة (أسئلة + حالة تكيفية لكل بطاقة)
 */
router.get('/adaptive/session', studentMiddleware, validateQuery(sessionQuerySchema), asyncHandler(async (req, res) => {
  const { gradeId, subjectId, limit } = req.query;
  if (!subjectId) {
    return res.status(400).json({ error: 'معرف المادة مطلوب' });
  }
  const effectiveGrade = await enforceOwnGrade(req, res, gradeId);
  if (!effectiveGrade) return;
  const session = await buildSession(req.user.id, effectiveGrade, subjectId, limit);
  res.json(session);
}));

/**
 * @openapi
 * /api/student/adaptive/review:
 *   post:
 *     summary: تسجيل إجابة بطاقة وتحديث حالتها التكيفية (SM-2)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemKey, gradeId, subjectId]
 *             properties:
 *               itemKey:
 *                 type: string
 *               gradeId:
 *                 type: string
 *               subjectId:
 *                 type: string
 *               quality:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 5
 *               correct:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: الحالة الجديدة للبطاقة
 *       400:
 *         description: طلب غير صالح
 */
router.post('/adaptive/review', studentMiddleware, validateBody(reviewBodySchema), asyncHandler(async (req, res) => {
  const { itemKey, gradeId, subjectId, quality, correct } = req.body;
  const effectiveGrade = await enforceOwnGrade(req, res, gradeId);
  if (!effectiveGrade) return;
  const result = await applyReview({ userId: req.user.id, itemKey, gradeId: effectiveGrade, subjectId, quality, correct });
  if (!result) {
    return res.status(400).json({ error: 'معرف البطاقة غير صالح' });
  }
  res.json(result);
}));

/**
 * @openapi
 * /api/student/adaptive/summary:
 *   get:
 *     summary: ملخص التقدم التكيفي (مستحقة الآن، توزيع المستويات، الدقة)
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
 *         description: الملخص التكيفي
 */
router.get('/adaptive/summary', studentMiddleware, validateQuery(summaryQuerySchema), asyncHandler(async (req, res) => {
  const { gradeId, subjectId } = req.query;
  if (gradeId) {
    const effectiveGrade = await enforceOwnGrade(req, res, gradeId);
    if (!effectiveGrade) return;
  }
  res.json(await summarize(req.user.id, gradeId || undefined, subjectId || undefined));
}));

/**
 * @openapi
 * /api/student/adaptive/plan:
 *   get:
 *     summary: خطة التعلّم الشخصية (المرحلة 7.3) — تُعدّل المواد والتمارين ديناميكياً حسب أداء التلميذ
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: خطة التعلم (نظرة عامة + ملف كل مادة + خطة اليوم + تعديلات ديناميكية)
 *       404:
 *         description: التلميذ غير موجود
 */
router.get('/adaptive/plan', studentMiddleware, requireRole('STUDENT'), asyncHandler(async (req, res) => {
  const plan = await buildLearningPlan(req.user.id);
  if (!plan) {
    return res.status(404).json({ error: 'تعذر إنشاء الخطة — التلميذ غير موجود' });
  }
  res.json(plan);
}));

/**
 * @openapi
 * /api/student/adaptive/plan/session:
 *   post:
 *     summary: جلسة ممارسة موصى بها تتبع خطة التعلّم (الأضعف أولاً)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gradeId:
 *                 type: string
 *               subjectId:
 *                 type: string
 *               limit:
 *                 type: integer
 *                 maximum: 30
 *     responses:
 *       200:
 *         description: جلسة الممارسة (بطاقات مرتبة حسب أولوية الخطة)
 */
router.post('/adaptive/plan/session', studentMiddleware, requireRole('STUDENT'), validateBody(planSessionBodySchema), asyncHandler(async (req, res) => {
  const { gradeId, subjectId, limit } = req.body;
  res.json(await buildRecommendedSession(req.user.id, { gradeId, subjectId, limit }));
}));

export default router;
