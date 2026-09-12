import { getLessonPages } from './curriculumService.js';
import { normalizeArabic } from './curriculumService.js';

/**
 * مجمّع الاختبارات: يبني اختبارات من أسئلة كتب السنة نفسها (تمارين حقيقية
 * مرقمنة: سؤال/خانة عدد/تعبير/رسم/جدول/ربط) — لا يختلق أسئلة ولا إجابات:
 * التصحيح يبقى للتلميذ بالمقارنة أو بيد المعلّم عبر «أرسل للمعلم» القائم.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXAM_KINDS = new Set(['question', 'math-input', 'textarea', 'drawing', 'match-pairs', 'table', 'picture-choice']);
export const KIND_FIELD = {
  question: 'حقل كتابة جواب',
  'math-input': 'خانة عدد',
  textarea: 'أسطر إجابة',
  drawing: 'مساحة رسم',
  'match-pairs': 'لوحة ربط',
  table: 'جدول/شبكة خانات',
  'picture-choice': 'اختيار صورة'
};

const PLACEHOLDER = /التحضير|سيظهر هنا|واصل التقدم|لم ينشا/;
const ANSWER_MARK = /(الإجابة|الجواب|الحل)\s*[:：=]|⟵|←/;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

function isLabeledNoise(t) {
  const n = normalizeArabic(t).replace(/[\s\d().,+]+/g, '');
  return /^(اتدرب|اتحدى|اطبق|اراجع|افكر|احكم|اقوم|اتحقق|وضعيت|وضعيه|تذكر|استنتج|لاحظ)/.test(n) && n.length <= 16;
}

function clean(t) {
  return String(t || '')
    .replace(EMOJI, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function collectGradeQuestions(gradeId) {
  const pool = [];
  const seen = new Set();
  for (const sid of ['math2', 'math']) {
    let pages = [];
    try { pages = getLessonPages(sid, null, gradeId); } catch { pages = []; }
    for (const lesson of pages) {
      for (const b of lesson.blocks || []) {
        if (!b || !EXAM_KINDS.has(b.kind)) continue;
        if (b.teacherOnly) continue;
        const raw = clean(b.text || b.title || '');
        if (!raw || raw.length < 8) continue;
        if (PLACEHOLDER.test(normalizeArabic(raw))) continue;
        if (ANSWER_MARK.test(raw)) continue;
        if (isLabeledNoise(raw)) continue;
        if (b.kind === 'question' && /اختر|اختار|اختاري|اختاري/.test(normalizeArabic(raw)) && !(b.options || []).length) continue;
        if (b.kind === 'table' && !(b.rows || []).length) continue;
        if (b.kind === 'match-pairs' && !(b.pairs || []).length) continue;
        const key = normalizeArabic(raw);
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push({
          id: `${lesson.id}-${pool.length}`,
          kind: b.kind,
          field: KIND_FIELD[b.kind],
          prompt: raw.slice(0, 240),
          options: (b.options || []).length ? b.options.map(clean).slice(0, 5) : undefined,
          rows: b.kind === 'table' ? (b.rows || []).slice(0, 6) : undefined,
          columns: b.kind === 'table' ? (b.columns || []) : undefined,
          pairs: b.kind === 'match-pairs' ? (b.pairs || []).slice(0, 6) : undefined,
          points: Number(b.points) || (b.kind === 'table' || b.kind === 'match-pairs' ? 4 : b.kind === 'textarea' || b.kind === 'drawing' ? 3 : 2),
          source: `${gradeId}/${sid}/${lesson.id}`,
          period: lesson.period || null
        });
      }
    }
  }
  return pool;
}

export function buildExam(gradeId, seed, size = 8) {
  const rng = mulberry32(seed >>> 0);
  const pool = collectGradeQuestions(gradeId);
  if (!pool.length) return null;
  // نفضّل درسًا واحدًا (اختبار منسجم) ثم نكمل من نفس الفترة عند الحاجة
  const lessons = [...new Set(pool.map((q) => q.source.split('/')[2]))];
  const anchorLesson = lessons[Math.floor(rng() * lessons.length) % lessons.length];
  const anchors = pool.filter((q) => q.source.endsWith('/' + anchorLesson));
  const chosen = [];
  const used = new Set();
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  for (const q of shuffle(anchors)) { if (chosen.length >= size) break; chosen.push(q); used.add(q.id); }
  if (chosen.length < size) {
    const others = shuffle(pool).filter((q) => !used.has(q.id));
    for (const q of others) { if (chosen.length >= size) break; chosen.push(q); }
  }
  const periods = chosen.map((q) => q.period).filter(Boolean);
  const period = periods.length ? periods.sort((a, b) => a - b)[0] : null;
  const copy = (x) => ({ ...x });
  return {
    examId: `EX-${gradeId}-${seed >>> 0}`,
    gradeId,
    period,
    title: `اختبار${period ? ` الفترة ${period}` : ''} — نسخة ${seed % 97 + 1}`,
    items: chosen.map(copy),
    totalPoints: chosen.reduce((s, q) => s + q.points, 0),
    answersExposed: false,
    gradingNote: 'التصحيح: مقارنة بالنموذج الشفوي للدرس أو إرسال للمعلّم عبر «أرسل للمعلم»'
  };
}
