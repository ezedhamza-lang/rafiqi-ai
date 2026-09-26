/**
 * Knowledge Garden Adventure API — مغامرة رفيقي – حديقة المعرفة
 *
 * All routes require an authenticated student session.
 * Every reward number is computed server-side from counters the client reports.
 */
import { Router } from 'express';
import prisma from '../db.js';
import { authMiddleware, studentMiddleware } from '../auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import {
  levelResultSchema, dailyResultSchema, appearanceSchema
} from '../validators/knowledgeGarden.js';
import { awardXp, registerDailyActivity } from '../services/gamificationService.js';
import {
  LEVELS, LEVELS_BY_ID, WORLD_ORDER, MASTERY_THRESHOLD,
  ECONOMY, COSMETIC_RULES, BOSSES, applySkillUpdate, computeScore,
  statusFor, stageFor, worldProgress, evaluateUnlocks, evaluateBadges,
  practiceQueue, STATUS_AR
} from '../services/knowledgeGardenService.js';

const router = Router();
router.use(authMiddleware, studentMiddleware);

export const DEFAULT_APPEARANCE = {
  cap: 'graduation', glasses: 'round', backpack: 'none',
  book: 'none', trail: 'none', jump: 'puff'
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Fetch (or lazily create) the student's game profile. */
async function getOrCreateProfile(userId) {
  const found = await prisma.gardenProfile.findUnique({ where: { userId } });
  if (found) return found;
  return prisma.gardenProfile.create({ data: { userId } });
}

function levelResultMap(rows) {
  const map = {};
  for (const r of rows) {
    map[r.levelId] = {
      stars: r.stars,
      bestScore: r.bestScore,
      bestTimeSec: r.bestTimeSec,
      accuracy: r.bestAccuracy,
      plays: r.plays
    };
  }
  return map;
}

function completedOrdersFrom(map) {
  const orders = new Set();
  for (const [id, v] of Object.entries(map)) {
    if ((v?.stars ?? 0) <= 0) continue;
    const order = LEVELS_BY_ID.get(id)?.order ?? 0;
    if (order > 0) orders.add(order);
  }
  return orders;
}

function shapeSkill(row) {
  const status = statusFor(row.mastery);
  const stage = stageFor(row.mastery);
  return {
    skillId: row.skillId,
    skillType: row.skillType,
    label: row.label,
    mastery: row.mastery,
    stage: stage.key,
    stageAr: stage.ar,
    status,
    statusAr: STATUS_AR[status],
    attempts: row.attempts,
    correct: row.correct,
    streak: row.streak,
    needsPractice: row.needsPractice
  };
}

/** Persist per-skill counters and return the updated rows. */
async function recordSkills(userId, entries) {
  const touched = [];
  for (const entry of entries) {
    const existing = await prisma.gardenSkill.findUnique({
      where: { userId_skillId: { userId, skillId: entry.skillId } }
    });
    let state = existing || { mastery: 0, attempts: 0, correct: 0, streak: 0 };

    // Replay the run item by item so the mastery curve reflects real behaviour.
    for (let i = 0; i < entry.wrong; i++) {
      state = { ...state, ...applySkillUpdate(state, false) };
    }
    for (let i = 0; i < entry.correct; i++) {
      state = { ...state, ...applySkillUpdate(state, true) };
    }

    const row = await prisma.gardenSkill.upsert({
      where: { userId_skillId: { userId, skillId: entry.skillId } },
      create: {
        userId,
        skillId: entry.skillId,
        skillType: entry.skillType,
        label: entry.label,
        mastery: state.mastery,
        attempts: state.attempts,
        correct: state.correct,
        streak: state.streak,
        needsPractice: state.needsPractice
      },
      update: {
        skillType: entry.skillType,
        label: entry.label,
        mastery: state.mastery,
        attempts: state.attempts,
        correct: state.correct,
        streak: state.streak,
        needsPractice: state.needsPractice
      }
    });
    touched.push(row);
  }
  return touched;
}

// ---------------------------------------------------------------------------
// GET /api/games/knowledge-garden/state
// The complete, authoritative save for the student.
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/games/knowledge-garden/state:
 *   get:
 *     summary: حالة لعبة حديقة المعرفة (نجوم، مهارات، شارات، مفاتيح)
 *     tags: [knowledge-garden]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: حالة اللعب المحفوظة على الخادم
 */
router.get('/state', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [profile, levelRows, skillRows, badges, daily, rewards] = await Promise.all([
    getOrCreateProfile(userId),
    prisma.gardenLevelResult.findMany({ where: { userId } }),
    prisma.gardenSkill.findMany({ where: { userId }, orderBy: { mastery: 'desc' } }),
    prisma.gardenBadge.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
    prisma.gardenDaily.findMany({ where: { userId }, orderBy: { dayKey: 'desc' }, take: 14 }),
    prisma.gardenReward.findMany({ where: { userId } })
  ]);

  const results = levelResultMap(levelRows);
  const completedOrders = completedOrdersFrom(results);
  const worlds = WORLD_ORDER.map((w) => worldProgress(results, w));
  const skills = skillRows.map(shapeSkill);
  const bestStreak = skills.reduce((max, s) => Math.max(max, s.streak), 0);

  const levels = LEVELS.map((l) => ({
    ...l,
    stars: results[l.id]?.stars ?? 0,
    bestScore: results[l.id]?.bestScore ?? 0,
    bestTimeSec: results[l.id]?.bestTimeSec ?? 0,
    unlocked: l.order === 1 || completedOrders.has(l.order - 1) || (results[l.id]?.stars ?? 0) > 0
  }));

  res.json({
    profile: {
      stars: profile.stars,
      gems: profile.gems,
      keys: profile.keys,
      currentWorldId: profile.currentWorldId,
      currentLevelId: profile.currentLevelId,
      appearance: profile.appearance,
      unlocked: profile.unlocked,
      totalCorrect: profile.totalCorrect,
      totalMistakes: profile.totalMistakes,
      bestScore: profile.bestScore,
      dailyStreak: profile.dailyStreak,
      lastDailyDay: profile.lastDailyDay,
      bestStreak
    },
    levels,
    worlds,
    skills,
    // Weakest skills first — the client injects extra practice for these.
    practiceQueue: practiceQueue(
      skills.filter((s) => s.needsPractice).sort((a, b) => a.mastery - b.mastery).map((s) => s.skillId)
    ),
    badges: badges.map((b) => ({ key: b.badgeKey, name: b.name, icon: b.icon, earnedAt: b.earnedAt })),
    daily: daily.map((d) => ({
      dayKey: d.dayKey,
      correct: d.correct,
      total: d.total,
      stars: d.starsAwarded,
      gems: d.gemsAwarded,
      completedAt: d.completedAt
    })),
    rewards: rewards.map((r) => ({ key: r.rewardKey, kind: r.kind, sourceId: r.sourceId })),
    cosmetics: COSMETIC_RULES.map((c) => ({ ...c, unlocked: !!profile.unlocked?.[c.key] })),
    bosses: BOSSES
  });
}));

