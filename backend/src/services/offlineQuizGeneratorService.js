// ===== مولّد الأسئلة من البنك المحلي — يعمل بلا إنترنت نهائياً =====
//
// فكرة #15 (Offline Intelligent Tutor) من زاوية التقويم: في المدارس دون
// اتصال مستقر، تولّد الخوارزمية اختبارات من بنك الأسئلة المحلي المدمج
// (templates-bank + question-bank + أسئلة الكراس) بلا أي نداء خارجي.
//
// التوليد حتمي عند تمرير seed — نفس المدخلات تعيد نفس الاختبار.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM = path.join(__dirname, '..', '..', 'curriculum');

// خريطة أكواد المواد إلى تصنيفات البنك
const SUBJECT_CATEGORIES = {
  math: ['numbers', 'custom'],
  anisi: ['reading'],
  reading: ['reading'],
  arabic: ['reading'],
  production: ['writing'],
  writing: ['writing']
};

function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts) {
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function shuffled(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** يحوّل سؤال بنك إلى صيغة أسئلة المنصة الموحدة */
function toPlatformQuestion(raw, idx, rand) {
  const id = `gen${idx + 1}`;
  const points = 1;
  if (raw.type === 'tf') {
    return {
      id,
      type: 'TRUE_FALSE',
      prompt: raw.prompt_ar || raw.prompt || '',
      points,
      correctAnswer: raw.correct ? 'TRUE' : 'FALSE'
    };
  }
  // mcq / complete — خيارات نصية مع فهرس الإجابة
  const options = Array.isArray(raw.options) ? raw.options.map(String) : [];
  if (!options.length) return null;
  const correctIdx = Number.isFinite(Number(raw.correct)) ? Number(raw.correct) : 0;
  const correctText = options[correctIdx] ?? options[0];
  // خلط الخيارات مع تتبع الجواب الصحيح في موضعه الجديد
  const shuffledOptions = shuffled(options, rand);
  const newIdx = shuffledOptions.findIndex((o) => o === correctText);
  return {
    id,
    type: 'MCQ',
    prompt: raw.prompt_ar || raw.prompt || '',
    options: shuffledOptions,
    correctOption: newIdx >= 0 ? newIdx : 0,
    points
  };
}

/**
 * يولّد ورقة اختبار من البنك المحلي.
 * subject: math | anisi | reading | production ...
 * gradeId: year1 (البنك الحالي) — قابل للتوسيع بإضافة بنوك سنوات.
 */
export function generateOfflineQuiz({ gradeId = 'year1', subject = 'math', count = 10, seed = null } = {}) {
  const bankDir = path.join(CURRICULUM, gradeId);
  const templatesPath = path.join(bankDir, 'templates-bank.json');
  const qbPath = path.join(bankDir, 'question-bank.json');

  const candidates = [];

  if (fs.existsSync(templatesPath)) {
    const bank = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    const templates = Array.isArray(bank) ? bank : bank.templates || [];
    const wantedCategories = SUBJECT_CATEGORIES[subject] || [];
    for (const tpl of templates) {
      if (wantedCategories.length && !wantedCategories.includes(tpl.category)) continue;
      for (const q of tpl.questions || []) {
        candidates.push({ ...q, _source: `بنك القوالب: ${tpl.title}` });
      }
    }
  }

  if (fs.existsSync(qbPath)) {
    const qb = JSON.parse(fs.readFileSync(qbPath, 'utf8'));
    const qbCategories = subject === 'math' ? ['numbers'] : subject === 'anisi' || subject === 'reading' ? ['letters', 'vocab'] : [];
    for (const cat of qbCategories) {
      for (const q of qb[cat] || []) {
        candidates.push({ ...q, type: 'mcq', _source: `بنك الأسئلة: ${cat}` });
      }
    }
  }

  if (!candidates.length) {
    return { count: 0, questions: [], note: 'لا أسئلة مطابقة في البنك المحلي لهذه المادة.' };
  }

  const rand = seed != null ? seededRandom(hashSeed(seed, gradeId, subject)) : seededRandom(Date.now() >>> 0);
  const picked = shuffled(candidates, rand).slice(0, Math.max(1, Math.min(count, candidates.length)));

  const questions = [];
  picked.forEach((raw, i) => {
    const q = toPlatformQuestion(raw, i, rand);
    if (q) questions.push(q);
  });

  return {
    count: questions.length,
    source: 'بنك محلي مدمج — يعمل بلا إنترنت',
    seed: seed ?? null,
    questions
  };
}