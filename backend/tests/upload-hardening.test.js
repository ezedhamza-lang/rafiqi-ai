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

// Shared setup for the whole file: a second resetDatabase() between describes would
// re-seed the users while the first describe's token is still in use.
beforeAll(async () => {
  request = (await import('supertest')).default;
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  const { users } = await seedTestData();
  teacherId = users.teacher.id;
  const r = await login('parent@test.tn', 'parent123');
  parentToken = r.body.token;
});

describe('تقوية رفع الملفات (ضد XSS وتزوير الامتداد)', () => {

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

// ISS-007: multer writes the attachment to disk before the body is validated, so a
// request that failed validation used to leave the file behind forever. The
// cleanup middleware removes uploads whenever the response is an error.
describe('لا ملفات يتيمة بعد طلب فاشل (ISS-007)', () => {
  const listUploads = () => fs.readdirSync(UPLOADS).filter((f) => f.startsWith('help-'));

  it('طلب مساعدة ناقص الحقول + مرفق صالح → 400 بلا ملف جديد على القرص', async () => {
    const before = listUploads();
    const res = await request(app)
      .post('/api/help-requests/')
      .field('firstName', 'تدقيق')
      .attach('attachment', PNG_1x1, { filename: 'ok.png', contentType: 'image/png' });
    // firstName only → lastName and requestType are missing
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['lastName', 'requestType']));
    expect(listUploads()).toEqual(before);
  });

  it('طلب مساعدة كامل + مرفق صالح → 201 والملف موجود فعلًا (لا حذف زائد)', async () => {
    const before = listUploads();
    const res = await request(app)
      .post('/api/help-requests/')
      .field('firstName', 'تدقيق')
      .field('lastName', 'AUDIT')
      .field('requestType', 'TECHNICAL')
      .attach('attachment', PNG_1x1, { filename: 'ok.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const after = listUploads();
    expect(after.length).toBe(before.length + 1);
    const created = path.join(UPLOADS, after.find((f) => !before.includes(f)));
    expect(fs.existsSync(created)).toBe(true);
    fs.unlinkSync(created);
  });

  it('رسالة لمرسل غير موجود + مرفق → 404 بلا ملف يتيم', async () => {
    const dir = path.join(UPLOADS);
    const before = fs.readdirSync(dir).filter((f) => f.startsWith('att-'));
    const res = await request(app)
      .post('/api/messages/messages')
      .set('Authorization', `Bearer ${parentToken}`)
      .field('recipientId', '999999')
      .field('body', 'اختبار التنظيف')
      .attach('attachment', PNG_1x1, { filename: 'ok.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
    expect(fs.readdirSync(dir).filter((f) => f.startsWith('att-'))).toEqual(before);
  });

  it('وثيقة ولي صالحة → 201 والملف محفوظ (التنظيف لا يمس النجاح)', async () => {
    const dir = path.join(UPLOADS, 'documents');
    const before = fs.readdirSync(dir);
    const res = await request(app)
      .post('/api/parent/documents')
      .set('Authorization', `Bearer ${parentToken}`)
      .field('docType', 'شهادة ميلاد')
      .field('title', 'وثيقة اختبار')
      .attach('file', PNG_1x1, { filename: 'doc.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const url = res.body.fileUrl;
    expect(url).toMatch(/^\/uploads\/documents\//);
    // the URL is signed: /uploads/documents/<name>?st=…&hash=…
    const name = path.basename(url.split('?')[0]);
    const onDisk = path.join(dir, name);
    expect(fs.existsSync(onDisk)).toBe(true);
    fs.unlinkSync(onDisk);
    expect(fs.readdirSync(dir)).toEqual(before);
  });
});
