import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware, studentMiddleware } from '../auth.js';
import { gradeQuiz } from '../services/gradingService.js';
import { awardXp, checkBadges, registerDailyActivity, XP_QUIZ } from '../services/gamificationService.js';
import { notify } from '../services/notify.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  assignmentCreateSchema,
  assignmentUpdateSchema,
  assignmentSubmitSchema,
  assignmentGradeSchema,
  assignmentIdParamSchema,
  assignmentSubmissionParamSchema
} from '../validators/assignment.js';

const router = Router();
router.use(authMiddleware);

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('يجب إضافة سؤال واحد على الأقل');
  }
  return questions.map((q, i) => ({
    id: q.id ?? `q${i + 1}`,
    type: q.type,
    prompt: String(q.prompt ?? '').trim(),
    points: Number(q.points) || 1,
    ...(q.correctOption !== undefined ? { correctOption: String(q.correctOption) } : {}),
    ...(q.correctAnswer !== undefined ? { correctAnswer: q.correctAnswer } : {}),
    ...(q.options ? { options: q.options } : {}),
    ...(q.orderItems ? { orderItems: q.orderItems } : {})
  }));
}

async function getStudentRecord(userId) {
  return prisma.student.findFirst({ where: { accountUserId: userId } });
}

async function notifyClassStudents(classId, payload) {
  const students = await prisma.student.findMany({
    where: { classId },
    select: { accountUserId: true }
  });
  await notify(
    students.map((s) => s.accountUserId).filter(Boolean),
    payload
  );
}

async function notifyStudentParents(studentAccountId, payload) {
  const studentRecord = await prisma.student.findFirst({ where: { accountUserId: studentAccountId } });
  await notify([studentRecord?.userId], payload);
}

/**
 * @swagger
 * /api/teacher/assignments:
 *   get:
 *     summary: تكليفات الأستاذ
 *     tags: [assignments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة التكليفات
 */
