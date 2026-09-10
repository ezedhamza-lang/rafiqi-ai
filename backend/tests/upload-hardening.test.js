import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resetDatabase, seedTestData, login } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.join(__dirname, '../uploads');

let app;
let parentToken;
let teacherId;

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function postMessage(fields, fileName, content, contentType) {
  const req = request(app)
    .post('/api/messages/messages')
    .set('Authorization', `Bearer ${parentToken}`)
    .field('recipientId', String(teacherId))
    .field('body', 'اختبار تقوية الرفع');
  for (const [k, v] of Object.entries(fields || {})) req.field(k, String(v));
  if (fileName) req.attach('attachment', Buffer.from(content), { filename: fileName, contentType });
  return req;
}

let request;

describe('تقوية رفع الملفات (ضد XSS وتزوير الامتداد)', () => {
  beforeAll(async () => {
    request = (await import('supertest')).default;
    ({ app } = await import('../src/index.js'));
    await resetDatabase();
    const { users } = await seedTestData();
    teacherId = users.teacher.id;
    const r = await login('parent@test.tn', 'parent123');
    parentToken = r.body.token;
  });

  it('يرفض evil.pdf.html — الامتداد الأخير هو الفيصل', async () => {
    const res = await postMessage({}, 'evil.pdf.html', '<script>alert(1)</script>', 'application/pdf');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/غير مسموح|not allowed/i);
  });

  it('يرفض .png مزيف بمحتوى HTML — فحص البنية السحرية', async () => {
    const res = await postMessage({}, 'payload.png', '<html><body>evil</body></html>', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/محتوى|يطابق/);
  });

  it('يرقب ملفاً صالحاً فعلاً ويخزّنه باسم عشوائي آمن', async () => {
    const res = await postMessage({}, 'my file name.png', PNG_1x1, 'image/png');
    expect(res.status).toBe(201);
    const url = res.body.attachmentUrl;
    expect(url).toMatch(/^\/uploads\/att-\d+-[0-9a-f]{16}\.png$/);
    const onDisk = path.join(UPLOADS, path.basename(url));
    expect(fs.existsSync(onDisk)).toBe(true);
    fs.unlinkSync(onDisk);
  });

  it('طلب مساعدة مجهول لا يستطيع أنتحال userId من الجسم', async () => {
    const res = await request(app).post('/api/help-requests/').send({
      firstName: 'مجهول',
      lastName: 'مختبر',
      requestType: 'مشكلة تقنية',
      description: 'محاولة أنتحال',
      userId: teacherId
    });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBeNull();
  });

  it('طلب مساعدة من مستخدم مصادَق يُربط بحسابه هو فقط', async () => {
    const res = await request(app)
      .post('/api/help-requests/')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        firstName: 'محمد',
        lastName: 'الولي',
        requestType: 'مشكلة تقنية',
        description: 'تقرير من داخل الحساب',
        userId: teacherId
      });
    expect(res.status).toBe(201);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${parentToken}`);
    expect(res.body.userId).toBe(me.body.id);
  });
});
