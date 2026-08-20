import prisma from '../db.js';

export const XP_QUIZ = 10;
export const XP_LESSON = 5;
export const XP_DAILY = 2;
export const XP_GAME = 3;
export const LEVEL_XP = 100;

export function levelFromXp(xp) {
  return Math.floor(xp / LEVEL_XP) + 1;
}

export function normalizeText(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

export async function awardXp(studentId, points, type, detail = null) {
  const user = await prisma.user.update({
    where: { id: studentId },
    data: { xp: { increment: points }, coins: { increment: points } }
  });
  await prisma.activityLog.create({
    data: { studentId, type, points, detail }
  });
  const newLevel = levelFromXp(user.xp);
  const leveledUp = newLevel > user.level;
  if (leveledUp) {
    await prisma.user.update({ where: { id: studentId }, data: { level: newLevel } });
  }
  return { xp: user.xp, coins: user.coins, level: newLevel, leveledUp };
}

export async function checkBadges(studentId) {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    include: {
      badges: true,
      _count: { select: { submissions: true } }
    }
  });
  if (!user) return [];

  const badges = await prisma.badge.findMany();
  const earnedKeys = new Set(user.badges.map((b) => b.badgeId));
  const newEarned = [];

  for (const badge of badges) {
    if (earnedKeys.has(badge.id)) continue;
    const c = badge.condition;
    let satisfied = false;
    switch (c.type) {
      case 'QUIZ_COUNT':
        satisfied = user._count.submissions >= Number(c.value);
        break;
      case 'XP_TOTAL':
        satisfied = user.xp >= Number(c.value);
        break;
      case 'PERFECT_SCORE': {
        const perfect = await prisma.submission.count({
          where: { studentId, score: { equals: prisma.submission.fields.totalPoints } }
        });
        satisfied = perfect >= Number(c.value);
        break;
      }
      case 'STREAK_DAYS':
        satisfied = user.streakDays >= Number(c.value);
        break;
      case 'LESSONS_COMPLETED': {
        const done = await prisma.lessonProgress.count({ where: { userId: studentId } });
        satisfied = done >= Number(c.value);
        break;
      }
      default:
        satisfied = false;
    }
    if (satisfied) {
      await prisma.studentBadge.create({ data: { studentId, badgeId: badge.id } });
      newEarned.push(badge);
    }
  }
  return newEarned;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function registerDailyActivity(studentId) {
  const user = await prisma.user.findUnique({ where: { id: studentId } });
  if (!user) return;
  const todayStart = startOfDay(new Date());
  const lastActiveStart = user.updatedAt ? startOfDay(new Date(user.updatedAt)) : null;
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  let streak = 1;
  if (lastActiveStart && lastActiveStart.getTime() === todayStart.getTime()) {
    streak = user.streakDays || 1;
  } else if (lastActiveStart && lastActiveStart.getTime() === yesterdayStart.getTime()) {
    streak = (user.streakDays || 0) + 1;
  }
  await prisma.user.update({
    where: { id: studentId },
    data: {
      streakDays: streak,
      updatedAt: new Date()
    }
  });
}
