import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware, teacherMiddleware);

/**
 * @openapi
 * /api/teacher/gradebook:
 *   get:
 *     summary: دفتر درجات القسم (تلاميذ × تكليفات/اختبارات + معدلات)
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: دفتر الدرجات
 */
router.get('/gradebook', asyncHandler(async (req, res) => {
  const classId = Number(req.query.classId);
  if (!classId) return res.status(400).json({ error: 'معرف القسم مطلوب' });

  const klass = await prisma.class.findUnique({ where: { id: classId } });
  if (!klass) return res.status(404).json({ error: 'القسم غير موجود' });
  if (klass.teacherId !== req.user.id && !['ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'لست أستاذ هذا القسم' });
  }

  const [students, assignments, quizzes] = await Promise.all([
    prisma.student.findMany({
      where: { classId },
      include: { account: { select: { firstName: true, lastName: true } } },
      orderBy: { id: 'asc' }
    }),
    prisma.assignment.findMany({
      where: { classId, status: 'PUBLISHED' },
      include: { submissions: { select: { studentId: true, score: true, totalPoints: true, graded: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.quiz.findMany({
      where: { classId },
      include: { submissions: { select: { studentId: true, score: true, totalPoints: true } } },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const items = [
    ...assignments.map((a) => ({ id: `a${a.id}`, type: 'assignment', title: a.title, max: 100 })),
    ...quizzes.map((q) => ({ id: `q${q.id}`, type: 'quiz', title: q.title, max: 100 }))
  ];

  const rows = students.map((s) => {
    const cell = (item) => {
      const subs = item.type === 'assignment'
        ? assignments.find((a) => `a${a.id}` === item.id)?.submissions || []
        : quizzes.find((q) => `q${q.id}` === item.id)?.submissions || [];
      // `Submission.studentId` and `AssignmentSubmission.studentId` are foreign keys to
      // User.id, so they must be matched against the student's account id — not the
      // Student row id. Matching on `s.id` made every gradebook cell empty (ISS-009).
      const sub = subs.find((x) => x.studentId === s.accountUserId);
      if (!sub) return null;
      if (item.type === 'assignment' && sub.graded === false) return null;
      return sub.totalPoints ? Math.round((sub.score / sub.totalPoints) * 100) : sub.score;
    };
    // Keep one slot per item (null when the student has no grade) so the table and
    // the CSV export line up with `items` by index. Filtering the nulls out would
    // shift every later grade one column to the left.
    const grades = items.map(cell);
    const scored = grades.filter((g) => g !== null && g !== undefined);
    return {
      studentId: s.id,
      name: s.account ? `${s.account.firstName} ${s.account.lastName}` : `${s.firstName} ${s.lastName}`,
      grades,
      average: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null
    };
  });

  res.json({ classId, studentsCount: students.length, items, rows });
}));

/**
 * @openapi
 * /api/teacher/lesson-progress:
 *   get:
 *     summary: تقدم الدروس التفاعلية لقسم (من أنهى أي درس من مادة الأستاذ)
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ملخص إتمام الدروس
 */
router.get('/lesson-progress', asyncHandler(async (req, res) => {
  const classId = Number(req.query.classId);
  if (!classId) return res.status(400).json({ error: 'معرف القسم مطلوب' });

  const klass = await prisma.class.findUnique({ where: { id: classId } });
  if (!klass) return res.status(404).json({ error: 'القسم غير موجود' });
  if (klass.teacherId !== req.user.id && !['ADMIN', 'SCHOOL_DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'لست أستاذ هذا القسم' });
  }

  const [students, progress] = await Promise.all([
    prisma.student.findMany({ where: { classId }, select: { id: true, accountUserId: true } }),
    prisma.lessonProgress.findMany({
      where: { user: { student: { some: { classId } } } },
      select: { userId: true, gradeId: true, subjectId: true, lessonId: true, lessonTitle: true, completedAt: true }
    })
  ]);

  const bySubject = {};
  for (const p of progress) {
    const key = `${p.subjectId}`;
    if (!bySubject[key]) bySubject[key] = { subjectId: p.subjectId, lessons: {}, total: 0 };
    if (!bySubject[key].lessons[p.lessonId]) {
      bySubject[key].lessons[p.lessonId] = { lessonId: p.lessonId, lessonTitle: p.lessonTitle || p.lessonId, count: 0 };
    }
    bySubject[key].lessons[p.lessonId].count += 1;
    bySubject[key].total += 1;
  }

  res.json({
    classId,
    studentsCount: students.length,
    subjects: Object.values(bySubject).map((s) => ({
      subjectId: s.subjectId,
      totalCompletions: s.total,
      lessons: Object.values(s.lessons).sort((a, b) => b.count - a.count).slice(0, 30)
    }))
  });
}));

export default router;