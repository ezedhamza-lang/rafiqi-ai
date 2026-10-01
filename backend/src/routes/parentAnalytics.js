import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { buildStudentReport } from '../services/analyticsService.js';
import { analyticsStudentParamSchema } from '../validators/analytics.js';

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/parent/analytics/children/{studentId}:
 *   get:
 *     summary: تقرير تحليلي لابن الولي
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
 *         description: التقرير التحليلي للابن (القوة/الضعف والمنحنى والتنبيهات)
 *       404:
 *         description: الابن غير موجود
 */
router.get('/analytics/children/:studentId', requireRole('PARENT', 'TEACHER'), validateParams(analyticsStudentParamSchema), asyncHandler(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { userId: req.user.id, accountUserId: Number(req.params.studentId) },
    include: { class: true }
  });
  if (!student) throw new ApiError(404, 'الابن غير موجود');

  const assignments = await prisma.assignment.findMany({
    where: { classId: student.classId },
    orderBy: { dueDate: 'asc' }
  });
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId: student.accountUserId }
  });

  res.json(buildStudentReport({ student, klass: student.class, assignments, submissions }));
}));

export default router;
