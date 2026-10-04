// بطاقات الدخول (المرحلة C) — المدير يصدر بيانات دخول قابلة للطباعة،
// والبطاقة تبقى صالحة، ولا تُسرَّب كلمة سر في أي قراءة، ولا تُخترق بوابة الدفع.
import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import prisma from '../src/db.js';
import request from 'supertest';
import { runTenancyBootstrap } from '../src/services/tenancyBootstrap.js';

let app;
let directorToken;
let teacherToken;
let klass;
let student;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  const seeded = await seedTestData();
  klass = seeded.klass;
  student = seeded.student;
  const d = await login('director@test.tn', 'director123');
  directorToken = d.body.token;
  expect(directorToken).toBeTruthy();
  const t = await login('teacher@test.tn', 'teacher123');
  teacherToken = t.body.token;
  expect(teacherToken).toBeTruthy();
});

const asDirector = (req) => req.set('Authorization', `Bearer ${directorToken}`);

// حساب SUPER_ADMIN: البذور لا تحتوي واحدًا، فننشئه عند الحاجة فقط (كجزء من الاختبار)
let superAdminCache = null;
async function superAdminToken() {
  if (superAdminCache) return superAdminCache;
  const { default: p } = await import('../src/db.js');
  const email = 'super.cards@test.tn';
  let user = await p.user.findUnique({ where: { email } });
  if (!user) {
    user = await p.user.create({
      data: {
        firstName: 'مدير',
        lastName: 'عام',
        email,
        passwordHash: await (await import('bcryptjs')).default.hash('super12345', 4),
        role: 'SUPER_ADMIN'
      }
    });
  }
  const res = await login(email, 'super12345');
  expect(res.status).toBe(200);
  superAdminCache = res.body.token;
  return superAdminCache;
}