router.get('/assignments', teacherMiddleware, asyncHandler(async (req, res) => {
  const assignments = await prisma.assignment.findMany({
    where: { teacherId: req.user.id },
    include: {
      class: true,
      _count: { select: { submissions: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(assignments);
}));

/**
 * @swagger
 * /api/teacher/assignments:
 *   post:
 *     summary: إنشاء تكليف
 *     tags: [assignments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, subject]
 *             properties:
 *               title: { type: string }
 *               subject: { type: string }
 *               classId: { type: integer }
 *               description: { type: string }
 *               dueDate: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, CLOSED] }
 *               questions: { type: array }
 *     responses:
 *       201:
 *         description: تم إنشاء التكليف
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post('/assignments', teacherMiddleware, validateBody(assignmentCreateSchema), asyncHandler(async (req, res) => {
  const { title, subject, classId, description, dueDate, status, questions } = req.body;
  try {
    const assignment = await prisma.assignment.create({
      data: {
        teacherId: req.user.id,
        title: String(title).trim(),
        subject,
        classId: classId ? Number(classId) : null,
        description: description ? String(description).trim() : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'PUBLISHED',
        questions: validateQuestions(questions)
      }
    });

    if (assignment.status === 'PUBLISHED' && assignment.classId) {
      await notifyClassStudents(assignment.classId, {
        type: 'ASSIGNMENT',
        title: 'تكليف جديد',
        body: `أنشأ أستاذك تكليفًا جديدًا: «${assignment.title}»`,
        link: '/student-space/assignments'
      });
    }

    res.status(201).json(assignment);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
}));

/**
 * @swagger
 * /api/teacher/assignments/{id}:
 *   get:
 *     summary: تفاصيل تكليف
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
 *         description: التكليف
 *       404:
 *         description: التكليف غير موجود
 */
router.get('/assignments/:id', teacherMiddleware, validateParams(assignmentIdParamSchema), asyncHandler(async (req, res) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    include: { class: true }
  });
  if (!assignment) throw new ApiError(404, 'التكليف غير موجود');
  res.json(assignment);
}));

/**
 * @swagger
 * /api/teacher/assignments/{id}:
 *   put:
 *     summary: تعديل تكليف
 *     tags: [assignments]
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
 *               subject: { type: string }
 *               classId: { type: integer }
 *               description: { type: string }
 *               dueDate: { type: string }
 *               status: { type: string, enum: [DRAFT, PUBLISHED, CLOSED] }
 *               questions: { type: array }
 *     responses:
 *       200:
 *         description: تم التعديل
 *       404:
 *         description: التكليف غير موجود
 */
router.put('/assignments/:id', teacherMiddleware, validateParams(assignmentIdParamSchema), validateBody(assignmentUpdateSchema), asyncHandler(async (req, res) => {
  const { title, subject, classId, description, dueDate, status, questions } = req.body;
  try {
    const assignment = await prisma.assignment.findFirst({
      where: { id: Number(req.params.id), teacherId: req.user.id }
    });
    if (!assignment) throw new ApiError(404, 'التكليف غير موجود');

    const wasPublished = assignment.status === 'PUBLISHED';
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: {
        ...(title ? { title: String(title).trim() } : {}),
        ...(subject ? { subject } : {}),
        ...(classId !== undefined ? { classId: classId ? Number(classId) : null } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(status ? { status } : {}),
        ...(questions ? { questions: validateQuestions(questions) } : {})
      }
    });

    if (updated.status === 'PUBLISHED' && !wasPublished && updated.classId) {
      await notifyClassStudents(updated.classId, {
        type: 'ASSIGNMENT',
        title: 'تكليف جديد',
        body: `أنشأ أستاذك تكليفًا جديدًا: «${updated.title}»`,
        link: '/student-space/assignments'
      });
    }

    res.json(updated);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
}));

/**
 * @swagger
 * /api/teacher/assignments/{id}:
 *   delete:
 *     summary: حذف تكليف
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
 *         description: تم الحذف
 */
router.delete('/assignments/:id', teacherMiddleware, validateParams(assignmentIdParamSchema), asyncHandler(async (req, res) => {
  await prisma.assignment.deleteMany({ where: { id: Number(req.params.id), teacherId: req.user.id } });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/assignments/{id}/submissions:
 *   get:
 *     summary: تسليمات تكليف معين
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
 *         description: قائمة التسليمات
 *       404:
 *         description: التكليف غير موجود
 */
router.get('/assignments/:id/submissions', teacherMiddleware, validateParams(assignmentIdParamSchema), asyncHandler(async (req, res) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    include: {
      class: { include: { students: { include: { account: true } } } }
    }
  });
  if (!assignment) throw new ApiError(404, 'التكليف غير موجود');

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId: assignment.id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  const submittedMap = new Map(submissions.map((s) => [s.studentId, s]));

  const classStudents = (assignment.class?.students || [])
    .filter((s) => s.accountUserId)
    .map((s) => ({
      studentId: s.accountUserId,
      firstName: s.account?.firstName || s.firstName,
      lastName: s.account?.lastName || s.lastName,
      submission: submittedMap.get(s.accountUserId) || null
    }));

  res.json({ assignment, submissions, classStudents });
}));

/**
 * @swagger
 * /api/teacher/assignments/{id}/submissions/{submissionId}:
 *   put:
 *     summary: تصحيح يدوي لتسليم تلميذ
 *     tags: [assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [score]
 *             properties:
 *               score: { type: number }
 *               feedback: { type: string }
 *     responses:
 *       200:
 *         description: تم التصحيح
 *       404:
 *         description: التسليم غير موجود
 */
router.put('/assignments/:id/submissions/:submissionId', teacherMiddleware, validateParams(assignmentSubmissionParamSchema), validateBody(assignmentGradeSchema), asyncHandler(async (req, res) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id }
  });
  if (!assignment) throw new ApiError(404, 'التكليف غير موجود');

  const submission = await prisma.assignmentSubmission.findFirst({
    where: { id: Number(req.params.submissionId), assignmentId: assignment.id }
  });
  if (!submission) throw new ApiError(404, 'التسليم غير موجود');

  const rawScore = Number(req.body.score);
  const totalPoints = submission.totalPoints ?? rawScore;
  const score = Math.min(rawScore, totalPoints);

  let graded = submission.graded || [];
  if (submission.score > 0 && graded.length) {
    const ratio = score / submission.score;
    graded = graded.map((g) => ({
      ...g,
      earned: Math.min(Number(g.points) || 0, Math.round((Number(g.earned) || 0) * ratio))
    }));
  } else if (!graded.length) {
    graded = [
      {
        questionId: 'MANUAL',
        points: totalPoints,
        earned: score,
        correct: score >= totalPoints
      }
    ];
  }

  const updated = await prisma.assignmentSubmission.update({
    where: { id: submission.id },
    data: {
      score,
      totalPoints,
      status: 'GRADED',
      feedback: req.body.feedback ? String(req.body.feedback).trim() : null,
      graded,
      gradedAt: new Date()
    }
  });

  const percent = totalPoints ? Math.min(100, Math.round((score / totalPoints) * 100)) : 0;
  await notifyStudentParents(submission.studentId, {
    type: 'ASSIGNMENT_GRADED',
    title: 'تم تصحيح تكليف',
    body: `تم تصحيح تكليف «${assignment.title}»: ${updated.score} نقطة (${percent}%)`,
    link: '/parent/assignments'
  });
  await notify([submission.studentId], {
    type: 'ASSIGNMENT_GRADED',
    title: 'تم تصحيح تكليفك',
    body: `تم تصحيح تكليف «${assignment.title}»: ${updated.score} نقطة (${percent}%)`,
    link: '/student-space/assignments'
  });

  res.json({ ...updated, percent, graded });
}));

/**
 * @swagger
 * /api/teacher/student/assignments:
 *   get:
 *     summary: تكليفات التلميذ المتاحة
 *     tags: [assignments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة التكليفات
 */
