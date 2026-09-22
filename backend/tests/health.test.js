import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { resetDatabase, seedTestData } from './helpers.js';

let request;
let app;

beforeAll(async () => {
  const { default: supertest } = await import('supertest');
  request = supertest;
  const mod = await import('../src/index.js');
  app = mod.app;
});

afterAll(async () => {
  const prisma = (await import('../src/db.js')).default;
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  await seedTestData();
});

async function getToken(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

describe('parent health records (not shadowed by public health check)', () => {
  it('returns array for PARENT on GET /api/parent/health', async () => {
    const token = await getToken('parent@test.tn', 'parent123');
    const res = await request(app)
      .get('/api/parent/health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].studentId).toBeDefined();
  });

  it('still returns object for public /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
    expect(res.body.status).toBe('ok');
  });
});
