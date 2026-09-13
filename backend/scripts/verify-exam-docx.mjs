/* Verify: exam export is editable .docx in official paper form, no leaked answers. */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://school_user:school_pass@localhost:5432/school_platform_test';
process.env.JWT_SECRET = 'test-secret-test-secret-32';

import { resetDatabase, seedTestData, login } from '../tests/helpers.js';
import request from 'supertest';
import JSZip from 'jszip';

const { app } = await import('../src/index.js');
await resetDatabase();
await seedTestData();
const { body: t } = await login('teacher@test.tn', 'teacher123');
const token = t.token;

const fb = await request(app).get('/api/teacher/exams/from-books')
  .set('Authorization', `Bearer ${token}`)
  .query({ gradeId: 'year6', subject: 'رياضيات', seed: 1, size: 8 });
console.log('from-books status:', fb.status);
const data = fb.body;
const questions = data.questions || data.items || data.content?.questions || [];
console.log('questions returned:', questions.length, 'answersExposed flag:', data.answersExposed);

const create = await request(app).post('/api/teacher/exams')
  .set('Authorization', `Bearer ${token}`)
  .send({ subject: 'رياضيات', level: 6, trimester: 1, title: 'تقييم تجريبي', content: data });
console.log('create exam:', create.status, (create.body.exam || create.body).id);
const examId = (create.body.exam || create.body).id;

const dl = await request(app).get(`/api/teacher/exams/${examId}/docx`)
  .set('Authorization', `Bearer ${token}`)
  .parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
console.log('docx download status:', dl.status, 'content-type:', dl.headers['content-type'], 'bytes:', dl.body.length);

const buf = Buffer.isBuffer(dl.body) ? dl.body : Buffer.from(dl.body);
console.log('PK magic:', buf.subarray(0, 2).toString() === 'PK');
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file('word/document.xml').async('text');
const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
const full = texts.join('');
console.log('doc length(chars):', full.length, '| tables:', (xml.match(/<w:tbl>/g) || []).length);
const has = (k) => full.includes(k);
console.log('رأس: المدرسة=', has('المدرسة الابتدائية'), '| الاسم=', has('الاسم واللقب'), '| القسم=', has('القسم'), '| التاريخ=', has('التاريخ'), '| المدة=', has('المدة'));
console.log('عناصر: السند=', has('السند'), '| جدول إسناد الأعداد=', has('جدول إسناد الأعداد'), '| عتبات=', has('عتبات التملك'), '| / 20=', has('/ 20'));
console.log('أماكن إجابة: ○=', full.includes('○'), '| (  )=', full.includes('(  )'), '| ....lines=', /\.{20,}/.test(full));
const leak = full.match(/(الحل|الإجابة الصحيحة|الجواب)\s*[:=]\s*\S+/g);
console.log('تسريب إجابات:', leak ? leak.slice(0, 5) : 'لا شيء ✓');
process.exit(0);
