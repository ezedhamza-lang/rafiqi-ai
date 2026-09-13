/* Memo generator QA across all digitized books:
   M1 competency fields non-empty & subject-consistent (no math text in non-math, no cross-domain)
   M2 no empty activity rows (dots allowed; pure-dots/empty cell flagged)
   M3 no repeated questions/examples between rows (normalized bullet overlap >= 2 flags)
   M4 no images anywhere
   M5 lesson count sanity: at least 5 stages (math) / >=3 rows (non-math) */
import { listBooks, getLessonPages } from '../src/services/curriculumService.js';
import { resolveMethodology } from '../src/services/methodologyResolver.js';
import { buildMemoContent } from '../src/services/lessonMemoService.js';

const MATH_MARKERS = ['بتوظيف العمليات على الأعداد', 'الأعداد قراءةً وكتابةً'];

function norm(s) {
  return String(s || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[إأآا]/g, 'ا').replace(/[ةه]/g, 'ه').replace(/[ىي]/g, 'ي').replace(/[\s.,؛:«»"'()\[\]•\-—–*·]+/g, ' ').trim();
}

function auditMemo(book, lesson, content) {
  const errs = [];
  const s = content.spec || {};
  const c = s.competencies || {};
  const isMath = !!s.mathTemplate;
  const subj = String(content.subject || '');

  // M1
  if (!c.component) errs.push('مكوّن الكفاية فارغ');
  if (!c.distinctiveObjective) errs.push('الهدف المميّز فارغ');
  if (!s.content) errs.push('المحتوى فارغ');
  if (!(s.lessonObjectives || []).length) errs.push('هدف الحصة فارغ');
  if (!isMath) {
    const hay = norm(`${c.component} ${c.distinctiveObjective} ${c.subject}`);
    for (const mk of MATH_MARKERS) if (hay.includes(norm(mk))) errs.push(`تسرّب نص الرياضيات إلى «${subj}»: ${mk}`);
  }
  // المكوّن لا يطابق عنوان الدرس حرفيًا بشكل عبثي (مثبت سابقًا) — تفحص تسرّب درس/سنة أخرى
  const domHint = norm(lesson.domain || '');
  if (domHint && c.component && norm(c.component) === norm(lesson.title)) errs.push('مكوّن الكفاية = عنوان الدرس حرفيًا');

  // M4
  if ((content.images || []).length) errs.push('content.images غير فارغ');
  if ((s.images || []).length) errs.push('spec.images غير فارغ');
  for (const r of s.rows || []) if ((r.images || []).length) errs.push(`صور في مرحلة «${r.stage}»`);

  // M2 + M3
  const seenBullets = new Set();
  for (const r of s.rows || []) {
    const t = String(r.teacherActivity || '');
    const l = String(r.learnerActivity || '');
    if (!t.trim()) errs.push(`نشاط المعلم فارغ في «${r.stage}»`);
    if (!l.trim()) errs.push(`نشاط المتعلم فارغ في «${r.stage}»`);
    const tReal = t.split('\n').filter((x) => x.trim() && !/^[.\s]+$/.test(x));
    if (!tReal.length && !isMath) errs.push(`نشاط المعلم منقّط فقط في «${r.stage}»`);
    for (const ln of tReal) {
      const k = norm(ln);
      if (k.length > 20) {
        if (seenBullets.has(k)) errs.push(`تكرار محتوى بين المراحل: ${ln.slice(0, 50)}`);
        seenBullets.add(k);
      }
    }
  }
  // M5
  if (isMath && (s.rows || []).length < 5) errs.push(`المراحل أقل من 5 (${(s.rows || []).length})`);
  if (!isMath && (s.rows || []).length < 3) errs.push(`مراحل البروفايل أقل من 3 (${(s.rows || []).length})`);
  return errs;
}

const books = listBooks();
let checked = 0; const failures = [];
const PER_BOOK = Number(process.argv[2] || 6);
for (const b of books) {
  if (!['year1', 'year2', 'year3', 'year4', 'year5', 'year6'].includes(b.gradeId)) continue;
  let pages = [];
  try { pages = getLessonPages(b.subjectId, b.grade, b.gradeId); } catch { continue; }
  const digitized = pages.filter((l) => (l.blocks || []).length >= 3);
  const sample = digitized.filter((l, i) => i % Math.max(1, Math.floor(digitized.length / PER_BOOK)) === 0).slice(0, PER_BOOK);
  for (const lesson of sample) {
    let profile;
    try {
      profile = resolveMethodology({ subject: b.subject || b.subjectKey, level: b.grade, lessonType: lesson.domain || '' });
    } catch { continue; }
    if (!profile) continue;
    let content;
    try { content = buildMemoContent(profile, lesson, { subject: b.subject || b.subjectKey, level: b.grade, gradeId: b.gradeId, subjectId: b.subjectId }); } catch (e) { failures.push({ book: `${b.gradeId}/${b.subjectId}`, lesson: lesson.id, errs: ['استثناء: ' + e.message] }); continue; }
    checked++;
    const errs = auditMemo(b, lesson, content);
    if (errs.length) failures.push({ book: `${b.gradeId}/${b.subjectId}`, lesson: `${lesson.id} ${lesson.title}`.slice(0, 60), errs });
  }
}
console.log(`memos audited=${checked} failing=${failures.length}`);
for (const f of failures.slice(0, 50)) console.log(`${f.book} :: ${f.lesson} :: ${f.errs.join(' | ')}`);
