import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { runParentInsightSweep } from '../services/parentInsightNotifyService.js';

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/admin/insights/sweep:
 *   post:
 *     summary: تشغيل مسح رؤى الولي يدوياً (المرحلة 7.3 — إشعارات استباقية)
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: عدد الأبناء المفحوصين والإشعارات المرسلة
 */
router.post('/sweep', adminMiddleware, asyncHandler(async (req, res) => {
  const result = await runParentInsightSweep();
  res.json(result);
}));

export default router;
