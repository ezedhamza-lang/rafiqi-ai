import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, studentMiddleware } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getLessonPages, findGradeByLevel } from '../services/curriculumService.js';
import { buildRecommendedSession } from '../services/adaptivePlanService.js';
import { getStudentLevel } from '../services/studentLevelService.js';
import { validateBody } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

const submitLessonSchema = z.object({
  lessonId: z.string().min(1),
  lessonTitle: z.string().optional(),
  answers: z.record(z.any()),
  files: z.array(z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    dataUrl: z.string().optional()
  })).optional()
});

const router = Router();

router.use(authMiddleware);

async function computeChallenge(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [lessonsDone, quizzesDone, gamesPlayed] = await Promise.all([
    prisma.lessonProgress.count({ where: { userId, completedAt: { gte: today, lt: tomorrow } } }),
    prisma.submission.count({ where: { studentId: userId, createdAt: { gte: today, lt: tomorrow } } }),
    prisma.gameResult.count({ where: { studentId: userId, playedAt: { gte: today, lt: tomorrow } } })
  ]);

  const goals = [
    { key: 'lesson', label: 'أُنجز درساً تفاعلياً واحداً', target: 1, done: Math.min(lessonsDone, 1) },
    { key: 'questions', label: 'أجب على 3 أسئلة على الأقل', target: 3, done: Math.min(quizzesDone * 3, 3) },
    { key: 'game', label: 'العب جولة واحدة', target: 1, done: Math.min(gamesPlayed, 1) }
  ];
  const completed = goals.every((g) => g.done >= g.target);
  return { date: today.toISOString().slice(0, 10), goals, completed, xpReward: completed ? 15 : 0 };
}

/**
 * @openapi
 * /api/student/flashcards:
 *   get:
 *     summary: بطاقات مراجعة سريعة (تُستخرج حتماً من بلوكات الدروس الحقيقية)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gradeId
 *         schema: { type: string }
 *       - in: query
 *         name: subjectId
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 40 }
 *     responses:
 *       200:
 *         description: بطاقات (سؤال/جواب) من المحتوى الحقيقي
 */
router.get('/flashcards', studentMiddleware, asyncHandler(async (req, res) => {
  const { gradeId, subjectId } = req.query;
  if (!subjectId) return res.status(400).json({ error: 'معرف المادة مطلوب' });

  const level = await getStudentLevel(req.user.id);
  const ownGradeId = level ? findGradeByLevel(level)?.id || null : null;
  if (gradeId && ownGradeId && gradeId !== ownGradeId) {
    return res.status(403).json({ error: 'لا يمكنك تصفح محتوى مستوى آخر' });
  }
  const effectiveGrade = gradeId || ownGradeId;
  if (!effectiveGrade) return res.status(400).json({ error: 'معرف السنة مطلوب' });

  const pages = getLessonPages(subjectId, null, effectiveGrade, 'TN');
  const cards = [];
  const limit = Math.min(Number(req.query.limit) || 20, 40);

  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (cards.length >= limit) break;
      if (block.kind === 'definition' && block.text) {
        cards.push({ id: `c-${page.id}-d-${cards.length}`, front: block.title || 'معلومة', back: block.text, lesson: page.title, kind: 'concept' });
      } else if (block.kind === 'keyword' && block.text) {
        cards.push({ id: `c-${page.id}-k-${cards.length}`, front: 'كلمة اليوم', back: block.text, lesson: page.title, kind: 'vocab' });
      } else if (block.kind === 'question' && block.options && block.options.length) {
        const answer = typeof block.answer === 'number' ? block.options[block.answer] : (block.options[0] ?? '');
        cards.push({
          id: `c-${page.id}-q-${cards.length}`,
          front: block.text,
          back: answer,
          lesson: page.title,
          kind: 'question'
        });
      }
    }
    if (cards.length >= limit) break;
  }

  res.json({ gradeId: effectiveGrade, subjectId, total: cards.length, cards });
}));

