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

describe('/api/health DB probe caching (protects the free Neon CU-hour budget)', () => {
  it('serves the cached probe instead of querying the DB on every ping', async () => {
    const first = await request(app).get('/api/health');
    expect(first.status).toBe(200);
    expect(['up', 'down']).toContain(first.body.db);
    expect(first.body.dbCheckedAt).toBeDefined();

    // The keep-warm workflow pings every 5 minutes; a fresh query each time
    // wakes Neon continuously and burned the 100 CU-hour quota in September.
    const second = await request(app).get('/api/health');
    expect(second.body.db).toBe(first.body.db);
    expect(second.body.dbCheckedAt).toBe(first.body.dbCheckedAt);
  });

  it('forces a fresh probe with ?db=1 and keeps serving it until it expires', async () => {
    const before = await request(app).get('/api/health');
    const forced = await request(app).get('/api/health?db=1');
    expect(forced.status).toBe(200);
    expect(['up', 'down']).toContain(forced.body.db);
    expect(new Date(forced.body.dbCheckedAt).getTime())
      .toBeGreaterThanOrEqual(new Date(before.body.dbCheckedAt).getTime());

    const after = await request(app).get('/api/health');
    expect(after.body.db).toBe(forced.body.db);
    expect(after.body.dbCheckedAt).toBe(forced.body.dbCheckedAt);
  });
});
