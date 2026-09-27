import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import bcrypt from 'bcryptjs';

// ISS-002: the honor board read `d.leaderboard` / `d.currentRank` / `s.isMe` /
// `s.xp` while the API returns `rows` / `me` / `current` / `points`, so the board
// always rendered empty. These tests pin the exact response contract the page
// relies on, including the streak column the page displays.
let app;
let token;
let klass;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  const seeded = await seedTestData();
  klass = seeded.klass;
  token = (await login('student@test.tn', 'student123')).body.token;

  // Two classmates with known XP so the ordering is provable, not eyeballed.
  for (const [i, xp] of [[50, 300], [60, 120]]) {
    const u = await prisma.user.create({
      data: {
        firstName: `تلميذ${i}`,
        lastName: 'الاختبار',
        email: `lb${i}@test.tn`,
        passwordHash: await bcrypt.hash('student123', 4),
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        xp,
        level: Math.floor(xp / 100) + 1,
        streakDays: i === 50 ? 5 : 0
      }
    });
    await prisma.student.create({
      data: {
        userId: u.id,
        accountUserId: u.id,
        classId: klass.id,
        firstName: `تلميذ${i}`,
        lastName: 'الاختبار',
        birthDate: new Date('2019-01-01'),
        level: 'السنة الأولى أساسي',
        schoolYear: '2026-2027'
      }
    });
  }
  // The seeded student starts at 0 XP so all three ranks are distinct.
  await prisma.user.update({ where: { email: 'student@test.tn' }, data: { xp: 0, level: 1, streakDays: 2 } });
});

const base = '/api/student/leaderboard';
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

describe('لوحة الشرف — عقد الاستجابة (ISS-002)', () => {
  it('يرفض الطلب بدون رمز', async () => {
    expect((await request(app).get(base)).status).toBe(401);
  });

  it('يرتّب زملاء القسم تنازليًا بالنقاط ويضع الترتيب الصحيح', async () => {
    const res = await auth(request(app).get(base));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows).toHaveLength(3);
    expect(res.body.rows.map((r) => r.points)).toEqual([300, 120, 0]);
    expect(res.body.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(res.body.total).toBe(3);
  });

  it('يضع علامة "أنا" على صف التلميذ نفسه فقط ويعيد ترتيبه', async () => {
    const res = await auth(request(app).get(base));
    const mine = res.body.rows.filter((r) => r.current);
    expect(mine).toHaveLength(1);
    expect(res.body.me).toBe(mine[0].rank);
    // the seeded student has 0 XP → last place
    expect(res.body.me).toBe(3);
  });

  it('يعرض مستوى واسم صورة لكل صف (الأعمدة التي تعتمد عليها الواجهة)', async () => {
    const res = await auth(request(app).get(base));
    for (const row of res.body.rows) {
      expect(typeof row.name).toBe('string');
      expect(row.name.length).toBeGreaterThan(0);
      expect(typeof row.level).toBe('number');
      expect(typeof row.avatar).toBe('string');
    }
  });

  it('يعرض سلسلة الأيام (streak) التي تحتاجها الواجهة', async () => {
    const res = await auth(request(app).get(base));
    const rows = res.body.rows;
    expect(rows.every((r) => typeof r.streak === 'number')).toBe(true);
    // the fixture student has streakDays = 2
    expect(rows.find((r) => r.current).streak).toBe(2);
    expect(rows.find((r) => r.points === 300).streak).toBe(5);
    // a student with no streak must still be 0, not undefined
    expect(rows.find((r) => r.points === 120).streak).toBe(0);
  });

  it('لا يسرّب تلاميذ أقسام أخرى', async () => {
    const other = await prisma.class.create({ data: { name: 'قسم آخر', level: 'السنة الثانية', teacherId: null } });
    const u = await prisma.user.create({
      data: {
        firstName: 'غريب',
        lastName: 'القسم',
        email: 'lb-other@test.tn',
        passwordHash: await bcrypt.hash('student123', 4),
        role: 'STUDENT',
        accountStatus: 'ACTIVE',
        xp: 9999
      }
    });
    await prisma.student.create({
      data: {
        userId: u.id,
        accountUserId: u.id,
        classId: other.id,
        firstName: 'غريب',
        lastName: 'القسم',
        birthDate: new Date('2019-01-01'),
        level: 'السنة الثانية',
        schoolYear: '2026-2027'
      }
    });
    const res = await auth(request(app).get(base));
    expect(res.body.rows.map((r) => r.name)).not.toContain('غريب القسم');
  });
});
