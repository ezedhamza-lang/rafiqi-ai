import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  savePlatformAiKey,
  deletePlatformAiKey,
  getPlatformAiKey
} from '../services/aiService.js';
import { aiKeySchema } from '../validators/ai.js';

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/admin/ai/key:
 *   get:
 *     summary: حالة مفتاح الذكاء الاصطناعي للمنصة (المرحلة 7.3)
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: هل المفتاح مهيأ ومن أين (قاعدة بيانات / متغير بيئة / غير مهيأ)
 */
router.get('/key', adminMiddleware, asyncHandler(async (req, res) => {
  const platform = await getPlatformAiKey();
  const source = platform ? 'db' : process.env.GEMINI_API_KEY ? 'env' : null;
  res.json({ configured: Boolean(source), source, hasValue: false });
}));

/**
 * @swagger
 * /api/admin/ai/key:
 *   post:
 *     summary: ضبط مفتاح الذكاء الاصطناعي للمنصة
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [apiKey]
 *             properties:
 *               apiKey: { type: string }
 *     responses:
 *       200:
 *         description: تم الحفظ
 *       400:
 *         description: المفتاح مطلوب
 */
router.post('/key', adminMiddleware, validateBody(aiKeySchema), asyncHandler(async (req, res) => {
  const { apiKey } = req.body;
  await savePlatformAiKey(req.user.id, String(apiKey).trim());
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/admin/ai/key:
 *   delete:
 *     summary: حذف مفتاح الذكاء الاصطناعي للمنصة
 *     tags: [ai]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم الحذف
 */
router.delete('/key', adminMiddleware, asyncHandler(async (req, res) => {
  await deletePlatformAiKey();
  res.json({ ok: true });
}));

export default router;
