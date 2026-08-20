import prisma from '../db.js';
import { awardXp, checkBadges, registerDailyActivity, XP_LESSON } from './gamificationService.js';

// Mark a lesson as completed (idempotent). First completion awards XP and
// checks for newly earned badges (المرحلة 6.6).
export async function completeLesson(userId, { gradeId, subjectId, lessonId, lessonTitle = null }) {
  const where = { userId_gradeId_subjectId_lessonId: { userId, gradeId, subjectId, lessonId } };
  const existing = await prisma.lessonProgress.findUnique({ where });

  if (existing) {
    return {
      progress: existing,
      alreadyDone: true,
      xpAwarded: 0,
      newBadges: []
    };
  }

  const progress = await prisma.lessonProgress.create({
    data: {
      userId,
      gradeId,
      subjectId,
      lessonId,
      lessonTitle: lessonTitle ? String(lessonTitle).slice(0, 200) : null
    }
  });

  const gained = await awardXp(userId, XP_LESSON, 'LESSON', lessonTitle || lessonId);
  await registerDailyActivity(userId);
  const newBadges = await checkBadges(userId);

  return {
    progress,
    alreadyDone: false,
    xpAwarded: XP_LESSON,
    xp: gained.xp,
    level: gained.level,
    leveledUp: gained.leveledUp,
    newBadges
  };
}

export async function getProgress(userId, gradeId, subjectId) {
  const where = { userId };
  if (gradeId) where.gradeId = gradeId;
  if (subjectId) where.subjectId = subjectId;

  const rows = await prisma.lessonProgress.findMany({
    where,
    orderBy: { completedAt: 'desc' }
  });

  const bySubject = {};
  for (const r of rows) {
    const key = `${r.gradeId}/${r.subjectId}`;
    bySubject[key] = (bySubject[key] || 0) + 1;
  }

  return {
    total: rows.length,
    lessons: rows.map((r) => ({
      gradeId: r.gradeId,
      subjectId: r.subjectId,
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle,
      completedAt: r.completedAt
    })),
    bySubject: Object.entries(bySubject).map(([key, count]) => {
      const [g, s] = key.split('/');
      return { gradeId: g, subjectId: s, count };
    })
  };
}

export async function countLessonsCompleted(userId) {
  return prisma.lessonProgress.count({ where: { userId } });
}
