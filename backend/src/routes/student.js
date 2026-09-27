import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, studentMiddleware } from '../auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { countLessonsCompleted } from '../services/progressService.js';
import { findGradeByLevel } from '../services/curriculumService.js';
import { config } from '../config.js';

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /api/student/profile:
 *   get:
 *     summary: ملف التلميذ الكامل (نقاط، شارات، نشاط، إحصائيات)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الملف
 */
router.get('/profile', studentMiddleware, asyncHandler(async (req, res) => {
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
  const lessonsCompleted = await countLessonsCompleted(req.user.id);

  const exploreAll = config.exploreAllGradesEmails.includes(String(user.email || '').toLowerCase());

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
    canSeeAllGrades: exploreAll,
    gradeId: student?.class?.level ? findGradeByLevel(student.class.level)?.id || null : null,
    studentLevel: student?.level || null,
    badges: badges.map((b) => b.badge),
    activities,
    stats: {
      quizzesDone: submissions.length,
      accuracy,
      avgPercent,
      lessonsCompleted
    }
  });
}));

/**
 * @openapi
 * /api/student/leaderboard:
 *   get:
 *     summary: ترتيب قسم التلميذ الحقيقي (نقاط XP الفعلية)
 *     tags: [student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة مرتبة بزملاء القسم
 */
router.get('/leaderboard', studentMiddleware, asyncHandler(async (req, res) => {
  const me = await prisma.student.findFirst({
    where: { accountUserId: req.user.id },
    select: { classId: true }
  });

  const classmates = await prisma.student.findMany({
    where: { classId: me?.classId ?? -1, accountUserId: { not: null } },
    include: { account: { select: { firstName: true, lastName: true, xp: true, level: true, streakDays: true } } }
  });

  const rows = classmates
    .map((s) => ({
      id: s.accountUserId,
      name: `${s.account.firstName} ${s.account.lastName}`,
      points: s.account.xp,
      level: s.account.level,
      streak: s.account.streakDays || 0,
      avatar: (s.account.firstName || 'ط')[0],
      current: s.accountUserId === req.user.id
    }))
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  res.json({ classId: me?.classId ?? null, rows, total: rows.length, me: rows.find((r) => r.current)?.rank || null });
}));

router.get('/rewards', studentMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [user, allBadges, earnedBadges] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true, coins: true, level: true, streakDays: true } }),
    prisma.badge.findMany(),
    prisma.studentBadge.findMany({ where: { studentId: userId }, include: { badge: true } })
  ]);

  const earnedMap = new Map(earnedBadges.map(eb => [eb.badgeId, { earnedAt: eb.earnedAt }]));
  const LEVEL_XP = 100;

  const badges = allBadges.map(b => ({
    id: b.id,
    key: b.key,
    name: b.name,
    icon: b.icon,
    description: b.description,
    condition: b.condition,
    earned: earnedMap.has(b.id),
    earnedAt: earnedMap.get(b.id)?.earnedAt || null
  }));

  res.json({
    xp: user.xp,
    coins: user.coins,
    level: user.level,
    streakDays: user.streakDays,
    levelProgress: user.xp % LEVEL_XP,
    levelXp: LEVEL_XP,
    badges,
    totalEarned: earnedBadges.length,
    totalBadges: allBadges.length
  });
}));

export default router;
