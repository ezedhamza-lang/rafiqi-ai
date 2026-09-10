import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware, studentMiddleware } from '../auth.js';
import { gradeQuiz } from '../services/gradingService.js';
import { awardXp, checkBadges, registerDailyActivity, XP_QUIZ } from '../services/gamificationService.js';
import { gradeOfficialExam } from '../services/officialExamService.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { quizCreateSchema, quizUpdateSchema, quizSubmitSchema, quizIdParamSchema } from '../validators/teacher.js';

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

const ANSWER_KEYS = new Set(['correctOption', 'correctAnswer', 'orderItems']);

function sanitizeQuizForStudent(quiz) {
  const questions = Array.isArray(quiz.questions)
    ? quiz.questions.map((q) => {
        const clean = { ...q };
        ANSWER_KEYS.forEach((k) => delete clean[k]);
        return clean;
      })
    : quiz.questions;
  return { ...quiz, questions };
}

// عزل: التلميذ يُقيَّد بقسمه دائماً؛ تلميذ بلا قسم ⇒ صنف مستحيل المطابقة
// (لا يرى بنوك بقية المدارس). الأدوار غير التلميذية (معلّم/إدارة) بلا قيد.
function studentClassFilter(req, studentRecord) {
  if (studentRecord?.classId) return { classId: studentRecord.classId };
  if (req.user.role === 'STUDENT') return { classId: -1 };
  return {};
}

/**
 * @swagger
 * /api/teacher/classes:
 *   get:
 *     summary: أقسام الأستاذ
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الأقسام
 */
router.get('/classes', teacherMiddleware, asyncHandler(async (req, res) => {
  const classes = await prisma.class.findMany({
    where: { teacherId: req.user.id },
    include: { _count: { select: { students: true } } },
    orderBy: { name: 'asc' }
  });
  res.json(classes);
}));

/**
 * @swagger
 * /api/teacher/quizzes:
 *   get:
 *     summary: اختبارات الأستاذ
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الاختبارات
 */
router.get('/quizzes', teacherMiddleware, asyncHandler(async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { teacherId: req.user.id },
    include: {
      class: true,
      _count: { select: { submissions: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(quizzes);
}));

/**
 * @swagger
 * /api/teacher/quizzes:
 *   post:
 *     summary: إنشاء اختبار
 *     tags: [teacher]
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
 *               subject: { type: string, enum: [MATH, READING, SCIENCE, STORIES] }
 *               classId: { type: integer }
 *               questions: { type: array }
 *     responses:
 *       201:
 *         description: تم إنشاء الاختبار
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post('/quizzes', teacherMiddleware, validateBody(quizCreateSchema), asyncHandler(async (req, res) => {
  const { title, subject, classId, questions } = req.body;
  let normalized;
  try {
    normalized = validateQuestions(questions);
  } catch (e) {
    throw new ApiError(400, e.message);
  }
  const quiz = await prisma.quiz.create({
    data: {
      teacherId: req.user.id,
      title: String(title).trim(),
      subject,
      classId: classId ? Number(classId) : null,
      questions: normalized
    }
  });
  res.status(201).json(quiz);
}));

/**
 * @swagger
 * /api/teacher/quizzes/{id}:
 *   get:
 *     summary: تفاصيل اختبار
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: الاختبار
 *       404:
 *         description: الاختبار غير موجود
 */
router.get('/quizzes/:id', teacherMiddleware, validateParams(quizIdParamSchema), asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    include: { class: true }
  });
  if (!quiz) throw new ApiError(404, 'الاختبار غير موجود');
  res.json(quiz);
}));

/**
 * @swagger
 * /api/teacher/quizzes/{id}:
 *   put:
 *     summary: تعديل اختبار
 *     tags: [teacher]
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
 *               questions: { type: array }
 *     responses:
 *       200:
 *         description: تم التعديل
 *       400:
 *         description: فشل التحقق من البيانات
 *       404:
 *         description: الاختبار غير موجود
 */
