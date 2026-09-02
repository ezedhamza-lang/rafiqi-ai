import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware, studentMiddleware } from '../auth.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { buildStudentReport, buildClassReport } from '../services/analyticsService.js';
import { buildGradesCsv, buildGradesPdf, setAttachment } from '../services/exportService.js';
import {
  analyticsStudentParamSchema,
  analyticsClassParamSchema,
  analyticsExportQuerySchema
} from '../validators/analytics.js';

const router = Router();
router.use(authMiddleware);

async function studentBelongsToTeacher(studentAccountId, teacherId) {
  return prisma.student.findFirst({
    where: {
      accountUserId: studentAccountId,
      class: { teacherId }
    },
    include: { class: true }
  });
}

async function loadStudentAnalytics(student) {
  if (!student) return null;
  const assignments = await prisma.assignment.findMany({
    where: { classId: student.classId },
    orderBy: { dueDate: 'asc' }
  });
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId: student.accountUserId }
  });
  return buildStudentReport({ student, klass: student.class, assignments, submissions });
}

/**
 * @swagger
 * /api/teacher/analytics/class/{classId}:
 *   get:
 *     summary: تقرير تحليلي لقسم كامل
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تقرير القسم مع قائمة التلاميذ والتنبيهات
 *       404:
 *         description: القسم غير موجود
 */
router.get('/analytics/class/:classId', teacherMiddleware, validateParams(analyticsClassParamSchema), asyncHandler(async (req, res) => {
  const klass = await prisma.class.findFirst({
    where: { id: Number(req.params.classId), teacherId: req.user.id },
    include: { students: { include: { account: true } } }
  });
  if (!klass) throw new ApiError(404, 'القسم غير موجود أو غير تابع لك');

  const assignments = await prisma.assignment.findMany({
    where: { classId: klass.id },
    orderBy: { dueDate: 'asc' }
  });
  const studentAccountIds = klass.students.map((s) => s.accountUserId).filter(Boolean);
  const submissions = studentAccountIds.length
    ? await prisma.assignmentSubmission.findMany({ where: { studentId: { in: studentAccountIds } } })
    : [];

  res.json(buildClassReport({ klass, students: klass.students, assignments, submissions }));
}));

/**
 * @swagger
 * /api/teacher/analytics/students/{studentId}:
 *   get:
 *     summary: تقرير تحليلي لتلميذ واحد
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تقرير القوة/الضعف والمنحنى والتنبيهات
 *       404:
 *         description: التلميذ غير موجود
 */
router.get('/analytics/students/:studentId', teacherMiddleware, validateParams(analyticsStudentParamSchema), asyncHandler(async (req, res) => {
  const student = await studentBelongsToTeacher(Number(req.params.studentId), req.user.id);
  if (!student || !student.class) {
    throw new ApiError(404, 'التلميذ غير موجود في أقسامك');
  }
  const report = await loadStudentAnalytics(student);
  if (!report) throw new ApiError(404, 'التلميذ غير موجود');
  res.json(report);
}));

/**
 * @swagger
 * /api/teacher/analytics/export:
 *   get:
 *     summary: تصدير درجات القسم (Excel CSV أو PDF)
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema: { type: integer }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, pdf] }
 *     responses:
 *       200:
 *         description: ملف التصدير
 */
router.get('/analytics/export', teacherMiddleware, validateQuery(analyticsExportQuerySchema), asyncHandler(async (req, res) => {
  const classId = Number(req.query.classId);
  const format = req.query.format || 'csv';

  const klass = await prisma.class.findFirst({
    where: { id: classId, teacherId: req.user.id },
    include: { students: { include: { account: true } } }
  });
  if (!klass) throw new ApiError(404, 'القسم غير موجود أو غير تابع لك');

  const assignments = await prisma.assignment.findMany({
    where: { classId: klass.id },
    orderBy: { dueDate: 'asc' }
  });
  const studentAccountIds = klass.students.map((s) => s.accountUserId).filter(Boolean);
  const submissions = studentAccountIds.length
    ? await prisma.assignmentSubmission.findMany({ where: { studentId: { in: studentAccountIds } } })
    : [];

  const report = buildClassReport({ klass, students: klass.students, assignments, submissions });

  const fileName = `${klass.name || 'قسم'}-النتائج.${format === 'pdf' ? 'pdf' : 'csv'}`;

  if (format === 'pdf') {
    const buffer = await buildGradesPdf({ klass, rows: report.students, assignments: report.perAssignment });
    return setAttachment(res, fileName, 'application/pdf', buffer);
  }

  const csv = buildGradesCsv({ klass, rows: report.students, assignments: report.perAssignment });
  const buffer = Buffer.from(csv, 'utf8');
  return setAttachment(res, fileName, 'text/csv; charset=utf-8', buffer);
}));

/**
 * @swagger
 * /api/student/analytics:
 *   get:
 *     summary: التقرير التحليلي الخاص بالتلميذ
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: التقرير التحليلي للتلميذ
 */
router.get('/analytics/self', studentMiddleware, asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { accountUserId: req.user.id },
    include: { class: true }
  });
  const report = await loadStudentAnalytics(student);
  if (!report) throw new ApiError(404, 'لا توجد بيانات تلميذ مرتبطة');
  res.json(report);
}));

export default router;
