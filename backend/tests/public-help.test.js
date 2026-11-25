import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';

let request;
let app;
let prisma;

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  app = (await import('../src/index.js')).app;
  prisma = (await import('../src/db.js')).default;
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

const BASE = {
  firstName: 'زائر',
  lastName: 'تجريبي',
  requestType: 'سؤال آخر',
  description: 'لا أستطيع إنشاء حساب'
};

describe('طلبات المساعدة من الضيوف', () => {
  it('الضيف يستطيع الإرسال ببريد تواصل ويبقى بلا userId', async () => {
    const res = await request(app).post('/api/help-requests').send({ ...BASE, email: 'guest@test.tn' });
    expect(res.status).toBe(201);
    expect(res.body.userId == null).toBe(true);
    expect(res.body.email).toBe('guest@test.tn');
  });

  it('الضيف بلا وسيلة تواصل يبقى مجهولًا (لا يُنتحل userId)', async () => {
    const res = await request(app).post('/api/help-requests').send(BASE);
    expect(res.status).toBe(201);
    expect(res.body.userId == null).toBe(true);
  });

  it('المستخدم المسجَّل يُربط بلاغه بحسابه', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'teacher@test.tn', password: 'teacher123' });
    expect(login.status).toBe(200);
    const res = await request(app)
      .post('/api/help-requests')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send(BASE);
    expect(res.status).toBe(201);
    expect(res.body.userId).toBeTruthy();
  });

  it('سقف الضيوف يمنع الإرسال المتكرر (429 بعد 8 طلبات)', async () => {
    let last = null;
    for (let i = 0; i < 9; i++) {
      last = await request(app).post('/api/help-requests').send({ ...BASE, email: `g${i}@test.tn` });
    }
    expect(last.status).toBe(429);
  });
});
