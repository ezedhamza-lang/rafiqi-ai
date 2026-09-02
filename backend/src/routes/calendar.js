import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { calendarEventCreateSchema, calendarEventUpdateSchema } from '../validators/calendar.js';
import { idParamSchema, calendarEventsQuerySchema } from '../validators/common.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const VALID_TYPES = ['HOLIDAY', 'EXAM', 'MEETING', 'ACTIVITY', 'OTHER'];
const VALID_AUDIENCES = ['ALL', 'STUDENT', 'PARENT', 'TEACHER', 'DIRECTOR'];

/**
 * @swagger
 * /api/calendar/events:
 *   get:
 *     summary: قائمة الأحداث حسب الدور
 *     tags: [calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: string, description: "YYYY-MM" }
 *     responses:
 *       200:
 *         description: قائمة الأحداث
 */
router.get(
  '/events',
  validateQuery(calendarEventsQuerySchema),
  asyncHandler(async (req, res) => {
    const role = req.user.role;
    const month = req.query.month;

    let where = {};

    if (role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { accountUserId: req.user.id },
        select: { level: true }
      });
      where = {
        audience: { in: ['ALL', 'STUDENT'] },
        OR: student?.level ? [{ level: student.level }, { level: null }] : [{ level: null }]
      };
    } else if (role === 'PARENT') {
      const levels = await prisma.student.findMany({
        where: { userId: req.user.id },
        select: { level: true }
      });
      const levelSet = [...new Set(levels.map((l) => l.level).filter(Boolean))];
      where = {
        audience: { in: ['ALL', 'PARENT'] },
        ...(levelSet.length ? { OR: [{ level: { in: levelSet } }, { level: null }] } : { level: null })
      };
    } else if (role === 'TEACHER') {
      const levels = await prisma.class.findMany({
        where: { teacherId: req.user.id },
        select: { level: true }
      });
      const levelSet = [...new Set(levels.map((l) => l.level).filter(Boolean))];
      where = {
        audience: { in: ['ALL', 'TEACHER'] },
        ...(levelSet.length ? { OR: [{ level: { in: levelSet } }, { level: null }] } : { level: null })
      };
    } else {
      where = {};
    }

    if (month) {
      const [y, m] = month.split('-').map((n) => parseInt(n, 10));
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: { creator: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'asc' }
    });

    res.json(events);
  })
);

/**
 * @swagger
 * /api/calendar:
 *   post:
 *     summary: إنشاء حدث جديد
 *     tags: [calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, date]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [HOLIDAY, EXAM, MEETING, ACTIVITY, OTHER] }
 *               date: { type: string, format: date }
 *               level: { type: string }
 *               audience: { type: string, enum: [ALL, STUDENT, PARENT, TEACHER, DIRECTOR] }
 *     responses:
 *       201:
 *         description: تم إنشاء الحدث
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post(
  '/',
  requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'),
  validateBody(calendarEventCreateSchema),
  asyncHandler(async (req, res) => {
    const { title, description, type, date, level, audience } = req.body;

    const event = await prisma.calendarEvent.create({
      data: {
        title: String(title).trim().slice(0, 200),
        description: description ? String(description).trim().slice(0, 2000) : null,
        type: type || 'OTHER',
        date: new Date(`${date}T00:00:00.000Z`),
        level: level || null,
        audience: audience || 'ALL',
        createdBy: req.user.id
      },
      include: { creator: { select: { id: true, firstName: true, lastName: true } } }
    });

    res.status(201).json(event);
  })
);

/**
 * @swagger
 * /api/calendar/{id}:
 *   put:
 *     summary: تعديل حدث
 *     tags: [calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               type: { type: string }
 *               date: { type: string, format: date }
 *               level: { type: string }
 *               audience: { type: string }
 *     responses:
 *       200:
 *         description: تم التعديل
 *       404:
 *         description: الحدث غير موجود
 */
router.put(
  '/:id',
  requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'),
  validateParams(idParamSchema),
  validateBody(calendarEventUpdateSchema),
  asyncHandler(async (req, res) => {
    const { title, description, type, date, level, audience } = req.body;
    const where = { id: req.params.id };
    if (req.user.role === 'TEACHER') where.createdBy = req.user.id;

    const event = await prisma.calendarEvent.findFirst({ where });
    if (!event) throw new ApiError(404, 'الحدث غير موجود');

    const updated = await prisma.calendarEvent.update({
      where: { id: event.id },
      data: {
        ...(title ? { title: String(title).trim().slice(0, 200) } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim().slice(0, 2000) : null } : {}),
        ...(type && VALID_TYPES.includes(type) ? { type } : {}),
        ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}),
        ...(level !== undefined ? { level: level || null } : {}),
        ...(audience && VALID_AUDIENCES.includes(audience) ? { audience } : {})
      }
    });

    res.json(updated);
  })
);

/**
 * @swagger
 * /api/calendar/{id}:
 *   delete:
 *     summary: حذف حدث
 *     tags: [calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم الحذف
 *       404:
 *         description: الحدث غير موجود أو لا تملك صلاحية حذفه
 */
router.delete(
  '/:id',
  requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const where = { id: req.params.id };
    if (req.user.role === 'TEACHER') where.createdBy = req.user.id;
    const result = await prisma.calendarEvent.deleteMany({ where });
    if (result.count === 0) throw new ApiError(404, 'الحدث غير موجود أو لا تملك صلاحية حذفه');
    res.json({ ok: true });
  })
);

export default router;
