import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { attendanceSaveSchema, classIdParamSchema, attendanceQuerySchema } from '../validators/attendance.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { actorSchoolId } from '../tenant.js';

const router = Router();
router.use(authMiddleware);

const ATTENDANCE_ROLES = ['TEACHER', 'ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'];

/**
 * @swagger
 * /api/attendance/classes/{classId}:
 *   get:
 *     summary: قائمة حضور قسم (أستاذ/إدارة)
 *     tags: [attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: قائمة التلاميذ وحالة الحضور
 *       404:
 *         description: القسم غير موجود
 */
router.get(
  '/attendance/classes/:classId',
  requireRole(...ATTENDANCE_ROLES),
  validateParams(classIdParamSchema),
  validateQuery(attendanceQuerySchema),
  asyncHandler(async (req, res) => {
    const classId = req.params.classId;
    const klass = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(req.user.role === 'TEACHER' ? { teacherId: req.user.id } : {}),
      ...(actorSchoolId(req) != null ? { schoolId: actorSchoolId(req) } : {})
      },
      include: {
        students: {
          where: { accountUserId: { not: null } },
          include: { account: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });
    if (!klass) throw new ApiError(404, 'القسم غير موجود');

    const dateParam = req.query.date || new Date().toISOString().slice(0, 10);
    const date = new Date(`${dateParam}T00:00:00.000Z`);

    const existing = await prisma.attendanceRecord.findMany({ where: { classId, date } });

    const students = klass.students
      .filter((s) => s.account)
      .map((s) => {
        const rec = existing.find((r) => r.studentId === s.account.id);
        return {
          studentId: s.account.id,
          firstName: s.account.firstName,
          lastName: s.account.lastName,
          present: rec ? rec.present : true,
          note: rec ? rec.note : null
        };
      });

    res.json({ date: dateParam, className: klass.name, students, saved: existing.length > 0 });
  })
);

/**
 * @swagger
 * /api/attendance/save:
 *   post:
 *     summary: حفظ سجل حضور قسم
 *     tags: [attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classId, date, records]
 *             properties:
 *               classId: { type: integer }
 *               date: { type: string, format: date, description: "YYYY-MM-DD" }
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [studentId]
 *                   properties:
 *                     studentId: { type: integer }
 *                     present: { type: boolean }
 *                     note: { type: string }
 *     responses:
 *       200:
 *         description: تم الحفظ
 *       404:
 *         description: القسم غير موجود
 */
router.post(
  '/attendance/save',
  requireRole(...ATTENDANCE_ROLES),
  validateBody(attendanceSaveSchema),
  asyncHandler(async (req, res) => {
    const { classId, date, records } = req.body;
    const klass = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(req.user.role === 'TEACHER' ? { teacherId: req.user.id } : {}),
      ...(actorSchoolId(req) != null ? { schoolId: actorSchoolId(req) } : {})
      }
    });
    if (!klass) throw new ApiError(404, 'القسم غير موجود');

    const targetDate = new Date(`${date}T00:00:00.000Z`);
    const absentIds = [];

    const roster = await prisma.student.findMany({
      where: { classId: klass.id, accountUserId: { not: null } },
      select: { accountUserId: true }
    });
    const rosterIds = new Set(roster.map((r) => r.accountUserId));
    const invalid = records.filter((r) => !rosterIds.has(Number(r.studentId)));
    if (invalid.length) {
      throw new ApiError(400, 'بعض التلاميذ غير مسجلين في هذا القسم');
    }

    for (const r of records) {
      const studentId = Number(r.studentId);
      if (!studentId) continue;
      const present = r.present !== false;
      if (!present) absentIds.push(studentId);
      await prisma.attendanceRecord.upsert({
        where: { classId_studentId_date: { classId: klass.id, studentId, date: targetDate } },
        update: { present, note: r.note ? String(r.note).trim().slice(0, 500) : null },
        create: {
          classId: klass.id,
          studentId,
          date: targetDate,
          present,
          note: r.note ? String(r.note).trim().slice(0, 500) : null,
          recordedBy: req.user.id
        }
      });
    }

    if (absentIds.length) {
      const parents = await prisma.student.findMany({
        where: { accountUserId: { in: absentIds } },
        select: { userId: true, firstName: true, lastName: true }
      });
      if (parents.length) {
        await prisma.notification.createMany({
          data: parents.map((p) => ({
            userId: p.userId,
            type: 'ATTENDANCE',
            title: 'تنبيه غياب',
            body: `ابنكم ${p.firstName} ${p.lastName} غائب يوم ${new Date(targetDate).toLocaleDateString('ar-TN')}`,
            link: '/parent'
          }))
        });
      }
    }

    res.json({ ok: true, saved: records.length, absent: absentIds.length });
  })
);

/**
 * @swagger
 * /api/attendance/children:
 *   get:
 *     summary: غيابات أبناء الولي
 *     tags: [attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, maximum: 90 }
 *     responses:
 *       200:
 *         description: سجل الغيابات لكل ابن
 */
router.get(
  '/attendance/children',
  requireRole('PARENT'),
  validateQuery(attendanceQuerySchema),
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const students = await prisma.student.findMany({
      where: { userId: req.user.id, accountUserId: { not: null } },
      include: {
        account: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } }
      }
    });

    const records = await prisma.attendanceRecord.findMany({
      where: {
        studentId: { in: students.map((s) => s.accountUserId) },
        date: { gte: since }
      },
      orderBy: { date: 'desc' }
    });

    res.json(
      students.map((s) => ({
        student: s,
        records: records
          .filter((r) => r.studentId === s.accountUserId)
          .map((r) => ({ id: r.id, date: r.date, present: r.present, note: r.note }))
      }))
    );
  })
);

export default router;
