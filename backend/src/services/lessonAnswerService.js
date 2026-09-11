import { getLessonPages } from './curriculumService.js';

/**
 * فحص وكشف إجابات كتاب التلميذ — server-side بالكامل.
 * الإجابة الصحيحة لا تغادر الخادم أبدًا إلا عبر reveal بعد محاولة مسجَّلة.
 */

const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };

export function normalizeAnswerText(text) {
  return String(text ?? '')
    .replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] || d)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[،؛:!؟«»"'()ـ.\-\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

function sameText(a, b) {
  const x = normalizeAnswerText(a);
  const y = normalizeAnswerText(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const nx = Number(x);
  const ny = Number(y);
  return Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

function findRawAnswer(block) {
  if (block.answer !== undefined && block.answer !== null) return block.answer;
  if (block.correctAnswer !== undefined && block.correctAnswer !== null) return block.correctAnswer;
  if (block.correct !== undefined && block.correct !== null) return block.correct;
  return null;
}

export function gradeBlockAnswer(block, answer) {
  const raw = findRawAnswer(block);
  if (raw === null) return { correct: false, graded: false };
  if (Array.isArray(raw) || Array.isArray(answer)) {
    const a = Array.isArray(answer) ? answer : String(answer).split(/[,،>|]/);
    const b = Array.isArray(raw) ? raw : String(raw).split(/[,،>|]/);
    if (a.length !== b.length) return { correct: false, graded: true };
    const ok = a.every((v, i) => sameText(v, b[i]));
    return { correct: ok, graded: true };
  }
  const options = Array.isArray(block.options) ? block.options : null;
  if (options && options.length) {
    const toIdx = (v) => {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 0 && n < options.length) return n;
      const f = options.findIndex((o) => sameText(o, v));
      return f;
    };
    const given = toIdx(answer);
    const want = toIdx(raw);
    if (want < 0) return { correct: sameText(answer, raw), graded: true };
    if (given < 0) return { correct: false, graded: true };
    return { correct: given === want, graded: true };
  }
  const alts = String(raw).split('|').map((s) => s.trim()).filter(Boolean);
  return { correct: alts.some((alt) => sameText(answer, alt)), graded: true };
}

export function resolveBlock(gradeId, subjectId, lessonId, blockId) {
  const pages = getLessonPages(subjectId, null, gradeId);
  const page = pages.find((p) => p.id === lessonId);
  if (!page) return null;
  const blocks = page.blocks || [];
  const m = String(blockId).match(/^b(\d+)$/);
  if (!m) return null;
  const idx = Number(m[1]);
  if (idx < 0 || idx >= blocks.length) return null;
  return { page, block: blocks[idx], index: idx };
}
