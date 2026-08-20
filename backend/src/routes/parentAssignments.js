import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { assignmentIdParamSchema } from '../validators/assignment.js';

const router = Router();
router.use(authMiddleware);

function percentOf(submission) {
  if (!submission) return null;
  if (!submission.totalPoints) return 0;
  return Math.round((submission.score / submission.totalPoints) * 100);
}

/**
 * @swagger
 * /api/parent/assignments:
 *   get:
 *     summary: تكليفات أبناء الولي
 *     tags: [assignments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: التكليفات حسب كل ابن
 */
router.get('/assignments', requireRole('PARENT'), asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: { userId: req.user.id },
    include: { class: { select: { id: true, name: true, teacherId: true } }, account: true }
  });

  const children = [];
  for (const s of students) {
    if (!s.accountUserId || !s.classId) {
      children.push({ student: s, assignments: [] });
      continue;
    }

    const assignments = await prisma.assignment.findMany({
      where: { classId: s.classId },
      include: { class: true },
      orderBy: { dueDate: 'asc' }
    });

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { studentId: s.accountUserId, assignmentId: { in: assignments.map((a) => a.id) } }
    });
    const subMap = new Map(submissions.map((x) => [x.assignmentId, x]));

    children.push({
      student: s,
      assignments: assignments.map((a) => {
        const sub = subMap.get(a.id);
        const overdue = a.dueDate && new Date(a.dueDate) < new Date();
        return {
          id: a.id,
          title: a.title,
          subject: a.subject,
          description: a.description,
          dueDate: a.dueDate,
          status: a.status,
          questionsCount: Array.isArray(a.questions) ? a.questions.length : 0,
          done: !!sub,
          overdue,
          submission: sub
            ? {
                id: sub.id,
                status: sub.status,
                score: sub.score,
                totalPoints: sub.totalPoints,
                feedback: sub.feedback,
                gradedAt: sub.gradedAt,
                percent: percentOf(sub)
              }
            : null
        };
      })
    });
  }

  res.json(children);
}));

/**
 * @swagger
 * /api/parent/assignments/{id}:
 *   get:
 *     summary: تفاصيل تكليف لابن الولي
 *     tags: [assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: التكليف مع حالة إنجاز الابن
 *       404:
 *         description: التكليف غير موجود
 */
router.get('/assignments/:id', requireRole('PARENT'), validateParams(assignmentIdParamSchema), asyncHandler(async (req, res) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: Number(req.params.id) },
    include: { class: true }
  });
  if (!assignment) throw new ApiError(404, 'التكليف غير موجود');

  const students = await prisma.student.findMany({
    where: { userId: req.user.id, classId: assignment.classId || -1 }
  });
  if (!students.length) throw new ApiError(403, 'التكليف لا يخص أبناءك');

  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      assignmentId: assignment.id,
      studentId: { in: students.map((s) => s.accountUserId).filter(Boolean) }
    }
  });
  const subMap = new Map(submissions.map((s) => [s.studentId, s]));

  res.json({
    ...assignment,
    children: students.map((s) => {
      const sub = subMap.get(s.accountUserId);
      return {
        studentId: s.accountUserId,
        firstName: s.firstName,
        lastName: s.lastName,
        submission: sub
          ? {
              id: sub.id,
              status: sub.status,
              score: sub.score,
              totalPoints: sub.totalPoints,
              feedback: sub.feedback,
              gradedAt: sub.gradedAt,
              percent: percentOf(sub)
            }
          : null
      };
    })
  });
}));

export default router;
