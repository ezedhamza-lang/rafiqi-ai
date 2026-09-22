import { beforeAll, afterAll, describe, it, expect } from 'vitest';

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

describe('بوابة أصل CORS', () => {
  it('يسمح الطلبات بلا Origin (curl / خادم-لخادم)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@y.tn', password: 'wrong-pw' });
    expect(res.status).not.toBe(403);
  });

  it('يسمح بالمصرّح به في ALLOWED_ORIGINS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'x@y.tn', password: 'wrong-pw' });
    expect(res.status).not.toBe(403);
  });

  it('يسمح same-origin (الواجهة تُقدَّم من الخادم نفسه) بدل 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3001')
      .set('Host', 'localhost:3001')
      .send({ email: 'x@y.tn', password: 'wrong-pw' });
    expect(res.status).not.toBe(403);
  });

  it('يسمح same-origin عبر 127.0.0.1 بدل 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1:3001')
      .set('Host', '127.0.0.1:3001')
      .send({ email: 'x@y.tn', password: 'wrong-pw' });
    expect(res.status).not.toBe(403);
  });

  it('يرفض مصدراً أجنبياً غير مصرّح بـ 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example.com')
      .send({ email: 'x@y.tn', password: 'wrong-pw' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CORS');
  });

  it('يرفض مصدراً يطابق نطاق مصرّحاً جزئياً فقط (prefixed-lookalike)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173.evil.example.com')
      .send({ email: 'x@y.tn', password: 'wrong-pw' });
    expect(res.status).toBe(403);
  });
});
