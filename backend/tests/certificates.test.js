import { describe, it, expect, beforeAll } from 'vitest';
import { resetDatabase, seedTestData, login } from './helpers.js';
import request from 'supertest';
import { rewardCertificateHtml } from '../src/services/pdfTemplates.js';
import { generateCertificate } from '../src/services/certificateService.js';

// ISS-003: the student certificate was drawn with pdf-lib, whose Latin-1 fallback
// font cannot encode Arabic (`WinAnsi cannot encode 0x0631`). The TTF directory the
// service looked for never existed, so the try/catch silently degraded to Helvetica
// and every Arabic certificate returned HTTP 500. The document is now rendered from
// RTL HTML through the platform's browser PDF engine, with the pdf-lib path kept as
// a fallback that at least embeds a real Arabic TTF when one is installed.
let app;
let token;

beforeAll(async () => {
  ({ app } = await import('../src/index.js'));
  await resetDatabase();
  await seedTestData();
  token = (await login('student@test.tn', 'student123')).body.token;
});

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

describe('شهادة التلميذ — القالب العربي (ISS-003)', () => {
  it('قالب HTML عربي RTL ويحمل اسم التلميذ والمادة والقسم', () => {
    const html = rewardCertificateHtml({
      studentName: 'أحمد التلميذ',
      title: 'شهادة إتمام الدروس',
      description: 'قد أتم بنجاح الدروس والأنشطة التعليمية المقررة.',
      subject: 'الرياضيات',
      className: 'قسم السنة الأولى أ',
      date: '26/09/2026',
      teacherName: 'فاطمة المعلمة'
    });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('أحمد التلميذ');
    expect(html).toContain('الرياضيات');
    expect(html).toContain('قسم السنة الأولى أ');
    expect(html).toContain('فاطمة المعلمة');
    expect(html).toContain('26/09/2026');
    // landscape page, otherwise the layout is squeezed into portrait
    expect(html).toContain('A4 landscape');
  });

  it('يهرب كل نص قادم من المستخدم ضد الحقن في HTML', () => {
    const html = rewardCertificateHtml({ studentName: '<script>alert(1)</script>', subject: '"><img src=x>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;&gt;&lt;img');
  });

  it('يولّد PDF فعلية بلا استثناء (المسار/browser أو البديل)', async () => {
    const bytes = await generateCertificate({
      studentName: 'أحمد التلميذ',
      title: 'شهادة إتمام الدروس',
      subject: 'الرياضيات',
      className: 'قسم السنة الأولى أ',
      teacherName: 'فاطمة المعلمة'
    });
    const buf = Buffer.from(bytes);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

describe('شهادة التلميذ — نقطة النهاية', () => {
  it('يرفض التحميل بدون رمز', async () => {
    expect((await request(app).get('/api/student/certificates/level/3/pdf')).status).toBe(401);
  });

  it('يرفض نوعًا غير معروف بدل توليد ملف مكسور', async () => {
    const res = await auth(request(app).get('/api/student/certificates/bogus/1/pdf'));
    expect(res.status).toBe(400);
  });

  for (const [type, id] of [['level', '3'], ['subject', 'الرياضيات'], ['xp', '250']]) {
    it(`يعمل نوع "${type}" ويعيد PDF سليمة (200 + application/pdf)`, async () => {
      const res = await auth(request(app).get(`/api/student/certificates/${type}/${encodeURIComponent(id)}/pdf`));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body?.data ?? res.text ?? '');
      expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  }

  it('اسم الملف في الترويسة يبقى ASCII (اسم مادة عربي لا يكسر الترويسة)', async () => {
    const res = await auth(request(app).get(`/api/student/certificates/subject/${encodeURIComponent('الرياضيات')}/pdf`));
    expect(res.status).toBe(200);
    const disposition = res.headers['content-disposition'];
    const plain = disposition.match(/filename="([^"]*)"/)[1];
    // eslint-disable-next-line no-control-regex
    expect(/^[\x20-\x7e]*$/.test(plain)).toBe(true);
    // the real Arabic name is still offered through the RFC 5987 parameter
    expect(disposition).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1])).toContain('الرياضيات');
  });
});
