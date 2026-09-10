import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { actorSchoolId } from '../tenant.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { publishAnnouncement, resolveAudienceUserIds } from '../services/announcementService.js';
import { announcementCreateSchema, audienceCountQuerySchema } from '../validators/announcements.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

/**
 * @swagger
 * /api/director/announcements:
 *   post:
 *     summary: إصدار إعلان من الإدارة يصل المستخدمين كإشعار داخل المنصة
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               category: { enum: [GENERAL, URGENT, EXAM, EVENT, OTHER] }
 *               priority: { enum: [LOW, NORMAL, HIGH, URGENT] }
 *               audience:
 *                 type: array
 *                 items: { enum: [ALL, STUDENT, PARENT, TEACHER, DIRECTOR, ADMIN] }
 *               level: { type: string }
 *               link: { type: string }
 *               channels:
 *                 type: array
 *                 items: { enum: [IN_APP, PUSH, EMAIL, SMS] }
 *     responses:
 *       201:
 *         description: تم إصدار الإعلان
 */
router.post('/', validateBody(announcementCreateSchema), asyncHandler(async (req, res) => {
  const { title, body, category, priority, audience, level, link, channels } = req.body;
  const result = await publishAnnouncement({
    title,
    body,
    category,
    priority,
    audience,
    level,
    link,
    createdBy: req.user.id,
    schoolId: actorSchoolId(req),
    channels
  });
  res.status(201).json(result);
}));

/**
 * @swagger
 * /api/director/announcements:
 *   get:
 *     summary: كل إعلانات الإدارة
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الإعلانات
 */
router.get('/', asyncHandler(async (req, res) => {
  const sid = actorSchoolId(req);
  const items = await prisma.schoolAnnouncement.findMany({
    where: sid != null ? { schoolId: sid } : {},
    include: {
      creator: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { notifications: true } }
    },
    orderBy: { publishedAt: 'desc' },
    take: 100
  });
  res.json(items);
}));

/**
 * @swagger
 * /api/director/announcements/audience-count:
 *   get:
 *     summary: عدد المستفيدين من جمهور الإعلان
 *     tags: [director]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: العدد
 */
router.get('/audience-count', validateQuery(audienceCountQuerySchema), asyncHandler(async (req, res) => {
  const audience = String(req.query.audience || 'ALL')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const ids = await resolveAudienceUserIds({ audience, level: req.query.level || undefined, schoolId: actorSchoolId(req) });
  res.json({ count: ids.length });
}));

export default router;