// ---------------------------------------------------------------------------
// GET /api/games/knowledge-garden/level/:id — adaptivity brief for one level
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/games/knowledge-garden/level/{id}:
 *   get:
 *     summary: تعليمات التكيّف لمرحلة واحدة (تدريب إضافي، تلميحات، وقت)
 *     tags: [knowledge-garden]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: وصف المرحلة مع المهارات الضعيفة
 */
router.get('/level/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const level = LEVELS_BY_ID.get(req.params.id);
  if (!level) throw new ApiError(404, 'المرحلة غير موجودة');

  const [levelRows, weakSkills] = await Promise.all([
    prisma.gardenLevelResult.findMany({ where: { userId } }),
    prisma.gardenSkill.findMany({ where: { userId, needsPractice: true }, orderBy: { mastery: 'asc' } })
  ]);
  const results = levelResultMap(levelRows);
  const completedOrders = completedOrdersFrom(results);

  if (level.order > 1 && !completedOrders.has(level.order - 1) && (results[level.id]?.stars ?? 0) === 0) {
    throw new ApiError(403, 'هذه المرحلة مقفلة — أكمل المرحلة السابقة أولاً');
  }

  res.json({
    level,
    // Adaptive brief: extra practice for weak skills, hints for hard worlds.
    practiceSkills: weakSkills.slice(0, 3).map(shapeSkill),
    allowHints: level.tier !== 'VERY_EASY',
    // Timers only appear from the Challenge Valley onwards, and generously.
    timeLimitSec: level.worldIndex >= 4 ? Math.max(15, Math.round(level.parTimeSec / 2)) : null,
    previousBest: results[level.id] ?? null
  });
}));