/**
 * @openapi
 * /api/student/challenge/today:
 *   get:
 *     summary: تحدي اليوم (أهداف محسوبة من سجلات حقيقية: درس + أسئلة + لعبة)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: حالة التحدي اليومي
 */
router.get('/challenge/today', studentMiddleware, asyncHandler(async (req, res) => {
  res.json(await computeChallenge(req.user.id));
}));

/**
 * @openapi
 * /api/student/daily-routine:
 *   get:
 *     summary: روتين اليوم الموحّد (واجبات مستحقة + مراجعات مستحقة + درس مقترح + تحدي)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: خطة اليوم
 */
router.get('/daily-routine', studentMiddleware, asyncHandler(async (req, res) => {
  const me = await prisma.student.findFirst({
    where: { accountUserId: req.user.id },
    include: { class: true }
  });
  if (!me) return res.status(404).json({ error: 'سجل التلميذ غير موجود' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [assignments, dueReviews, challenge, plan] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        status: 'PUBLISHED',
        classId: me.classId ?? -1,
        dueDate: { gte: today },
        submissions: { none: { studentId: me.id } }
      },
      orderBy: { dueDate: 'asc' },
      take: 5
    }),
    prisma.adaptiveCard.count({
      where: { userId: req.user.id, dueAt: { lte: new Date() } }
    }),
    computeChallenge(req.user.id),
    buildRecommendedSession(req.user.id).catch(() => null)
  ]);

  res.json({
    pendingAssignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      subject: a.subject,
      dueDate: a.dueDate,
      questionsCount: Array.isArray(a.questions) ? a.questions.length : 0
    })),
    dueReviews,
    challenge,
    recommended: plan
      ? {
          gradeId: plan.gradeId,
          subjectId: plan.subjectId,
          subjectTitle: plan.subjectTitle,
          lessonTitle: plan.lessonTitle,
          exerciseCount: plan.session?.length || 0
        }
      : null
  });
}));

export default router;

/**
 * @openapi
 * /api/student/lesson/submit:
 *   post:
 *     summary: إرسال إجابات الدرس التفاعلي للمعلم
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonId, answers]
 *             properties:
 *               lessonId:
 *                 type: string
 *               lessonTitle:
 *                 type: string
 *               answers:
 *                 type: object
 *               files:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     type:
 *                       type: string
 *                     dataUrl:
 *                       type: string
 *     responses:
 *       201:
 *         description: تم الإرسال بنجاح
 *       400:
 *         description: بيانات ناقصة
 *       401:
 *         description: غير مصرح
 */
router.post('/lesson/submit', studentMiddleware, validateBody(submitLessonSchema), asyncHandler(async (req, res) => {
  const { lessonId, lessonTitle, answers, files } = req.body;

  const submission = await prisma.lessonSubmission.create({
    data: {
      userId: req.user.id,
      lessonId,
      lessonTitle,
      answers,
      files: files || null,
      status: 'SUBMITTED',
      submittedAt: new Date()
    }
  });

  // Notify teacher if lesson is linked to a class
  const student = await prisma.student.findFirst({ where: { accountUserId: req.user.id }, select: { classId: true } });
  if (student?.classId) {
    const classTeacher = await prisma.class.findUnique({ where: { id: student.classId }, select: { teacherId: true } });
    if (classTeacher?.teacherId) {
      await prisma.notification.create({
        data: {
          userId: classTeacher.teacherId,
          type: 'LESSON_SUBMITTED',
          title: 'إرسال واجب جديد',
          message: `أرسل تلميذ إجابات درس: ${req.body.lessonTitle || 'بدون عنوان'}`,
          data: { submissionId: submission.id, lessonId: req.body.lessonId }
        }
      });
    }
  }

  res.status(201).json({ ok: true, submissionId: submission.id, message: 'تم إرسال إجاباتك للمعلم بنجاح' });
}));

export default router;