describe('بطاقات دخول التلاميذ — إصدار وقراءة', () => {
  it('يرفض بلا مصادقة (401)', async () => {
    const res = await request(app).get(`/api/director/classes/${klass.id}/credentials`);
    expect(res.status).toBe(401);
  });

  it('يرفض الأستاذ (403) — البطاقات قرار إداري', async () => {
    const res = await request(app)
      .get(`/api/director/classes/${klass.id}/credentials`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  it('قائمة تلاميذ القسم بلا كلمة سر ولا hash (لا تسريب في القراءة)', async () => {
    const res = await asDirector(request(app).get(`/api/director/classes/${klass.id}/credentials`));
    expect(res.status).toBe(200);
    expect(res.body.class.id).toBe(klass.id);
    expect(Array.isArray(res.body.students)).toBe(true);
    expect(res.body.students.length).toBeGreaterThan(0);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/passwordHash/i);
    expect(raw).not.toMatch(/tempPassword/i);
    expect(raw).not.toMatch(/\$2[aby]\$/); // بصمة bcrypt لا تغادر الخادم أبدًا
    for (const row of res.body.students) {
      expect(row.password).toBeUndefined();
      expect(row).toHaveProperty('email');
      expect(row).toHaveProperty('needsChange');
    }
  });

  it('قسم غير موجود (404)', async () => {
    const res = await asDirector(request(app).get('/api/director/classes/999999/credentials'));
    expect(res.status).toBe(404);
  });

  it('المدير العام SUPER_ADMIN يقرأ البطاقات (نفس صلاحية ADMIN في الخادم)', async () => {
    // كان الواجهة تحجبه عن صفحة البطاقات بينما الـAPI يسمح له ⇒ إصلاح 04-10.
    const superToken = await superAdminToken();
    const res = await request(app)
      .get(`/api/director/classes/${klass.id}/credentials`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.students.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tempPassword/i);
  });

  it('SUPER_ADMIN يستطيع الإصدار أيضًا', async () => {
    const token = await superAdminToken();
    const res = await request(app)
      .post(`/api/director/credentials/${student.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: '55443322' });
    expect(res.status).toBe(200);
    expect(res.body.password).toBe('55443322');
    expect((await login(res.body.email, '55443322')).status).toBe(200);
  });

  it('إصدار بطاقة: يعيد كلمة السر مرة واحدة، والدخول بها يعمل، ولا إجبار على التغيير', async () => {
    const res = await asDirector(request(app).post(`/api/director/credentials/${student.id}`)).send({ password: '88442211' });
    expect(res.status).toBe(200);
    expect(res.body.password).toBe('88442211');
    expect(res.body.email).toBeTruthy();
    expect(res.body.mustChangePassword).toBe(false);
    expect(res.body.mode).toBe('card');

    const loginRes = await login(res.body.email, '88442211');
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.mustChangePassword).toBe(false);
  });

  it('الإصدار يضبط credentialsIssuedAt ولا يمس حالة الحساب (بوابة الدفع سليمة)', async () => {
    const row = await prisma.student.findUnique({ where: { id: student.id }, select: { credentialsIssuedAt: true } });
    expect(row.credentialsIssuedAt).toBeTruthy();
    const account = await prisma.user.findUnique({ where: { id: student.accountUserId }, select: { accountStatus: true } });
    expect(account.accountStatus).toBe('ACTIVE'); // كما هو — لا تغيير صامت
  });

  it('كلمة سر مؤقتة ⇒ إجبار التغيير عند أول دخول', async () => {
    const res = await asDirector(request(app).post(`/api/director/credentials/${student.id}`)).send({ mode: 'temporary' });
    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(true);
    const loginRes = await login(res.body.email, res.body.password);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
    // أعد الحساب لحالة البطاقة العادية لبقية الاختبارات
    await asDirector(request(app).post(`/api/director/credentials/${student.id}`)).send({ password: '88442211' });
  });

  it('كلمة سر مولّدة تلقائيًا = 6 أرقام', async () => {
    const res = await asDirector(request(app).post(`/api/director/credentials/${student.id}`)).send({});
    expect(res.status).toBe(200);
    expect(res.body.password).toMatch(/^\d{6}$/);
    const loginRes = await login(res.body.email, res.body.password);
    expect(loginRes.status).toBe(200);
  });

  it('يرفض كلمة سر قصيرة (400) ولا يغيّر شيئًا', async () => {
    const before = await prisma.student.findUnique({ where: { id: student.id }, select: { credentialsIssuedAt: true } });
    const res = await asDirector(request(app).post(`/api/director/credentials/${student.id}`)).send({ password: '123' });
    expect(res.status).toBe(400);
    const after = await prisma.student.findUnique({ where: { id: student.id }, select: { credentialsIssuedAt: true } });
    expect(after.credentialsIssuedAt?.getTime()).toBe(before.credentialsIssuedAt?.getTime());
  });

  it('يرفض كلمة سر بنفس البريد أو فيها فراغات (400)', async () => {
    const dup = await asDirector(request(app).post(`/api/director/credentials/${student.id}`)).send({
      password: 'a@b.co m'
    });
    expect(dup.status).toBe(400);
  });

  it('تلميذ غير موجود (404) وتلميذ بلا حساب (400)', async () => {
    const missing = await asDirector(request(app).post('/api/director/credentials/999999')).send({});
    expect(missing.status).toBe(404);

    const noAccount = await prisma.student.create({
      data: {
        userId: student.userId,
        firstName: 'بلا',
        lastName: 'حساب',
        birthDate: new Date('2015-01-01'),
        level: klass.level,
        classId: klass.id
      }
    });
    const res = await asDirector(request(app).post(`/api/director/credentials/${noAccount.id}`)).send({});
    expect(res.status).toBe(400);
  });

  it('إصدار جماعي: يسلّم بطاقات القسم ولا يلمس من صدرت له بطاقة', async () => {
    const second = await prisma.student.create({
      data: {
        userId: student.userId,
        firstName: 'لميس',
        lastName: 'الشريف',
        birthDate: new Date('2015-02-02'),
        level: klass.level,
        classId: klass.id
      }
    });
    const account = await prisma.user.create({
      data: {
        firstName: 'لميس',
        lastName: 'الشريف',
        email: 'lomis.card@test.tn',
        passwordHash: await (await import('bcryptjs')).default.hash('old-pass', 10),
        role: 'STUDENT',
        schoolId: klass.schoolId
      }
    });
    await prisma.student.update({ where: { id: second.id }, data: { accountUserId: account.id } });

    const bulk = await asDirector(request(app).post('/api/director/credentials/bulk')).send({ classId: klass.id });
    expect(bulk.status).toBe(200);
    // student's card already issued ⇒ skipped; the new one gets issued
    expect(bulk.body.issued).toBe(1);
    expect(bulk.body.skipped).toBeGreaterThanOrEqual(1);
    const lomis = bulk.body.cards.find((c) => c.email === 'lomis.card@test.tn');
    expect(lomis).toBeTruthy();
    expect(lomis.password).toMatch(/^\d{6}$/);
    expect((await login('lomis.card@test.tn', lomis.password)).status).toBe(200);

    // onlyMissing=false ⇒ يُعيد إصدار الجميع (بما فيهم من سبق)
    const all = await asDirector(request(app).post('/api/director/credentials/bulk')).send({
      classId: klass.id,
      onlyMissing: false,
      password: '55667788'
    });
    expect(all.status).toBe(200);
    expect(all.body.issued).toBe(2);
    expect(all.body.cards.every((c) => c.password === '55667788')).toBe(true);
  });

  it('إصدار جماعي لقسم غير موجود (404)', async () => {
    const res = await asDirector(request(app).post('/api/director/credentials/bulk')).send({ classId: 999999 });
    expect(res.status).toBe(404);
  });

  it('البطاقة محفوظة من إعادة كتابة الإقلاع (المرحلة E: الإقلاع لا يكتب أصلًا)', async () => {
    const issued = await asDirector(request(app).post(`/api/director/credentials/${student.id}`)).send({
      password: '77889900'
    });
    expect(issued.status).toBe(200);
    // لا رمز تجديد (تلميذ لم يدخل بعد) — الحالة التي كان الإقلاع يعيد فيها الكتابة
    await prisma.refreshToken.deleteMany({ where: { userId: student.accountUserId } });

    await runTenancyBootstrap(prisma);
    await runTenancyBootstrap(prisma);

    const loginRes = await login(issued.body.email, '77889900');
    expect(loginRes.status).toBe(200);
  });
});
