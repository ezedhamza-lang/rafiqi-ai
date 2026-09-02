import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { analyticsStudentParamSchema } from '../validators/analytics.js';
import {
  gatherStudentData,
  computeRisk,
  buildDeterministicSummary,
  suggestActivities,
  dataOverview,
  buildAiContext
} from '../services/parentInsightService.js';
import { generateParentSummary, generateParentActivities, hasAiKey } from '../services/aiService.js';

const router = Router();
router.use(authMiddleware);

async function resolveChildOrThrow(parentId, studentAccountId) {
  const student = await prisma.student.findFirst({
    where: { userId: parentId, accountUserId: studentAccountId },
    include: { class: { select: { id: true, name: true, level: true, teacherId: true } } }
  });
  if (!student) throw new ApiError(404, 'الابن غير موجود');
  return student;
}

function aiError(e) {
  if (e.message === 'NO_AI_KEY') return new ApiError(400, 'لم يتم ضبط مفتاح Gemini بعد');
  return new ApiError(502, 'تعذر الاتصال بخدمة الذكاء الاصطناعي');
}

/**
 * @swagger
 * /api/parent/insights/children/{studentId}:
 *   get:
 *     summary: رؤى الولي الذكية — محرك توقع التعثر + ملخص + أنشطة مقترحة (المرحلة 7.3)
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: التوقع والملخص والأنشطة المبنية على بيانات حقيقية
 *       404:
 *         description: الابن غير موجود
 */
router.get('/insights/children/:studentId', requireRole('PARENT'), validateParams(analyticsStudentParamSchema), asyncHandler(async (req, res) => {
  const child = await resolveChildOrThrow(req.user.id, Number(req.params.studentId));
  const data = await gatherStudentData(child.accountUserId);
  if (!data) throw new ApiError(404, 'الابن غير موجود');

  const risk = computeRisk(data);
  const teacherId = data.student.class?.teacherId || null;
  const key = teacherId ? await hasAiKey(teacherId) : null;

  res.json({
    child: {
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      accountUserId: child.accountUserId,
      level: data.student.class?.level || data.student.level || ''
    },
    generatedAt: new Date().toISOString(),
    aiConfigured: Boolean(key),
    prediction: risk,
    summary: buildDeterministicSummary(data, risk),
    activities: suggestActivities(data, risk),
    data: dataOverview(data)
  });
}));

/**
 * @swagger
 * /api/parent/insights/children/{studentId}/generate:
 *   post:
 *     summary: توليد ملخص وأنشطة بالذكاء الاصطناعي للولي (المرحلة 7.3)
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ملخص وأنشطة (AI أو حتمي عند غياب المفتاح)
 *       404:
 *         description: الابن غير موجود
 *       502:
 *         description: تعذر الاتصال بالخدمة
 */
router.post('/insights/children/:studentId/generate', requireRole('PARENT'), validateParams(analyticsStudentParamSchema), asyncHandler(async (req, res) => {
  const child = await resolveChildOrThrow(req.user.id, Number(req.params.studentId));
  const data = await gatherStudentData(child.accountUserId);
  if (!data) throw new ApiError(404, 'الابن غير موجود');

  const risk = computeRisk(data);
  const teacherId = data.student.class?.teacherId || null;
  const fallback = { ai: false, summary: buildDeterministicSummary(data, risk), activities: suggestActivities(data, risk) };

  if (!teacherId) return res.json(fallback);

  try {
    const [summary, activitiesJson] = await Promise.all([
      generateParentSummary(teacherId, buildAiContext(data, risk)),
      generateParentActivities(teacherId, buildAiContext(data, risk))
    ]);
    const activities = Array.isArray(activitiesJson) && activitiesJson.length ? activitiesJson : fallback.activities;
    res.json({ ai: true, summary, activities });
  } catch (e) {
    if (e.message === 'NO_AI_KEY') return res.json(fallback);
    throw aiError(e);
  }
}));

export default router;
