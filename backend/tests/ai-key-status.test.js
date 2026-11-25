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

describe('حالة مفتاح الذكاء الاصطناعي', () => {
  it('يُخبر الواجهة بما إذا كان مفتاح المنصة متاحًا', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'teacher@test.tn', password: 'teacher123' });
    const res = await request(app)
      .get('/api/ai/key')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.configured).toBe('boolean');
    expect(typeof res.body.platformConfigured).toBe('boolean');
  });
});
