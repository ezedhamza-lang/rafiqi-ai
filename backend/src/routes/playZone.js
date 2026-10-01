import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, studentMiddleware } from '../auth.js';
import { awardXp, checkBadges, registerDailyActivity, XP_GAME } from '../services/gamificationService.js';
import { validateBody } from '../middleware/validate.js';
import { gameResultSchema } from '../validators/playZone.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authMiddleware);

const VALID_GAMES = [
  'QUICK_MATH', 'WORD_BUILD', 'MEMORY',
  'SCIENCE_QUIZ', 'SCIENCE_CLASSIFY', 'EXPERIMENT_STEPS',
  'ARABIC_SCRAMBLE', 'SENTENCE_BUILDER', 'FRENCH_MATCH'
];
export const GAME_DAILY_LIMIT = 10;

const GAME_LABELS = {
  QUICK_MATH: 'الحساب السريع',
  WORD_BUILD: 'تركيب الكلمات',
  MEMORY: 'اختبار الذاكرة',
  SCIENCE_QUIZ: 'اختبار العلوم',
  SCIENCE_CLASSIFY: 'تصنيف العلوم',
  EXPERIMENT_STEPS: 'ترتيب التجربة',
  ARABIC_SCRAMBLE: 'تكعيب الكلمة',
  SENTENCE_BUILDER: 'صانع الجمل',
  FRENCH_MATCH: 'مطابقة الفرنسية'
};

function gameLabel(game) {
  return GAME_LABELS[game] || game;
}

function dayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * @swagger
 * /api/teacher/student/games:
 *   get:
 *     summary: سجل ألعاب التلميذ وحدوده اليومية
 *     tags: [play-zone]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: السجل والحدود
 */
router.get(
  '/student/games',
  studentMiddleware,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'STUDENT') throw new ApiError(403, 'هذا الفضاء مخصص للتلميذ');

    const today = dayStart();
    const [history, playedToday, bestScores] = await Promise.all([
      prisma.gameResult.findMany({
        where: { studentId: req.user.id },
        orderBy: { playedAt: 'desc' },
        take: 50
      }),
      prisma.gameResult.count({ where: { studentId: req.user.id, playedAt: { gte: today } } }),
      prisma.gameResult.groupBy({
        by: ['game'],
        where: { studentId: req.user.id },
        _max: { score: true },
        _count: { _all: true }
      })
    ]);

    res.json({
      history,
      remainingToday: Math.max(0, GAME_DAILY_LIMIT - playedToday),
      bestScores,
      dailyLimit: GAME_DAILY_LIMIT
    });
  })
);

/**
 * @swagger
 * /api/teacher/student/games:
 *   post:
 *     summary: تسجيل نتيجة لعبة
 *     tags: [play-zone]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [game]
 *             properties:
 *               game: { type: string, enum: [QUICK_MATH, WORD_BUILD, MEMORY, SCIENCE_QUIZ, SCIENCE_CLASSIFY, EXPERIMENT_STEPS, ARABIC_SCRAMBLE, SENTENCE_BUILDER, FRENCH_MATCH] }
 *               score: { type: integer }
 *               correct: { type: integer }
 *               total: { type: integer }
 *               durationSec: { type: integer }
 *     responses:
 *       201:
 *         description: تم تسجيل النتيجة
 *       400:
 *         description: فشل التحقق أو بلوغ الحد اليومي
 */
router.post(
  '/student/games',
  studentMiddleware,
  validateBody(gameResultSchema),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'STUDENT') throw new ApiError(403, 'هذا الفضاء مخصص للتلميذ');

    const { game, score, correct, total, durationSec } = req.body;
    if (!VALID_GAMES.includes(game)) throw new ApiError(400, 'لعبة غير صالحة');

    const today = dayStart();
    const playedToday = await prisma.gameResult.count({
      where: { studentId: req.user.id, playedAt: { gte: today } }
    });
    if (playedToday >= GAME_DAILY_LIMIT) {
      throw new ApiError(400, `بلغت الحد اليومي للألعاب (${GAME_DAILY_LIMIT} جولات)، عُد غدا للمتابعة`);
    }

    const result = await prisma.gameResult.create({
      data: {
        studentId: req.user.id,
        game,
        score: Math.max(0, Number(score) || 0),
        correct: Number(correct) || 0,
        total: Number(total) || 0,
        durationSec: durationSec ? Number(durationSec) : null
      }
    });

    const gained = await awardXp(req.user.id, XP_GAME, 'GAME', `${gameLabel(game)}: ${result.score} نقطة`);
    await registerDailyActivity(req.user.id);
    const newBadges = await checkBadges(req.user.id);

    res.status(201).json({
      result,
      gained,
      newBadges,
      remainingToday: Math.max(0, GAME_DAILY_LIMIT - (playedToday + 1))
    });
  })
);

/**
 * @swagger
 * /api/teacher/student/games/leaderboard:
 *   get:
 *     summary: لوحة ترتيب القسم
 *     tags: [play-zone]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: لوحة الترتيب
 */
router.get(
  '/student/games/leaderboard',
  studentMiddleware,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'STUDENT') throw new ApiError(403, 'هذا الفضاء مخصص للتلميذ');

    const studentRecord = await prisma.student.findFirst({
      where: { accountUserId: req.user.id },
      include: { class: { select: { id: true, name: true } } }
    });
    if (!studentRecord?.classId) return res.json({ class: null, leaderboard: [] });

    const classmates = await prisma.student.findMany({
      where: { classId: studentRecord.classId, accountUserId: { not: null } },
      select: { accountUserId: true }
    });
    const studentIds = classmates.map((c) => c.accountUserId);

    const grouped = await prisma.gameResult.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds } },
      _sum: { score: true },
      _count: { _all: true }
    });

    const users = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true }
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const leaderboard = grouped
      .map((g) => ({
        studentId: g.studentId,
        firstName: userMap[g.studentId]?.firstName || '—',
        lastName: userMap[g.studentId]?.lastName || '',
        totalScore: g._sum.score || 0,
        plays: g._count._all || 0
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((item, i) => ({ rank: i + 1, ...item }));

    res.json({ class: studentRecord.class, leaderboard });
  })
);

export default router;