// ---------------------------------------------------------------------------
// POST /api/games/knowledge-garden/level-result
// The client posts counters. The server decides every reward.
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/games/knowledge-garden/level-result:
 *   post:
 *     summary: إرسال نتيجة مرحلة (النقاط والنجوم تُحسب على الخادم)
 *     tags: [knowledge-garden]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [levelId, worldId, correct, total]
 *             properties:
 *               levelId: { type: string, example: "w1-l1" }
 *               worldId: { type: string, example: "letters-garden" }
 *               correct: { type: integer }
 *               wrong: { type: integer }
 *               total: { type: integer }
 *               timeSec: { type: integer }
 *               bestStreak: { type: integer }
 *               hintsUsed: { type: integer }
 *               skills: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: النتيجة المعتمدة والمكافآت
 */
router.post('/level-result', validateBody(levelResultSchema), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { levelId, worldId, correct, wrong, total, timeSec, bestStreak, hintsUsed, skills } = req.body;

  const level = LEVELS_BY_ID.get(levelId);
  if (!level) throw new ApiError(404, 'المرحلة غير موجودة');
  if (level.worldId !== worldId) throw new ApiError(400, 'المرحلة لا تنتمي إلى هذا العالم');

  const [existingRows] = await Promise.all([
    prisma.gardenLevelResult.findMany({ where: { userId } })
  ]);
  const results = levelResultMap(existingRows);
  const completedOrders = completedOrdersFrom(results);

  // Locked-level guard: the client cannot farm rewards by replaying stage 5.
  if (level.order > 1 && !completedOrders.has(level.order - 1) && (results[levelId]?.stars ?? 0) === 0) {
    throw new ApiError(403, 'هذه المرحلة مقفلة — أكمل المرحلة السابقة أولاً');
  }

  // Trust the server's own challenge count, bounded by what the client claims.
  const challengeTotal = level.challengeCount;
  const safeTotal = Math.min(Math.max(1, total | 0), challengeTotal + 4); // + adaptive practice items
  const safeWrong = Math.max(0, wrong | 0);

  // The single source of truth for score / stars / gems.
  const scored = computeScore({
    correct, total: safeTotal, streak: bestStreak, hints: hintsUsed
  });

  const previous = results[levelId];
  const isFirstClear = (previous?.stars ?? 0) === 0;
  const newStars = Math.max(previous?.stars ?? 0, scored.stars);
  const starDelta = newStars - (previous?.stars ?? 0);

  // Rewards are granted only for genuinely new stars — replays still train.
  const gemsAwarded = isFirstClear ? scored.gems : starDelta * ECONOMY.gemsPerStar;
  const keysAwarded = level.isBoss && isFirstClear ? ECONOMY.keysPerBoss : 0;

  const row = await prisma.gardenLevelResult.upsert({
    where: { userId_levelId: { userId, levelId } },
    create: {
      userId, levelId, worldId, isBoss: level.isBoss,
      bestScore: scored.score, stars: scored.stars,
      bestTimeSec: timeSec, bestAccuracy: scored.accuracyPercent,
      attempts: 1, plays: 1,
      mastered: skills.filter((s) => s.correct > 0).map((s) => s.skillId)
    },
    update: {
      bestScore: Math.max(previous?.bestScore ?? 0, scored.score),
      stars: newStars,
      bestTimeSec: previous?.bestTimeSec ? Math.min(previous.bestTimeSec, timeSec || 9999) : timeSec,
      bestAccuracy: Math.max(previous?.accuracy ?? 0, scored.accuracyPercent),
      plays: { increment: 1 },
      mastered: skills.filter((s) => s.correct > 0).map((s) => s.skillId)
    }
  });

  // Skills evolve from the raw per-skill counters.
  const skillRows = await recordSkills(userId, skills);

  const profileAfter = await prisma.gardenProfile.upsert({
    where: { userId },
    create: { userId },
    update: {
      stars: { increment: starDelta },
      gems: { increment: gemsAwarded },
      keys: { increment: keysAwarded },
      totalCorrect: { increment: Math.min(correct | 0, challengeTotal) },
      totalMistakes: { increment: Math.min(safeWrong, 400) },
      currentWorldId: worldId,
      currentLevelId: levelId,
      updatedAt: new Date()
    }
  });

  // Keep bestScore as a genuine maximum (no additive drift between replays).
  await prisma.gardenProfile.updateMany({
    where: { userId, bestScore: { lt: scored.score } },
    data: { bestScore: scored.score }
  });

  // Cosmetics + badges unlocked by this very run.
  const allRows = await prisma.gardenLevelResult.findMany({ where: { userId } });
  const resultsAfter = levelResultMap(allRows);
  const worldsAfter = WORLD_ORDER.map((w) => worldProgress(resultsAfter, w));
  const grantedCosmetics = evaluateUnlocks({
    stars: profileAfter.stars,
    mastered: skillRows.filter((s) => s.mastery >= MASTERY_THRESHOLD).length,
    worldsCleared: worldsAfter.filter((w) => w.percent === 100).length,
    bestStreak,
    unlocked: profileAfter.unlocked || {}
  });

  if (grantedCosmetics.length) {
    const unlockedMap = { ...(profileAfter.unlocked || {}) };
    for (const c of grantedCosmetics) unlockedMap[c.key] = new Date().toISOString();
    await prisma.gardenProfile.update({ where: { userId }, data: { unlocked: unlockedMap } });
    for (const c of grantedCosmetics) {
      await prisma.gardenReward.upsert({
        where: { userId_rewardKey: { userId, rewardKey: c.key } },
        create: { userId, rewardKey: c.key, kind: c.kind, sourceId: levelId },
        update: {}
      });
    }
  }

  const stats = {
    completedLevels: allRows.filter((r) => r.stars > 0).length,
    masteredLetters: skillRows.filter((s) => s.skillType === 'LETTER' && s.mastery >= MASTERY_THRESHOLD).length,
    masteredWords: skillRows.filter((s) => s.skillType === 'WORD' && s.mastery >= MASTERY_THRESHOLD).length,
    bestStreak,
    bossesCleared: allRows.filter((r) => r.isBoss && r.stars > 0).length,
    worldsCleared: worldsAfter.filter((w) => w.percent === 100).length,
    stars: profileAfter.stars
  };
  const existingBadges = await prisma.gardenBadge.findMany({ where: { userId } });
  const already = new Set(existingBadges.map((b) => b.badgeKey));
  const grantedBadges = evaluateBadges(stats).filter((b) => !already.has(b.key));
  for (const b of grantedBadges) {
    await prisma.gardenBadge.upsert({
      where: { userId_badgeKey: { userId, badgeKey: b.key } },
      create: { userId, badgeKey: b.key, name: b.name, icon: b.icon },
      update: {}
    });
  }

  // Platform XP + daily streak (shared with the rest of Rafiqi).
  const xpGain = ECONOMY.xpPerLevel + scored.stars * ECONOMY.xpPerStar;
  const [xpResult] = await Promise.all([
    awardXp(userId, xpGain, 'KNOWLEDGE_GAME', `حديقة المعرفة · ${levelId}`),
    registerDailyActivity(userId)
  ]);

  res.json({
    result: {
      levelId,
      worldId,
      score: row.bestScore,
      stars: newStars,
      accuracyPercent: scored.accuracyPercent,
      correct: Math.min(correct | 0, challengeTotal),
      wrong: safeWrong,
      timeSec,
      total: safeTotal,
      mastered: skillRows.filter((s) => s.mastery >= MASTERY_THRESHOLD).map((s) => s.skillId)
    },
    rewards: {
      stars: starDelta,
      gems: gemsAwarded,
      keys: keysAwarded,
      xp: xpGain,
      level: xpResult?.level ?? null,
      leveledUp: xpResult?.leveledUp ?? false
    },
    unlockedCosmetics: grantedCosmetics,
    newBadges: grantedBadges,
    skills: skillRows.map(shapeSkill),
    // Extra practice for next time — automatic, never punitive.
    practiceQueue: practiceQueue(
      skillRows.filter((s) => s.needsPractice).sort((a, b) => a.mastery - b.mastery).map((s) => s.skillId)
    ),
    nextLevelId: LEVELS.find((l) => l.order === level.order + 1)?.id ?? null
  });
}));

