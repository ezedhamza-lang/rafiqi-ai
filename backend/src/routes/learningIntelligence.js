// نقاط نهاية ذكاء التعلم — خريطة الإتقان + رادار الفجوات (التلميذ)
// وتحليل الاختبارات (المعلم) — المرحلة 2
import { Router } from 'express';
import { authMiddleware, studentMiddleware, teacherMiddleware, requireRole } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildMasteryMap, detectGaps, analyzeQuiz } from '../services/learningIntelligenceService.js';

const router = Router();

/**
 * @swagger
 * /api/student/mastery:
 *   get:
 *     summary: "خريطة الإتقان الحية للتلميذ — كل درس: منجز/جارٍ/لم يبدأ"
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: المواد ودروسها بحالة الإتقان + ملخص عام
 */
router.get(
  '/mastery',
  authMiddleware,
  studentMiddleware,
  requireRole('STUDENT'),
  asyncHandler(async (req, res) => {
    const map = await buildMasteryMap(req.user.id);
    res.json(map);
  })
);

/**
 * @swagger
 * /api/student/gaps:
 *   get:
 *     summary: رادار الفجوات — فجوات التعلم المكتشفة مبكراً بأدلتها واقتراحاتها
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الفجوات
 */
router.get(
  '/gaps',
  authMiddleware,
  studentMiddleware,
  requireRole('STUDENT'),
  asyncHandler(async (req, res) => {
    const gaps = await detectGaps(req.user.id);
    res.json({ gaps, generatedAt: new Date().toISOString() });
  })
);

/**
 * @swagger
 * /api/teacher/quizzes/{id}/analysis:
 *   get:
 *     summary: "ذكاء التقويم — تحليل أسئلة اختبار: نسبة النجاح لكل سؤال وكشف الأسئلة المشبوهة"
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: التحليل
 *       404:
 *         description: الاختبار غير موجود
 */
router.get(
  '/quizzes/:id/analysis',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const analysis = await analyzeQuiz(Number(req.params.id));
    if (!analysis) return res.status(404).json({ error: 'الاختبار غير موجود' });
    res.json(analysis);
  })
);

export default router;