router.put('/quizzes/:id', teacherMiddleware, validateParams(quizIdParamSchema), validateBody(quizUpdateSchema), asyncHandler(async (req, res) => {
  const { title, subject, classId, questions } = req.body;
  let normalized;
  if (questions !== undefined) {
    try {
      normalized = validateQuestions(questions);
    } catch (e) {
      throw new ApiError(400, e.message);
    }
  }
  const quiz = await prisma.quiz.updateMany({
    where: { id: Number(req.params.id), teacherId: req.user.id },
    data: {
      ...(title ? { title: String(title).trim() } : {}),
      ...(subject ? { subject } : {}),
      ...(classId !== undefined ? { classId: classId ? Number(classId) : null } : {}),
      ...(questions !== undefined ? { questions: normalized } : {})
    }
  });
  if (quiz.count === 0) throw new ApiError(404, 'الاختبار غير موجود');
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/quizzes/{id}:
 *   delete:
 *     summary: حذف اختبار
 *     tags: [teacher]
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
router.delete('/quizzes/:id', teacherMiddleware, validateParams(quizIdParamSchema), asyncHandler(async (req, res) => {
  await prisma.quiz.deleteMany({ where: { id: Number(req.params.id), teacherId: req.user.id } });
  res.json({ ok: true });
}));

/**
 * @swagger
 * /api/teacher/quizzes/{id}/submissions:
 *   get:
 *     summary: تسليمات اختبار معين
 *     tags: [teacher]
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
 *         description: الاختبار غير موجود
 */
router.get('/quizzes/:id/submissions', teacherMiddleware, validateParams(quizIdParamSchema), asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.findFirst({
    where: { id: Number(req.params.id), teacherId: req.user.id }
  });
  if (!quiz) throw new ApiError(404, 'الاختبار غير موجود');
  const submissions = await prisma.submission.findMany({
    where: { quizId: quiz.id },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(submissions);
}));

/**
 * @swagger
 * /api/teacher/submissions:
 *   get:
 *     summary: كل تسليمات الأستاذ
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة التسليمات
 */
router.get('/submissions', teacherMiddleware, asyncHandler(async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { teacherId: req.user.id },
    select: { id: true }
  });
  const ids = quizzes.map((q) => q.id);
  const submissions = await prisma.submission.findMany({
    where: { quizId: { in: ids } },
    include: {
      quiz: { select: { id: true, title: true, subject: true } },
      student: { select: { id: true, firstName: true, lastName: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  res.json(submissions);
}));

/**
 * @swagger
 * /api/teacher/results:
 *   get:
 *     summary: نتائج التلاميذ مجمعة
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: النتائج
 */
router.get('/results', teacherMiddleware, asyncHandler(async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { teacherId: req.user.id },
    select: { id: true }
  });
  const ids = quizzes.map((q) => q.id);
  const submissions = await prisma.submission.findMany({
    where: { quizId: { in: ids } },
    include: {
      quiz: { select: { id: true, title: true, subject: true } },
      student: { select: { id: true, firstName: true, lastName: true } }
    }
  });
  const byStudent = {};
  for (const s of submissions) {
    if (!byStudent[s.studentId]) byStudent[s.studentId] = { student: s.student, attempts: [], avgPercent: 0 };
    byStudent[s.studentId].attempts.push(s);
  }
  const results = Object.values(byStudent).map((r) => {
    const total = r.attempts.length;
    const sum = r.attempts.reduce((acc, a) => acc + (a.score / (a.totalPoints || 1)) * 100, 0);
    r.avgPercent = total ? Math.round(sum / total) : 0;
    return r;
  });
  res.json(results);
}));

/**
 * @swagger
 * /api/teacher/averages:
 *   get:
 *     summary: متوسطات الاختبارات
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: المعدلات
 */
router.get('/averages', teacherMiddleware, asyncHandler(async (req, res) => {
  const quizzes = await prisma.quiz.findMany({
    where: { teacherId: req.user.id },
    include: { class: true, submissions: true }
  });
  const data = quizzes.map((q) => {
    const total = q.submissions.length;
    const avg = total
      ? Math.round(q.submissions.reduce((acc, s) => acc + (s.score / (s.totalPoints || 1)) * 100, 0) / total)
      : 0;
    return {
      id: q.id,
      title: q.title,
      subject: q.subject,
      className: q.class?.name || 'بدون قسم',
      attempts: total,
      avgPercent: avg
    };
  });
  res.json(data);
}));

/**
 * @swagger
 * /api/teacher/student/quizzes:
 *   get:
 *     summary: اختبارات التلميذ المتاحة
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الاختبارات
 */
router.get('/student/quizzes', studentMiddleware, asyncHandler(async (req, res) => {
  const studentRecord = await prisma.student.findFirst({
    where: { accountUserId: req.user.id }
  });
  if (!studentRecord?.classId) return res.json([]);
  const quizzes = await prisma.quiz.findMany({
    where: { classId: studentRecord.classId },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const submissions = await prisma.submission.findMany({
    where: { studentId: req.user.id, quizId: { in: quizzes.map((q) => q.id) } }
  });
  const done = new Set(submissions.map((s) => s.quizId));
  res.json(quizzes.map((q) => ({ ...sanitizeQuizForStudent(q), done: done.has(q.id) })));
}));

/**
 * @swagger
 * /api/teacher/student/quizzes/{id}:
 *   get:
 *     summary: تفاصيل اختبار للتلميذ
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: الاختبار
 *       400:
 *         description: تمت الإجابة مسبقا
 *       404:
 *         description: الاختبار غير موجود
 */
router.get('/student/quizzes/:id', studentMiddleware, validateParams(quizIdParamSchema), asyncHandler(async (req, res) => {
  const studentRecord = await prisma.student.findFirst({
    where: { accountUserId: req.user.id }
  });
  const quiz = await prisma.quiz.findFirst({
    where: { id: Number(req.params.id), ...(studentClassFilter(req, studentRecord)) }
  });
  if (!quiz) throw new ApiError(404, 'الاختبار غير موجود');
  const existing = await prisma.submission.findFirst({
    where: { quizId: quiz.id, studentId: req.user.id }
  });
  if (existing) {
    throw new ApiError(400, 'لقد أجبت عن هذا الاختبار مسبقا');
  }
  res.json(sanitizeQuizForStudent(quiz));
}));

/**
 * @swagger
 * /api/teacher/student/quizzes/{id}/submit:
 *   post:
 *     summary: إرسال إجابات اختبار
 *     tags: [teacher]
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
 *         description: الاختبار غير موجود
 */
router.post('/student/quizzes/:id/submit', studentMiddleware, validateParams(quizIdParamSchema), validateBody(quizSubmitSchema), asyncHandler(async (req, res) => {
  const studentRecord = await prisma.student.findFirst({
    where: { accountUserId: req.user.id }
  });
  const quiz = await prisma.quiz.findFirst({
    where: { id: Number(req.params.id), ...(studentClassFilter(req, studentRecord)) }
  });
  if (!quiz) throw new ApiError(404, 'الاختبار غير موجود');

  const existing = await prisma.submission.findFirst({
    where: { quizId: quiz.id, studentId: req.user.id }
  });
  if (existing) throw new ApiError(400, 'لقد أجبت عن هذا الاختبار مسبقا');

  const result = gradeQuiz(quiz.questions, req.body.answers || {});
  const submission = await prisma.submission.create({
    data: {
      quizId: quiz.id,
      studentId: req.user.id,
      answers: req.body.answers || {},
      score: result.score,
      totalPoints: result.totalPoints,
      durationSec: req.body.durationSec ? Number(req.body.durationSec) : null
    }
  });

  await awardXp(req.user.id, XP_QUIZ, 'QUIZ', quiz.title);
  await registerDailyActivity(req.user.id);
  const newBadges = await checkBadges(req.user.id);

  res.status(201).json({ ...submission, percent: result.percent, graded: result.graded, newBadges });
}));

/**
 * @swagger
 * /api/teacher/student/mygrades:
 *   get:
 *     summary: درجات التلميذ
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الدرجات
 */
router.get('/student/mygrades', studentMiddleware, asyncHandler(async (req, res) => {
  const submissions = await prisma.submission.findMany({
    where: { studentId: req.user.id },
    include: { quiz: { select: { id: true, title: true, subject: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(submissions.map((s) => ({ ...s, percent: s.totalPoints ? Math.round((s.score / s.totalPoints) * 100) : 0 })));
}));

/**
 * @swagger
 * /api/teacher/student/profile:
 *   get:
 *     summary: ملف التلميذ الكامل
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الملف
 */
router.get('/student/profile', studentMiddleware, asyncHandler(async (req, res) => {
  const [user, student, badges, activities, submissions] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user.id } }),
    prisma.student.findFirst({
      where: { accountUserId: req.user.id },
      include: { class: true }
    }),
    prisma.studentBadge.findMany({
      where: { studentId: req.user.id },
      include: { badge: true }
    }),
    prisma.activityLog.findMany({
      where: { studentId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    }),
    prisma.submission.findMany({ where: { studentId: req.user.id } })
  ]);

  const totalPoints = submissions.reduce((acc, s) => acc + (s.totalPoints || 0), 0);
  const earnedPoints = submissions.reduce((acc, s) => acc + s.score, 0);
  const accuracy = totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const avgPercent = submissions.length
    ? Math.round(submissions.reduce((acc, s) => acc + (s.score / (s.totalPoints || 1)) * 100, 0) / submissions.length)
    : 0;

  res.json({
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      xp: user.xp,
      coins: user.coins,
      level: user.level,
      streakDays: user.streakDays
    },
    class: student?.class || null,
    badges: badges.map((b) => b.badge),
    activities,
    stats: {
      quizzesDone: submissions.length,
      accuracy,
      avgPercent
    }
  });
}));

const OFFICIAL_EXAM_ANSWER_KEYS = new Set(['correct', 'correctAnswer', 'orderItems']);

function sanitizeOfficialExamForStudent(exam) {
  const content = exam.content ? { ...exam.content, questions: (exam.content.questions || []).map((q) => {
    const clean = { ...q };
    OFFICIAL_EXAM_ANSWER_KEYS.forEach((k) => delete clean[k]);
    return clean;
  }) } : exam.content;
  return { ...exam, content };
}

/**
 * @swagger
 * /api/teacher/student/official-exams:
 *   get:
 *     summary: الاختبارات الرسمية المنشورة لقسم التلميذ
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الاختبارات الرسمية المنشورة
 */
router.get('/student/official-exams', studentMiddleware, asyncHandler(async (req, res) => {
  const studentRecord = await prisma.student.findFirst({
    where: { accountUserId: req.user.id }
  });
  if (!studentRecord?.classId) return res.json([]);
  const exams = await prisma.officialExam.findMany({
    where: { published: true, classId: studentRecord.classId },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const submissions = await prisma.officialSubmission.findMany({
    where: { studentId: req.user.id, examId: { in: exams.map((e) => e.id) } }
  });
  const done = new Set(submissions.map((s) => s.examId));
  res.json(
    exams.map((e) => ({
      ...sanitizeOfficialExamForStudent(e),
      done: done.has(e.id),
      mySubmission: submissions.find((s) => s.examId === e.id) || null
    }))
  );
}));

/**
 * @swagger
 * /api/teacher/student/official-exams/{id}:
 *   get:
 *     summary: تفاصيل اختبار رسمي للتلميذ (بدون مفاتيح الإجابة)
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: الاختبار
 *       404:
 *         description: الاختبار غير موجود
 */
router.get('/student/official-exams/:id', studentMiddleware, validateParams(quizIdParamSchema), asyncHandler(async (req, res) => {
  const studentRecord = await prisma.student.findFirst({
    where: { accountUserId: req.user.id }
  });
  const exam = await prisma.officialExam.findFirst({
    where: {
      id: Number(req.params.id),
      published: true,
      ...(studentClassFilter(req, studentRecord))
    }
  });
  if (!exam) throw new ApiError(404, 'الاختبار غير موجود');
  res.json(sanitizeOfficialExamForStudent(exam));
}));

/**
 * @swagger
 * /api/teacher/student/official-exams/{id}/submit:
 *   post:
 *     summary: إرسال إجابات اختبار رسمي (تصحيح آلي وفق جدول إسناد الأعداد)
 *     tags: [teacher]
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
 *     responses:
 *       201:
 *         description: النتيجة مع تفصيل المعايير
 *       400:
 *         description: تمت الإجابة مسبقا
 *       404:
 *         description: الاختبار غير موجود
 */
router.post('/student/official-exams/:id/submit', studentMiddleware, validateParams(quizIdParamSchema), validateBody(quizSubmitSchema), asyncHandler(async (req, res) => {
  const studentRecord = await prisma.student.findFirst({
    where: { accountUserId: req.user.id }
  });
  const exam = await prisma.officialExam.findFirst({
    where: {
      id: Number(req.params.id),
      published: true,
      ...(studentClassFilter(req, studentRecord))
    }
  });
  if (!exam) throw new ApiError(404, 'الاختبار غير موجود');

  const existing = await prisma.officialSubmission.findFirst({
    where: { examId: exam.id, studentId: req.user.id }
  });
  if (existing) throw new ApiError(400, 'لقد أجبت عن هذا الاختبار مسبقا');

  const result = gradeOfficialExam(exam.content, req.body.answers || {});
  const submission = await prisma.officialSubmission.create({
    data: {
      examId: exam.id,
      studentId: req.user.id,
      answers: req.body.answers || {},
      score: result.total,
      status: result.needsManualGrading ? 'IN_REVIEW' : 'CORRECTED',
      aiSuggestion: JSON.stringify(result.criteria)
    }
  });

  await awardXp(req.user.id, XP_QUIZ, 'OFFICIAL_EXAM', exam.title);
  await registerDailyActivity(req.user.id);
  const newBadges = await checkBadges(req.user.id);

  res.status(201).json({ ...submission, result, newBadges });
}));

export default router;
