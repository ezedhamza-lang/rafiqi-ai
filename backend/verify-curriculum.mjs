// تحقّق شامل: محرّك المناهج + مطابقة تبويبات واجهة التلميذ
import fs from 'node:fs';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://u:p@127.0.0.1:5432/db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'verify-only-secret';
process.env.NODE_ENV = 'test';

const svc = await import('./src/services/curriculumService.js');
const books = svc.listBooks('TN');

// نسخة مطابقة لـ StudentBooks.jsx bookTab()
function bookTab(b) {
  const k = String(b.subjectKey || b.subject || '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/[\u064B-\u0652]/g, '').trim();
  if (k.startsWith('رياضيات')) return 'math';
  if (k.includes('قراء') || k.includes('انيس')) return 'anisi';
  if (k.includes('ايقاظ') || k.includes('علوم')) return 'science';
  if (k.includes('انتاج')) return 'production';
  if (k.includes('فرنس') || k.includes('french') || k.includes('francais')) return 'french';
  return b.subjectId || 'math';
}
const TABS = ['math', 'anisi', 'science', 'production', 'french'];

const ours = books.filter((b) => String(b.subjectId).startsWith('our-'));
const theirs = books.filter((b) => !String(b.subjectId).startsWith('our-'));

console.log('books_total =', books.length, '| ours =', ours.length, '| pre-existing =', theirs.length);

const byTab = {};
const orphans = [];
for (const b of ours) {
  const t = bookTab(b);
  byTab[t] = (byTab[t] || 0) + 1;
  if (!TABS.includes(t)) orphans.push({ id: b.subjectId, tab: t, title: b.title, subjectKey: b.subjectKey });
}
console.log('our books by tab:', JSON.stringify(byTab));
console.log('orphans (no matching tab):', orphans.length, orphans.slice(0, 5));

const bad = ours.filter((b) => !b.hasPDF || !b.pdfUrl || !b.totalPages);
console.log('our books missing hasPDF/pdfUrl/totalPages:', bad.length, bad.slice(0, 4).map((b) => b.subjectId));

const noCover = ours.filter((b) => {
  const p = 'D:/WORK/03-education/rafiqi-full-2026-09-02-2/rafiqi/backend' + b.imageBase + '001' + (b.imageExt || '.jpg');
  return !fs.existsSync(p);
});
console.log('our books missing cover file:', noCover.length, noCover.slice(0, 4).map((b) => b.subjectId));

console.log('pre-existing count (must be 31):', theirs.length);
console.log('pre-existing with empty title:', theirs.filter((b) => !b.title).length);
console.log('pre-existing with lessons>0:', theirs.filter((b) => b.lessonsCount > 0).length);
const grades = {};
for (const b of books) grades[b.gradeId] = (grades[b.gradeId] || 0) + 1;
console.log('books per grade:', JSON.stringify(grades));