// ---------------------------------------------------------------------------
// POST /api/games/knowledge-garden/daily — تحدي اليوم
// One completion per day; the date key is server-validated.
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/games/knowledge-garden/daily:
 *   post:
 *     summary: تسجيل نتيجة تحدي اليوم (مرة واحدة يومياً)
 *     tags: [knowledge-garden]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: مكافآت تحدي اليوم
 */
router.post('/daily', validateBody(dailyResultSchema), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { dayKey, correct, total, skills } = req.body;

  // The browser may not claim a different day than the server's own date.
  const now = new Date();
  const realDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dayKey !== realDay) throw new ApiError(400, 'تاريخ التحدي غير صالح');

  const already = await prisma.gardenDaily.findUnique({
    where: { userId_dayKey: { userId, dayKey } }
  });
  if (already) throw new ApiError(409, 'تم إكمال تحدي اليوم — عد غداً');

  const safeTotal = Math.max(1, Math.min(total | 0, 5));
  const safeCorrect = Math.max(0, Math.min(correct | 0, safeTotal));
  const accuracy = Math.round((safeCorrect / safeTotal) * 100);
  const starsAwarded = safeCorrect >= safeTotal ? 3 : safeCorrect >= 3 ? 2 : 1;
  const gemsAwarded = ECONOMY.dailyBonusGems + starsAwarded;

  const [daily] = await Promise.all([
    prisma.gardenDaily.create({
      data: { userId, dayKey, correct: safeCorrect, total: safeTotal, starsAwarded, gemsAwarded }
    }),
    prisma.gardenProfile.upsert({
      where: { userId },
      create: { userId },
      update: {
        gems: { increment: gemsAwarded },
        stars: { increment: ECONOMY.dailyBonusStars },
        // Consecutive-day counter behind the "🔥 days" motivation banner.
        dailyStreak: { increment: 1 },
        lastDailyDay: dayKey
      }
    })
  ]);

  await recordSkills(userId, skills);
  await awardXp(userId, 15, 'KNOWLEDGE_DAILY', 'تحدي اليوم · حديقة المعرفة');
  await registerDailyActivity(userId);

  res.json({
    dayKey: daily.dayKey,
    correct: safeCorrect,
    total: safeTotal,
    accuracyPercent: accuracy,
    stars: starsAwarded,
    gems: gemsAwarded
  });
}));

