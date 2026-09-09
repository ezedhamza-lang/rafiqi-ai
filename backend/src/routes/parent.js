import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/parent/children/progress:
 *   get:
 *     summary: تقدم أبناء الولي
 *     tags: [parent]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تفاصيل التقدم لكل ابن
 */
router.get('/children/progress', asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: { userId: req.user.id },
    include: {
      account: true,
      class: { select: { id: true, name: true, teacherId: true } }
    }
  });

  const children = [];
  for (const s of students) {
    if (!s.accountUserId) {
      children.push({
        student: s,
        progress: null,
        error: 'لا يوجد حساب تلميذ مرتبط بعد'
      });
      continue;
    }
    const [badges, submissions, activities, paperExams, attendance] = await Promise.all([
      prisma.studentBadge.findMany({ where: { studentId: s.accountUserId }, include: { badge: true } }),
      prisma.submission.findMany({
        where: { studentId: s.accountUserId },
        include: { quiz: { select: { id: true, title: true, subject: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.activityLog.findMany({
        where: { studentId: s.accountUserId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.submittedExam.findMany({
        where: { studentId: s.accountUserId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.attendanceRecord.findMany({
        where: { studentId: s.accountUserId },
        orderBy: { date: 'desc' },
        take: 30
      })
    ]);

    const attendanceLast30 = attendance.filter((a) => new Date(a.date) >= new Date(Date.now() - 30 * 86400000));
    const absentCount = attendanceLast30.filter((a) => !a.present).length;

    const totalPoints = submissions.reduce((acc, x) => acc + (x.totalPoints || 0), 0);
    const earned = submissions.reduce((acc, x) => acc + x.score, 0);

    // الدقة هذا الأسبوع مقابل الأسبوع الماضي
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const thisWeek = submissions.filter((x) => new Date(x.createdAt) >= weekAgo);
    const lastWeek = submissions.filter((x) => new Date(x.createdAt) >= twoWeeksAgo && new Date(x.createdAt) < weekAgo);
    const calc = (list) => {
      const t = list.reduce((acc, x) => acc + (x.totalPoints || 0), 0);
      const e = list.reduce((acc, x) => acc + x.score, 0);
      return t ? Math.round((e / t) * 100) : 0;
    };

    children.push({
      student: s,
      progress: {
        xp: s.account.xp,
        coins: s.account.coins,
        level: s.account.level,
        streakDays: s.account.streakDays,
        quizzesDone: submissions.length,
        avgPercent: submissions.length ? Math.round(submissions.reduce((acc, x) => acc + (x.score / (x.totalPoints || 1)) * 100, 0) / submissions.length) : 0,
        totalPoints: earned,
        maxPoints: totalPoints,
        badges: badges.map((b) => b.badge),
        latestResults: submissions.slice(0, 5).map((x) => ({
          id: x.id,
          title: x.quiz.title,
          score: x.score,
          totalPoints: x.totalPoints,
          percent: x.totalPoints ? Math.round((x.score / x.totalPoints) * 100) : 0,
          date: x.createdAt
        })),
        activities,
        paperExams: paperExams.map((p) => ({
          id: p.id,
          examTitle: p.examTitle,
          subject: p.subject,
          status: p.status,
          score: p.score,
          feedback: p.feedback,
          fileUrl: p.fileUrl,
          date: p.createdAt
        })),
        weeklyAccuracy: calc(thisWeek),
        lastWeekAccuracy: calc(lastWeek),
        attendance: {
          last30Days: attendanceLast30.length,
          absent: absentCount,
          records: attendance.slice(0, 10).map((a) => ({ date: a.date, present: a.present, note: a.note }))
        },
        teacherId: s.class?.teacherId || null,
        teacher: null
      }
    });
  }

  // اجلب معلومات المعلمين
  const teacherIds = [...new Set(children.map((c) => c.progress?.teacherId).filter(Boolean))];
  const teachers = teacherIds.length
    ? await prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  children.forEach((c) => {
    if (c.progress?.teacherId) c.progress.teacher = teacherMap[c.progress.teacherId] || null;
  });

  res.json(children);
}));

/**
 * @swagger
 * /api/parent/teacher-list:
 *   get:
 *     summary: قائمة معلمي أبناء الولي
 *     tags: [parent]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة المعلمين
 */
/**
 * @swagger
 * /api/parent/children/credentials:
 *   get:
 *     summary: بيانات دخول الأبناء (البريد وكلمة السر) للولي
 *     tags: [parent]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة بيانات الأبناء
 */
router.get('/children/credentials', asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: { userId: req.user.id, tempPassword: { not: null } },
    include: { account: { select: { email: true } } },
    orderBy: { firstName: 'asc' }
  });
  res.json(students.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    level: s.level,
    email: s.account?.email || null,
    password: s.tempPassword
  })));
}));

router.get('/teacher-list', asyncHandler(async (req, res) => {
  const students = await prisma.student.findMany({
    where: { userId: req.user.id },
    include: { class: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } } }
  });
  const teachers = students.map((s) => s.class?.teacher).filter(Boolean);
  const unique = teachers.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);
  res.json(unique);
}));

export default router;
