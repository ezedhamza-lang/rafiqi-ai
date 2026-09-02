import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware } from '../auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getUnreadCount, markAllRead, markRead } from '../services/notify.js';
import { notificationsQuerySchema, markReadParamsSchema, markReadBodySchema, preferencesSchema } from '../validators/notifications.js';

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: إشعارات المستخدم الحالي (مصفحة)
 *     tags: [notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الإشعارات
 */
router.get('/', validateQuery(notificationsQuerySchema), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const where = { userId: req.user.id };
  if (req.query.type) where.type = String(req.query.type);

  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification.count({ where }),
    getUnreadCount(req.user.id)
  ]);

  res.json({ items, total, unread, page, limit });
}));

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: عدد الإشعارات غير المقروءة
 *     tags: [notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: العدد
 */
router.get('/unread-count', asyncHandler(async (req, res) => {
  res.json({ count: await getUnreadCount(req.user.id) });
}));

/**
 * @swagger
 * /api/notifications/preferences:
 *   get:
 *     summary: تفضيلات قنوات الإشعارات للمستخدم الحالي
 *     tags: [notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: التفضيلات
 */
router.get('/preferences', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { notifyEmail: true, notifyPush: true, notifySms: true }
  });
  res.json(user || { notifyEmail: false, notifyPush: true, notifySms: false });
}));

/**
 * @swagger
 * /api/notifications/preferences:
 *   put:
 *     summary: تحديث تفضيلات قنوات الإشعارات
 *     tags: [notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: boolean }
 *               push: { type: boolean }
 *               sms: { type: boolean }
 *     responses:
 *       200:
 *         description: التفضيلات المحدّثة
 */
router.put('/preferences', validateBody(preferencesSchema), asyncHandler(async (req, res) => {
  const data = {};
  if (req.body.email !== undefined) data.notifyEmail = !!req.body.email;
  if (req.body.push !== undefined) data.notifyPush = !!req.body.push;
  if (req.body.sms !== undefined) data.notifySms = !!req.body.sms;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: { notifyEmail: true, notifyPush: true, notifySms: true }
  });
  res.json(user);
}));

/**
 * @swagger
 * /api/notifications/announcements:
 *   get:
 *     summary: إعلانات الإدارة الواصلة للمستخدم الحالي
 *     tags: [notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الإعلانات
 */
router.get('/announcements', asyncHandler(async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user.id, type: 'ANNOUNCEMENT' },
    include: { schoolAnnouncement: { select: { id: true, title: true, body: true, category: true, priority: true, link: true, publishedAt: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json(items);
}));

/**
 * @swagger
 * /api/notifications/read:
 *   post:
 *     summary: تعليم الإشعارات كمقروءة (كلها أو قائمة معينة)
 *     tags: [notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200:
 *         description: تم التحديث
 */
router.post('/read', validateBody(markReadBodySchema), asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) && req.body.ids.length
    ? [...new Set(req.body.ids.map(Number))]
    : null;
  if (ids) {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, id: { in: ids }, read: false },
      data: { read: true, readAt: new Date() }
    });
  } else {
    await markAllRead(req.user.id);
  }
  res.json({ ok: true, unread: await getUnreadCount(req.user.id) });
}));

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   post:
 *     summary: تعليم إشعار واحد كمقروء
 *     tags: [notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم التحديث
 */
router.post('/:id/read', validateParams(markReadParamsSchema), asyncHandler(async (req, res) => {
  const unread = await markRead(req.user.id, Number(req.params.id));
  res.json({ ok: true, unread });
}));

export default router;
