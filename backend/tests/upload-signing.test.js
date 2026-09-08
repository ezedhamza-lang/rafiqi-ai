import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';

let app;
const SECRET = 'test-jwt-secret-key';

function sign(urlPath, exp = Date.now() + 60000) {
  const sig = crypto.createHmac('sha256', SECRET).update(`${urlPath}.${exp}`).digest('hex');
  return `${exp}.${sig}`;
}

describe('حارس الملفات المحمية (أوراق الامتحانات + وثائق الأولياء)', () => {
  beforeAll(async () => {
    ({ app } = await import('../src/index.js'));
  });

  it('يرفض 403 بلا توقيع لمسار /uploads/exams', async () => {
    const res = await request(app).get('/uploads/exams/some-file.pdf');
    expect(res.status).toBe(403);
  });

  it('يرفض 403 لتوقيع مزيّف', async () => {
    const res = await request(app).get('/uploads/exams/some-file.pdf?st=99999999999999.deadbeef');
    expect(res.status).toBe(403);
  });

  it('يرفض 403 لتوقيع منتهٍ', async () => {
    const st = sign('/uploads/exams/some-file.pdf', Date.now() - 1000);
    const res = await request(app).get(`/uploads/exams/some-file.pdf?st=${st}`);
    expect(res.status).toBe(403);
  });

  it('يسمح بتوقيع صالح (الملف غير موجود ⇒ 404 لا 403)', async () => {
    const st = sign('/uploads/exams/does-not-exist.pdf');
    const res = await request(app).get(`/uploads/exams/does-not-exist.pdf?st=${st}`);
    expect(res.status).toBe(404);
  });

  it('يحمي /uploads/documents بنفس القاعدة', async () => {
    const noSig = await request(app).get('/uploads/documents/x.pdf');
    expect(noSig.status).toBe(403);
    const st = sign('/uploads/documents/x.pdf');
    const ok = await request(app).get(`/uploads/documents/x.pdf?st=${st}`);
    expect(ok.status).toBe(404);
  });
});