router.get('/student/assignments', studentMiddleware, asyncHandler(async (req, res) => {
  const studentRecord = await getStudentRecord(req.user.id);
  if (!studentRecord?.classId) return res.json([]);

  const assignments = await prisma.assignment.findMany({
    where: {
      classId: studentRecord.classId,
      status: { in: ['PUBLISHED', 'CLOSED'] }
    },
    include: { class: true },
    orderBy: { dueDate: 'asc' }
  });

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId: req.user.id, assignmentId: { in: assignments.map((a) => a.id) } }
  });
  const subMap = new Map(submissions.map((s) => [s.assignmentId, s]));

  res.json(
    assignments.map((a) => {
      const sub = subMap.get(a.id);
      const overdue = a.dueDate && new Date(a.dueDate) < new Date();
      return {
        ...a,
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
              percent: sub.totalPoints ? Math.round((sub.score / sub.totalPoints) * 100) : 0
            }
          : null
      };
    })
  );
}));

/**
 * @swagger
 * /api/teacher/student/assignments/{id}:
 *   get:
 *     summary: تفاصيل تكليف للتلميذ
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
 *         description: التكليف
 *       400:
 *         description: تمت الإجابة مسبقا أو خارج النطاق
 *       404:
 *         description: التكليف غير موجود
 */
router.get('/student/assignments/:id', studentMiddleware, validateParams(assignmentIdParamSchema), asyncHandler(async (req, res) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: Number(req.params.id) }
  });
  if (!assignment) throw new ApiError(404, 'التكليف غير موجود');

  const studentRecord = await getStudentRecord(req.user.id);
  if (!studentRecord?.classId || assignment.classId !== studentRecord.classId) {
    throw new ApiError(400, 'هذا التكليف ليس لقسمك');
  }

  const existing = await prisma.assignmentSubmission.findFirst({
    where: { assignmentId: assignment.id, studentId: req.user.id }
  });

  const sub = existing
    ? {
        id: existing.id,
        status: existing.status,
        score: existing.score,
        totalPoints: existing.totalPoints,
        feedback: existing.feedback,
        gradedAt: existing.gradedAt,
        answers: existing.answers,
        graded: existing.graded,
        percent: existing.totalPoints ? Math.round((existing.score / existing.totalPoints) * 100) : 0
      }
    : null;

  res.json({ ...assignment, submission: sub });
}));

/**
 * @swagger
 * /api/teacher/student/assignments/{id}/submit:
 *   post:
 *     summary: إرسال إجابات تكليف
 *     tags: [assignments]
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
 *               answers: { type: object }
 *               durationSec: { type: integer }
 *     responses:
 *       201:
 *         description: تم الإرسال
 *       400:
 *         description: تمت الإجابة مسبقا
 *       404:
 *         description: التكليف غير موجود
 */
router.post('/student/assignments/:id/submit', studentMiddleware, validateParams(assignmentIdParamSchema), validateBody(assignmentSubmitSchema), asyncHandler(async (req, res) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: Number(req.params.id) }
  });
  if (!assignment) throw new ApiError(404, 'التكليف غير موجود');
  if (assignment.status !== 'PUBLISHED') {
    throw new ApiError(400, 'هذا التكليف غير مفتوح للتسليم حاليا');
  }

  const studentRecord = await getStudentRecord(req.user.id);
  if (!studentRecord?.classId || assignment.classId !== studentRecord.classId) {
    throw new ApiError(400, 'هذا التكليف ليس لقسمك');
  }

  const existing = await prisma.assignmentSubmission.findFirst({
    where: { assignmentId: assignment.id, studentId: req.user.id }
  });
  if (existing) throw new ApiError(400, 'لقد أرسلت إجابات هذا التكليف مسبقا');

  const result = gradeQuiz(assignment.questions, req.body.answers || {});
  const late = Boolean(assignment.dueDate && new Date(assignment.dueDate) < new Date());
  const submission = await prisma.assignmentSubmission.create({
    data: {
      assignmentId: assignment.id,
      studentId: req.user.id,
      answers: req.body.answers || {},
      graded: result.graded,
      score: result.score,
      totalPoints: result.totalPoints,
      status: 'GRADED',
      late,
      gradedAt: new Date()
    }
  });

  await awardXp(req.user.id, XP_QUIZ, 'ASSIGNMENT', assignment.title);
  await registerDailyActivity(req.user.id);
  const newBadges = await checkBadges(req.user.id);

  await notify([assignment.teacherId], {
    type: 'ASSIGNMENT_SUBMITTED',
    title: 'تسليم تكليف جديد',
    body: `أرسل التلميذ ${req.user.firstName} ${req.user.lastName} إجابات تكليف «${assignment.title}»`,
    link: '/teacher/assignments'
  });
  await notifyStudentParents(req.user.id, {
    type: 'ASSIGNMENT_SUBMITTED',
    title: 'أنجز ابنك تكليفًا',
    body: `أنجز ابنك تكليف «${assignment.title}»`,
    link: '/parent/assignments'
  });

  res.status(201).json({ ...submission, percent: result.percent, newBadges });
}));

export default router;
