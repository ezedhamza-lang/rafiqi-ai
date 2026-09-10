import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { resetDatabase, seedTestData } from './helpers.js';
import prisma from '../src/db.js';

let app;
let superToken;

const PW = 'tst1234';

async function login(email, password) {
  return request(app).post('/api/auth/login').send({ email, password });
}

describe('إبطال الجلسات عند تغيير الدور/كلمة السر/الإيقاف', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    await seedTestData();
    const r = await login('super@education.tn', 'super123');
    superToken = r.body.token;
  });

  it('إعادة تعيين كلمة السر تُسقط الجلسات القديمة والعمل بالسر الجديد', async () => {
    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@test.tn' } });
    const sess = await login('teacher@test.tn', 'teacher123');
    expect(sess.status).toBe(200);

    const reset = await request(app)
      .put(`/api/superadmin/users/${teacher.id}/password`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ password: PW });
    expect(reset.status).toBe(200);

    const oldRefresh = await request(app).post('/api/auth/refresh').send({ refreshToken: sess.body.refreshToken });
    expect(oldRefresh.status).toBe(401);

    const newLogin = await login('teacher@test.tn', PW);
    expect(newLogin.status).toBe(200);

    const oldPw = await login('teacher@test.tn', 'teacher123');
    expect(oldPw.status).toBe(401);
  });

  it('تغيير الدور يُبطل جلسات الدور السابق', async () => {
    const email = `rl${Date.now()}@t.tn`;
    const u = await prisma.user.create({
      data: { firstName: 'معلم', lastName: 'محول', email, passwordHash: await bcrypt.hash(PW, 4), role: 'TEACHER', accountStatus: 'ACTIVE' }
    });
    const sess = await login(email, PW);
    expect(sess.status).toBe(200);

    const chg = await request(app)
      .put(`/api/superadmin/users/${u.id}/role`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ role: 'PARENT' });
    expect(chg.status).toBe(200);

    const ref = await request(app).post('/api/auth/refresh').send({ refreshToken: sess.body.refreshToken });
    expect(ref.status).toBe(401);
  });

  it('توقيف اشتراك يُسقط الجلسات', async () => {
    const email = `sp${Date.now()}@t.tn`;
    const u = await prisma.user.create({
      data: { firstName: 'موقوف', lastName: 'اختبار', email, passwordHash: await bcrypt.hash(PW, 4), role: 'STUDENT', accountStatus: 'ACTIVE' }
    });
    const sub = await prisma.subscription.create({
      data: { userId: u.id, type: 'STUDENT', plan: 'اشتراك تلميذ', schoolYear: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30'), status: 'ACTIVE', amount: 147 }
    });
    const sess = await login(email, PW);
    expect(sess.status).toBe(200);

    const susp = await request(app).post(`/api/superadmin/subscriptions/${sub.id}/suspend`).set('Authorization', `Bearer ${superToken}`);
    expect(susp.status).toBe(200);

    const ref = await request(app).post('/api/auth/refresh').send({ refreshToken: sess.body.refreshToken });
    expect([401, 403]).toContain(ref.status);
  });
});
