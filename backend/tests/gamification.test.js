import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';
import {
  awardXp,
  checkBadges,
  registerDailyActivity,
  levelFromXp,
  XP_QUIZ
} from '../src/services/gamificationService.js';

let prisma;
let studentId;

describe('تقوية الألعاب (R2b)', () => {
  beforeAll(async () => {
    await import('../src/index.js');
    prisma = (await import('../src/db.js')).default;
    await resetDatabase();
    const { users } = await seedTestData();
    studentId = users.student.id;
  });

  it('awardXp يرقّي المستوى في اتجاه واحد فقط (لا خفض متزامن)', async () => {
    const r1 = await awardXp(studentId, 200, 'TEST');
    expect(r1.leveledUp).toBe(true);
    let u = await prisma.user.findUnique({ where: { id: studentId } });
    expect(u.level).toBe(levelFromXp(200));
    // دفعة أصغر لاحقاً لا تخفض المستوى
    const r2 = await awardXp(studentId, XP_QUIZ, 'TEST');
    expect(r2.leveledUp).toBe(false);
    u = await prisma.user.findUnique({ where: { id: studentId } });
    expect(u.level).toBe(levelFromXp(210));
    expect(u.xp).toBe(210);
  });

  it('دفعتان متزامنتان تعطيَان جمع xp ولا تخفضان المستوى', async () => {
    await prisma.user.update({ where: { id: studentId }, data: { xp: 0, level: 1 } });
    await Promise.all([awardXp(studentId, 100, 'TEST'), awardXp(studentId, 100, 'TEST')]);
    const u = await prisma.user.findUnique({ where: { id: studentId } });
    expect(u.xp).toBe(200);
    expect(u.level).toBe(levelFromXp(200));
  });

  it('checkBadges المتزامن لا يسقط بخطأ قيد فريد والأوسمة لا تتكرر', async () => {
    const badge = await prisma.badge.create({
      data: {
        key: `r2b-${Date.now()}`,
        name: 'وسام الاختبار',
        icon: 'military_tech',
        description: 'اختبار السلامة',
        condition: { type: 'XP_TOTAL', value: 1 }
      }
    });
    const [a, b] = await Promise.all([checkBadges(studentId), checkBadges(studentId)]);
    const rows = await prisma.studentBadge.count({ where: { badgeId: badge.id } });
    expect(rows).toBe(1);
    expect(a.length + b.length).toBe(1); // أحدهما فقط يرى الوسام "جديداً"
  });

  it('registerDailyActivity: مرة واحدة في اليوم، والاستمرار يزيد السلسلة', async () => {
    await prisma.user.update({ where: { id: studentId }, data: { streakDays: 0, lastActiveAt: null } });
    await registerDailyActivity(studentId);
    await registerDailyActivity(studentId);
    let u = await prisma.user.findUnique({ where: { id: studentId } });
    expect(u.streakDays).toBe(1);

    // أمسية الأمس ⇒ اليوم التالي = 2
    const yesterday = new Date(Date.now() - 86400000);
    await prisma.user.update({ where: { id: studentId }, data: { lastActiveAt: yesterday, streakDays: 1 } });
    await registerDailyActivity(studentId);
    u = await prisma.user.findUnique({ where: { id: studentId } });
    expect(u.streakDays).toBe(2);
  });
});
