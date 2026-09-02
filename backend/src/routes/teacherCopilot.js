// مساعد المعلّم الذكي — بريف يومي قابل للتفسير (المرحلة 1)
import { Router } from 'express';
import { authMiddleware, teacherMiddleware } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildDailyBriefing } from '../services/teacherCopilotService.js';

const router = Router();

/**
 * @swagger
 * /api/teacher/copilot:
 *   get:
 *     summary: بريف يومي ذكي للمعلّم — الدرس التالي، التصحيحات المعلقة، الغياب، التلاميذ المعرضون للخطر (كل اقتراح بتفسيره وأدلته ودرجة ثقته)
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema: { type: integer }
 *       - in: query
 *         name: subject
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: البريف اليومي
 */
router.get(
  '/copilot',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const { classId, subject } = req.query;
    const briefing = await buildDailyBriefing(req.user.id, {
      classId: classId ? Number(classId) : undefined,
      subject: subject || undefined
    });
    res.json(briefing);
  })
);

export default router;