// ---------------------------------------------------------------------------
// PATCH /api/games/knowledge-garden/appearance — تخصيص البومة
// Only already-unlocked items may be equipped.
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/games/knowledge-garden/appearance:
 *   patch:
 *     summary: حفظ تخصيص شخصية البومة (القبعة، النظارة، الحقيبة...)
 *     tags: [knowledge-garden]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: التخصيص المعتمد
 */
router.patch('/appearance', validateBody(appearanceSchema), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await getOrCreateProfile(userId);
  const unlocked = profile.unlocked || {};
  const known = new Set(COSMETIC_RULES.map((c) => c.key));

  const requested = req.body.appearance;
  const accepted = {};
  for (const [kind, key] of Object.entries(requested)) {
    if (key === 'none' || DEFAULT_APPEARANCE[kind] === key) { accepted[kind] = key; continue; }
    // An item is equippable only if a real achievement granted it.
    if (known.has(`${kind}:${key}`) && unlocked[`${kind}:${key}`]) accepted[kind] = key;
  }

  const appearance = { ...DEFAULT_APPEARANCE, ...(profile.appearance || {}), ...accepted };
  const updated = await prisma.gardenProfile.update({
    where: { userId },
    data: { appearance },
    select: { appearance: true }
  });

  res.json({ appearance: updated.appearance });
}));

export default router;
