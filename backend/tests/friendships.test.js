import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import prisma from '../src/db.js';
import bcrypt from 'bcryptjs';

const hash = (pw) => bcrypt.hash(pw, 4);

// ISS-001: the `Friendship` model existed in schema.prisma but no migration ever
// created the table, so every friendship endpoint failed while the UI looked
// empty-but-healthy. The migration below is what fixed it; these tests are the
// guard so the table (or the route) can never silently break again.
let app;
let tokenA;
let tokenB;
let userA;
let userB;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();

  const student = await prisma.user.findUnique({ where: { email: 'student@test.tn' } });
  userA = student.id;
  userB = await prisma.user.create({
    data: {
      firstName: 'ليلى',
      lastName: 'الصديقة',
      email: 'friend2@test.tn',
      passwordHash: await hash('friend123'),
      role: 'STUDENT',
      accountStatus: 'ACTIVE'
    }
  }).then((u) => u.id);

  tokenA = (await login('student@test.tn', 'student123')).body.token;
  tokenB = (await login('friend2@test.tn', 'friend123')).body.token;
});

const base = '/api/student/friends';
const auth = (req, token) => req.set('Authorization', `Bearer ${token}`);

describe('الصداقات — الجدول والدورة الكاملة (ISS-001)', () => {
  it('جدول Friendship موجود فعلًا في القاعدة (حارس ضد انقطاع الهجرات)', async () => {
    const rows = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'Friendship'`;
    expect(rows.length).toBe(1);
  });

  it('يرفض كل المسارات بدون رمز صالح', async () => {
    expect((await request(app).get(base)).status).toBe(401);
    expect((await request(app).post(`${base}/request`).send({ userId: userB })).status).toBe(401);
  });

  it('يبحث عن تلميذ آخر ولا يدرج نفسه', async () => {
    const res = await auth(request(app).get(`${base}/search?q=` + encodeURIComponent('ليلى')), tokenA);
    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.id)).toContain(userB);
    expect(res.body.users.map((u) => u.id)).not.toContain(userA);
  });

  it('يرسل طلب صداقة ثم يعرضه صندوق المستلم فقط', async () => {
    const res = await auth(request(app).post(`${base}/request`), tokenA).send({ userId: userB });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeTruthy();

    const inbox = await auth(request(app).get(base), tokenB);
    expect(inbox.body.requests).toHaveLength(1);
    expect(inbox.body.requests[0].userId).toBe(userA);

    // the sender sees no pending request of his own
    const sender = await auth(request(app).get(base), tokenA);
    expect(sender.body.requests).toHaveLength(0);
  });

  it('يمنع الطلب المكرر والطلب إلى النفس', async () => {
    const dup = await auth(request(app).post(`${base}/request`), tokenA).send({ userId: userB });
    expect(dup.status).toBe(400);

    const self = await auth(request(app).post(`${base}/request`), tokenA).send({ userId: userA });
    expect(self.status).toBe(400);
  });

  // ISS-010: a missing / malformed `userId` used to reach prisma and answer 500.
  it('يرفض 400 وليس 500 عندما userId ناقص أو غير صالح', async () => {
    const before = await prisma.friendship.count();
    for (const body of [{}, { userId: null }, { userId: '' }, { userId: 'abc' }, { userId: {} }, { userId: 1.5 }, { userId: -3 }, { userId: 0 }]) {
      const res = await auth(request(app).post(`${base}/request`), tokenA).send(body);
      expect(res.status, `body=${JSON.stringify(body)}`).toBe(400);
      expect(res.body.error).toBeTruthy();
    }
    expect(await prisma.friendship.count()).toBe(before);
  });

  it('يقبل userId كنص رقمي (كان يمرّ إلى 500) ويرفض غير الموجود', async () => {
    const asString = await auth(request(app).post(`${base}/request`), tokenA).send({ userId: String(userB) });
    expect(asString.status).toBe(400); // a request already exists at this point in the run
    expect(asString.body.error).toMatch(/already exists/i);

    const ghost = await auth(request(app).post(`${base}/request`), tokenA).send({ userId: 987654 });
    expect(ghost.status).toBe(404);
    expect(ghost.body.error).toBeTruthy();
  });

  it('يرفض الإرسال إلى غير تلميذ', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const res = await auth(request(app).post(`${base}/request`), tokenA).send({ userId: teacher.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/تلميذ/);
    expect(await prisma.friendship.count({ where: { addresseeId: teacher.id } })).toBe(0);
  });

  it('لا يقبل طلبًا إلا صاحبه', async () => {
    const [row] = await prisma.friendship.findMany();
    const wrong = await auth(request(app).post(`${base}/accept/${row.id}`), tokenA);
    expect(wrong.status).toBe(404);
    expect((await prisma.friendship.findUnique({ where: { id: row.id } })).status).toBe('PENDING');
  });

  it('القبول يجعل الصداقة مرئية للطرفين', async () => {
    const [row] = await prisma.friendship.findMany();
    const res = await auth(request(app).post(`${base}/accept/${row.id}`), tokenB);
    expect(res.status).toBe(200);

    for (const [token, expectId] of [[tokenA, userB], [tokenB, userA]]) {
      const list = await auth(request(app).get(base), token);
      expect(list.body.friends.map((f) => f.id)).toContain(expectId);
    }
  });

  it('الرفض يحذف الطلب ولا ينشئ صداقة', async () => {
    const third = await prisma.user.create({
      data: {
        firstName: 'سامي',
        lastName: 'المدعوم',
        email: 'friend3@test.tn',
        passwordHash: await hash('friend123'),
        role: 'STUDENT',
        accountStatus: 'ACTIVE'
      }
    });
    await auth(request(app).post(`${base}/request`), tokenA).send({ userId: third.id });
    const [row] = await prisma.friendship.findMany({ where: { addresseeId: third.id } });
    const before = await prisma.friendship.count();
    const res = await auth(request(app).post(`${base}/decline/${row.id}`), tokenA);
    expect(res.status).toBe(200);
    expect(await prisma.friendship.count()).toBe(before - 1);
  });

  it('إزالة الصداقة يعيد الطرفين إلى الحالة الأولى', async () => {
    const [row] = await prisma.friendship.findMany({ where: { status: 'ACCEPTED' } });
    const res = await auth(request(app).delete(`${base}/${row.id}`), tokenA);
    expect(res.status).toBe(200);
    expect(await prisma.friendship.count()).toBe(0);
    const list = await auth(request(app).get(base), tokenA);
    expect(list.body.friends).toHaveLength(0);
  });
});
