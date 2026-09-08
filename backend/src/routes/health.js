import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { healthRecordSchema, healthStudentIdParamSchema } from '../validators/health.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { actorSchoolId } from '../tenant.js';

const router = Router();

// Public health check endpoint (for Render / load balancer)
router.get('/health', asyncHandler(async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'error', db: 'down', uptime: process.uptime() });
  }
}));

router.use(authMiddleware);

const SELECT = {
  id: true,
  studentId: true,
  allergies: true,
  chronicConditions: true,
  emergencyPhone: true,
  bloodType: true,
  notes: true,
  updatedAt: true
};

// ===== الولي: تعبئة وتعديل السجل الصحي لأبنائه =====
/**
 * @swagger
 * /api/parent/health:
 *   get:
 *     summary: السجلات الصحية لأبناء الولي
 *     tags: [health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة السجلات
 */
router.get(
  '/health',
  requireRole('PARENT'),
  asyncHandler(async (req, res) => {
    const students = await prisma.student.findMany({
      where: { userId: req.user.id, accountUserId: { not: null } },
      include: {
        account: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } }
      }
    });

    const records = await prisma.healthRecord.findMany({
      where: { studentId: { in: students.map((s) => s.accountUserId) } },
      select: SELECT
    });
    const recMap = Object.fromEntries(records.map((r) => [r.studentId, r]));

    res.json(
      students.map((s) => ({
        studentId: s.accountUserId,
        firstName: s.account.firstName,
        lastName: s.account.lastName,
        className: s.class?.name || null,
        record: recMap[s.accountUserId] || null
      }))
    );
  })
);

/**
 * @swagger
 * /api/parent/health/{studentId}:
 *   put:
 *     summary: تعديل السجل الصحي لابن (الولي)
 *     tags: [health]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allergies: { type: string }
 *               chronicConditions: { type: string }
 *               emergencyPhone: { type: string }
 *               bloodType: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: تم الحفظ
 *       404:
 *         description: التلميذ غير موجود في حساباتك
 */
router.put(
  '/health/:studentId',
  requireRole('PARENT'),
  validateParams(healthStudentIdParamSchema),
  validateBody(healthRecordSchema),
  asyncHandler(async (req, res) => {
    const studentId = req.params.studentId;
    const student = await prisma.student.findFirst({
      where: { accountUserId: studentId, userId: req.user.id }
    });
    if (!student) throw new ApiError(404, 'التلميذ غير موجود في حساباتك');

    const { allergies, chronicConditions, emergencyPhone, bloodType, notes } = req.body;
    const record = await prisma.healthRecord.upsert({
      where: { studentId },
      update: {
        allergies: allergies !== undefined ? (allergies ? String(allergies).trim().slice(0, 1000) : null) : undefined,
        chronicConditions: chronicConditions !== undefined
          ? (chronicConditions ? String(chronicConditions).trim().slice(0, 1000) : null)
          : undefined,
        emergencyPhone: emergencyPhone !== undefined
          ? (emergencyPhone ? String(emergencyPhone).trim().slice(0, 30) : null)
          : undefined,
        bloodType: bloodType !== undefined ? (bloodType ? String(bloodType).trim().slice(0, 10) : null) : undefined,
        notes: notes !== undefined ? (notes ? String(notes).trim().slice(0, 2000) : null) : undefined,
        updatedBy: req.user.id
      },
      create: {
        studentId,
        allergies: allergies || null,
        chronicConditions: chronicConditions || null,
        emergencyPhone: emergencyPhone || null,
        bloodType: bloodType || null,
        notes: notes || null,
        updatedBy: req.user.id
      },
      select: SELECT
    });

    res.json(record);
  })
);

// ===== الأستاذ: الاطلاع على السجلات الصحية لتلاميذ أقسامه =====
/**
 * @swagger
 * /api/teacher/health/class:
 *   get:
 *     summary: السجلات الصحية لتلاميذ أقسام الأستاذ
 *     tags: [health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الأقسام والسجلات
 */
router.get(
  '/health/class',
  requireRole('TEACHER'),
  asyncHandler(async (req, res) => {
    const classes = await prisma.class.findMany({
      where: { teacherId: req.user.id },
      include: {
        students: {
          where: { accountUserId: { not: null } },
          include: { account: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });

    const ids = classes.flatMap((c) => c.students.map((s) => s.accountUserId));
    const records = await prisma.healthRecord.findMany({
      where: { studentId: { in: ids } },
      select: SELECT
    });
    const recMap = Object.fromEntries(records.map((r) => [r.studentId, r]));

    res.json(
      classes.map((c) => ({
        classId: c.id,
        className: c.name,
        students: c.students
          .filter((s) => s.account)
          .map((s) => ({
            studentId: s.account.id,
            firstName: s.account.firstName,
            lastName: s.account.lastName,
            record: recMap[s.account.id] || null
          }))
      }))
    );
  })
);

// ===== مدير المدرسة / المدير العام: الاطلاع الكامل =====
/**
 * @swagger
 * /api/director/health/all:
 *   get:
 *     summary: كل السجلات الصحية (إدارة)
 *     tags: [health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة السجلات
 */
router.get(
  '/health/all',
  requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const sid = actorSchoolId(req);
    const records = await prisma.healthRecord.findMany({
      where: sid != null ? { student: { account: { schoolId: sid } } } : {},
      select: { ...SELECT, student: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(records);
  })
);

export default router;
