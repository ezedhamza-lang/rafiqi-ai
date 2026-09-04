import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANK_PATH = path.join(__dirname, '../../content/banks/official-exams-bank.json');

const QUESTION_TYPES = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'TRUE_FALSE',
  ORDER: 'ORDER',
  EXTRACT: 'EXTRACT',
  FILL_BLANK: 'FILL_BLANK',
  OPEN: 'OPEN'
};

const MASTERY_KEYS = { none: 'none', below: 'below', min: 'min', max: 'max' };
const MASTERY_LABELS = {
  none: 'انعدام التملك',
  below: 'دون التملك الأدنى',
  min: 'التملك الأدنى',
  max: 'التملك الأقصى'
};

function normalizeArabic(text) {
  return String(text ?? '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[،,.;؛]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

let cache = null;

export function loadOfficialExamBank() {
  if (cache) return cache;
  if (!fs.existsSync(BANK_PATH)) {
    cache = { exams: [] };
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
  } catch {
    cache = { exams: [] };
  }
  return cache;
}

export function listBankExams({ level, subject, trimester } = {}) {
  const bank = loadOfficialExamBank();
  return (bank.exams || []).filter((e) => {
    if (level && e.level !== level) return false;
    if (subject && e.subject !== subject) return false;
    if (trimester !== undefined && trimester !== null && trimester !== '' && Number(e.trimester) !== Number(trimester)) return false;
    return true;
  });
}

export function getBankExam(id) {
  return loadOfficialExamBank().exams.find((e) => e.id === id) || null;
}

export function listBankSubjects() {
  const bank = loadOfficialExamBank();
  const map = new Map();
  for (const e of bank.exams || []) {
    const key = `${e.level}/${e.subject}`;
    if (!map.has(key)) map.set(key, { level: e.level, subject: e.subject, trimesters: new Set() });
    map.get(key).trimesters.add(e.trimester);
  }
  return [...map.values()].map((v) => ({ level: v.level, subject: v.subject, trimesters: [...v.trimesters].sort((a, b) => a - b) }));
}

export function listBankLevels() {
  const bank = loadOfficialExamBank();
  const levels = new Set((bank.exams || []).map((e) => e.level));
  return [...levels];
}

export function sanitizeBankExamForStudent(bankExam) {
  return {
    ...bankExam,
    questions: (bankExam.questions || []).map((q) => {
      const clean = { ...q };
      delete clean.correct;
      delete clean.correctAnswer;
      delete clean.orderItems;
      return clean;
    })
  };
}

/**
 * يبني محتوى الاختبار من قالب البنك (bankExam) + سياق ديناميكي (context)
 * خاص بالمستخدم/المدرسة الحالية وقت الإنشاء الفعلي.
 *
 * ⚠️ ملاحظة مهمة: بنك الاختبارات (official-exams-bank.json) هو قالب محتوى
 * دائم (سندات + أسئلة) فقط. لا يجب أبدًا تخزين اسم مدرسة أو معلّم أو سنة
 * دراسية داخل ملف البنك نفسه — هذه بيانات ظرفية تتغيّر كل سنة ومع كل
 * مستخدم، ويجب أن تُمرَّر ديناميكيًا من سياق الطلب (req.user، أو بيانات
 * المدرسة/القسم المرتبطة به) عند الإنشاء الفعلي، كما هو موضّح في مثال
 * الاستدعاء داخل routes/teacherContent.js.
 */
export function buildExamContent(bankExam, context = {}) {
  return {
    header: 'الجمهورية التونسية — وزارة التربية',
    school: context.school || '',
    date: context.schoolYear || '',
    durationMinutes: bankExam.durationMinutes || 45,
    totalPoints: bankExam.totalPoints || 20,
    source: bankExam.source || '',
    criteria: (bankExam.criteria || []).map((c) => ({ id: c.id, label: c.label, mastery: c.mastery })),
    passages: bankExam.passages || [],
    questions: (bankExam.questions || []).map((q, i) => ({
      id: q.id || `q${i + 1}`,
      criterion: q.criterion,
      type: q.type,
      prompt: q.prompt,
      ...(q.options ? { options: q.options } : {}),
      ...(q.correct !== undefined ? { correct: q.correct } : {}),
      ...(q.correctAnswer !== undefined ? { correctAnswer: q.correctAnswer } : {}),
      ...(q.orderItems ? { orderItems: q.orderItems } : {})
    }))
  };
}

export function examContentToBankShape(content) {
  const questions = Array.isArray(content?.questions) ? content.questions : [];
  const closedWithKeys = questions.filter((q) => q.type !== QUESTION_TYPES.OPEN && (q.correct !== undefined || q.correctAnswer !== undefined || q.orderItems));
  return {
    canAutoCorrect: closedWithKeys.length > 0,
    totalAutoQuestions: closedWithKeys.length,
    totalQuestions: questions.length,
    criteria: Array.isArray(content?.criteria) ? content.criteria : [],
    totalPoints: Number(content?.totalPoints) || 20
  };
}

function gradeClosedQuestion(question, answer) {
  const type = question.type;
  let correct = false;

  switch (type) {
    case QUESTION_TYPES.MCQ:
      correct = String(answer ?? '') === String(question.correct ?? '');
      break;
    case QUESTION_TYPES.TRUE_FALSE:
      correct = normalizeArabic(answer) === normalizeArabic(question.correctAnswer ?? '');
      break;
    case QUESTION_TYPES.ORDER: {
      const expected = (question.orderItems || []).map((i) => normalizeArabic(i));
      const given = Array.isArray(answer) ? answer.map((a) => normalizeArabic(a)) : [];
      correct = expected.length > 0 && expected.length === given.length && expected.every((v, i) => v === given[i]);
      break;
    }
    case QUESTION_TYPES.EXTRACT:
    case QUESTION_TYPES.FILL_BLANK: {
      const expected = String(question.correctAnswer ?? '').split('|').map(normalizeArabic).filter(Boolean);
      correct = expected.some((v) => v === normalizeArabic(answer));
      break;
    }
    default:
      correct = false;
  }
  return correct;
}

function masteryFromRatio(ratio, mastery) {
  if (ratio <= 0) return MASTERY_KEYS.none;
  if (ratio >= 1) return MASTERY_KEYS.max;
  if (ratio >= 0.5) return MASTERY_KEYS.min;
  return MASTERY_KEYS.below;
}

export function gradeOfficialExam(content, answers = {}) {
  const criteria = Array.isArray(content?.criteria) ? content.criteria : [];
  const questions = Array.isArray(content?.questions) ? content.questions : [];

  const byCriterion = new Map();
  for (const q of questions) {
    const key = q.criterion || 'معـ1';
    if (!byCriterion.has(key)) byCriterion.set(key, []);
    byCriterion.get(key).push(q);
  }

  const criterionResults = criteria.map((criterion) => {
    const group = byCriterion.get(criterion.id) || [];
    const closed = group.filter((q) => q.type !== QUESTION_TYPES.OPEN);
    const open = group.filter((q) => q.type === QUESTION_TYPES.OPEN);

    let masteryKey = null;
    let earned = 0;
    let correctCount = 0;
    let autoCorrected = false;

    if (closed.length > 0) {
      autoCorrected = true;
      for (const q of closed) {
        if (gradeClosedQuestion(q, answers[q.id])) correctCount += 1;
      }
      const ratio = correctCount / closed.length;
      masteryKey = masteryFromRatio(ratio, criterion.mastery);
      earned = criterion.mastery[masteryKey] ?? 0;
    }

    return {
      criterion: criterion.id,
      label: criterion.label,
      mastery: criterion.mastery,
      closedQuestions: closed.length,
      openQuestions: open.length,
      correctCount,
      autoCorrected,
      masteryKey,
      masteryLabel: masteryKey ? MASTERY_LABELS[masteryKey] : 'تقويم يدوي',
      earned
    };
  });

  const totalMax = criteria.reduce((s, c) => s + (c.mastery.max ?? 0), 0);
  const total = criterionResults.reduce((s, r) => s + r.earned, 0);
  const manualCriteria = criterionResults.filter((r) => !r.autoCorrected);

  return {
    criteria: criterionResults,
    total,
    totalMax: totalMax || 20,
    percent: totalMax ? Math.round((total / totalMax) * 100) : 0,
    manualCriteria: manualCriteria.map((r) => ({ criterion: r.criterion, label: r.label })),
    needsManualGrading: manualCriteria.length > 0
  };
}

export function officialExamSummary(content) {
  const shape = examContentToBankShape(content);
  return {
    ...shape,
    totalPoints: Number(content?.totalPoints) || 20,
    passages: (content?.passages || []).length,
    durationMinutes: content?.durationMinutes || 45
  };
}

/**
 * يحفظ امتحانًا مولّدًا بالذكاء الاصطناعي في بنك الاختبارات الرسمية
 * لإعادة استخدامه لاحقًا دون اتصال. يتجنب التكرار عبر المعرف.
 * يعيد true عند الحفظ، false إذا كان موجودًا مسبقًا أو تعذّر الحفظ.
 */
export function saveAiExamToBank(bankExam) {
  try {
    if (!bankExam || !bankExam.id) return false;
    const bank = loadOfficialExamBank();
    const exams = Array.isArray(bank.exams) ? bank.exams : [];
    if (exams.some((e) => e.id === bankExam.id)) return false;
    exams.push(bankExam);
    bank.exams = exams;
    cache = bank;
    fs.writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}
