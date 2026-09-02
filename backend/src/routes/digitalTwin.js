// نقاط نهاية التوأم الرقمي ومحاكي القرارات — المرحلة 4
import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildSchoolTwin, simulatePolicy } from '../services/digitalTwinService.js';
import { resolveSchoolId } from '../services/schoolScope.js';

const router = Router();

/**
 * @swagger
 * /api/school-twin:
 *   get:
 *     summary: التوأم الرقمي الحي للمدرسة (طلاب/أقسام/حضور/تقدم/تقويم/إدارة + مؤشرات الصحة)
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: اللقطة الحية
 */
router.get(
  '/school-twin',
  authMiddleware,
  requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const schoolId = resolveSchoolId(req);
    if (schoolId == null) return res.status(400).json({ error: 'حدد المدرسة بـ ?schoolId=' });
    const twin = await buildSchoolTwin(schoolId);
    if (!twin) return res.status(404).json({ error: 'المدرسة غير موجودة' });
    res.json(twin);
  })
);

/**
 * @swagger
 * /api/school-simulate:
 *   post:
 *     summary: محاكي القرارات «ماذا يحدث لو؟» — فتح قسم / إضافة تلاميذ / تقسيم قسم
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [add_class, add_students, split_class] }
 *               level: { type: string }
 *               classId: { type: integer }
 *               studentsToAdd: { type: integer }
 *               schoolId: { type: integer, description: للسوبر أدمن فقط }
 *     responses:
 *       200:
 *         description: نتيجة المحاكاة مع الأثر والافتراضات
 */
router.post(
  '/school-simulate',
  authMiddleware,
  requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    let schoolId = resolveSchoolId(req);
    if (schoolId == null && req.user.role === 'SUPER_ADMIN') {
      schoolId = Number(req.body?.schoolId) || null;
    }
    if (schoolId == null) return res.status(400).json({ error: 'حدد المدرسة' });
    const result = await simulatePolicy(schoolId, req.body);
    if (!result || result.error) return res.status(400).json(result || { error: 'فشل المحاكاة' });
    res.json(result);
  })
);

export default router;