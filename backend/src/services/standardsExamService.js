// ===== مولّد الامتحانات الرسمية حسب المعايير =====
//
// يبني امتحاناً بنيويّاً مطابقاً لنظام الاختبارات التونسية:
// - جدول معايير رسمي (مع1/مع2/تميّز) بمجموع 20 نقطة لكل مادة
// - أسئلة مولّدة إجرائياً (طازجة كل مرة) موزعة على المعايير
// - أسئلة الكتابة/الإنتاج حرة (تصحيح يدوي بعدد أسطر محدد)
//
// المصدر: جداول معايير ومؤشرات إسناد الأعداد (مصدر المستخدم) + توثيق
// نظام الاختبارات الرسمية (المعيار1=6، المعيار2=9، التميز=5 للإيقاظ).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GENERATORS, FREE_GENERATORS } from './standardsQuestionGenerators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STANDARDS_PATH = path.join(__dirname, '..', '..', 'curriculum', 'shared', 'exam-bank-standards.json');

// جداول المعايير الرسمية لكل مادة (س1 + س2) — كل جدول مجموعه 20
export const CRITERIA_PRESETS = {
  year1: {
    math: [
      { code: 'مع1', label: 'الأعداد: العد والقراءة والكتابة', max: 6, standards: ['std-013', 'std-014', 'std-015'] },
      { code: 'مع2', label: 'المقارنة والعمليات', max: 9, standards: ['std-016', 'std-017'] },
      { code: 'تم', label: 'الفضاء والقياس والأشكال (تميّز)', max: 5, standards: ['std-018', 'std-019', 'std-020', 'std-021', 'std-022'] }
    ],
    science: [
      { code: 'مع1', label: 'جسم الإنسان والفضاء والمادة', max: 6, standards: ['std-023', 'std-028', 'std-029'] },
      { code: 'مع2', label: 'التغذية والزمن والحركة', max: 9, standards: ['std-024', 'std-026', 'std-027'] },
      { code: 'تم', label: 'الكفايات المتقدمة (تميّز)', max: 5, standards: ['std-030', 'std-031', 'std-025'] }
    ],
    reading: [
      { code: 'مع1', label: 'الحروف والمقاطع', max: 8, standards: ['std-001', 'std-002'] },
      { code: 'مع2', label: 'قراءة الكلمات وفهم الجمل', max: 12, standards: ['std-003', 'std-004'] }
    ],
    production: [
      { code: 'مع1', label: 'ترتيب الصور وإكمال الجمل', max: 10, standards: ['std-010', 'std-011'], free: true },
      { code: 'مع2', label: 'التعبير عن صورة', max: 10, standards: ['std-012'], free: true }
    ],
    handwriting: [
      { code: 'مع1', label: 'رسم الحروف ونسخ الكلمات', max: 10, standards: ['std-005', 'std-006'], free: true },
      { code: 'مع2', label: 'الإملاء والتمييز الصوتي', max: 10, standards: ['std-008', 'std-009'], free: true }
    ]
  },

  // ============ السنة الثانية (س2) - 14 مادة ============
  year2: {
    // === العربية - قراءة ===
    reading: [
      { code: 'مع1', label: 'القراءة الجهرية', max: 6, standards: ['std2-rd-01', 'std2-rd-02', 'std2-rd-03'] },
      { code: 'مع2', label: 'معالجة النص', max: 9, standards: ['std2-rd-04', 'std2-rd-05', 'std2-rd-06'] },
      { code: 'تم', label: 'إبداء الرأي (تميّز)', max: 5, standards: ['std2-rd-07'] }
    ],
    // === العربية - قواعد لغة ===
    grammar: [
      { code: 'مع1', label: 'الجملة والاسم والفعل', max: 7, standards: ['std2-gr-01', 'std2-gr-02'] },
      { code: 'مع2', label: 'الإعراب والبناء', max: 8, standards: ['std2-gr-03', 'std2-gr-04'] },
      { code: 'تم', label: 'التميز في التحليل (تميّز)', max: 5, standards: ['std2-gr-05'] }
    ],
    // === العربية - إنتاج كتابي ===
    production: [
      { code: 'مع1', label: 'ترتيب الصور وسرد القصة', max: 10, standards: ['std2-pr-01', 'std2-pr-02'], free: true },
      { code: 'مع2', label: 'التعبير عن صورة/موقف', max: 10, standards: ['std2-pr-03'], free: true }
    ],
    // === العربية - خط وإملاء ===
    handwriting: [
      { code: 'مع1', label: 'جودة الخط والنسخ', max: 10, standards: ['std2-hw-01', 'std2-hw-02'], free: true },
      { code: 'مع2', label: 'الإملاء والتمييز الصوتي', max: 10, standards: ['std2-hw-03', 'std2-hw-04'], free: true }
    ],
    // === الفرنسية ===
    french: [
      { code: 'مع1', label: 'الاستماع والفهم الشفوي', max: 7, standards: ['std2-fr-01', 'std2-fr-02'] },
      { code: 'مع2', label: 'القراءة والفهم الكتابي', max: 8, standards: ['std2-fr-03', 'std2-fr-04'] },
      { code: 'تم', label: 'التعبير الكتابي (تميّز)', max: 5, standards: ['std2-fr-05'] }
    ],
    // === الرياضيات ===
    math: [
      { code: 'مع1', label: 'الأعداد حتى 999 والعمليات', max: 6, standards: ['std2-mt-01', 'std2-mt-02', 'std2-mt-03'] },
      { code: 'مع2', label: 'الجمع والطرح (بدون/مع احتفاظ)', max: 7, standards: ['std2-mt-04', 'std2-mt-05'] },
      { code: 'مع3', label: 'الهندسة والقياس', max: 4, standards: ['std2-mt-06', 'std2-mt-07'] },
      { code: 'تم', label: 'وضعيات إدماجية (تميّز)', max: 3, standards: ['std2-mt-08'] }
    ],
    // === الإيقاظ العلمي ===
    science: [
      { code: 'مع1', label: 'جسم الإنسان والحواس', max: 5, standards: ['std2-sc-01', 'std2-sc-02'] },
      { code: 'مع2', label: 'الكائنات الحية والبيئة', max: 5, standards: ['std2-sc-03', 'std2-sc-04'] },
      { code: 'مع3', label: 'المادة والطاقة والحركة', max: 5, standards: ['std2-sc-05', 'std2-sc-06'] },
      { code: 'تم', label: 'التميز العلمي (تميّز)', max: 5, standards: ['std2-sc-07'] }
    ],
    // === التربية الإسلامية ===
    islamic: [
      { code: 'مع1', label: 'الحفظ والتلاوة', max: 10, standards: ['std2-is-01', 'std2-is-02'], free: true },
      { code: 'مع2', label: 'الفهم والسلوك', max: 10, standards: ['std2-is-03', 'std2-is-04'], free: true }
    ],
    // === التربية المدنية ===
    civics: [
      { code: 'مع1', label: 'القواعد والواجبات', max: 10, standards: ['std2-cv-01', 'std2-cv-02'], free: true },
      { code: 'مع2', label: 'المواطنة والتعاون', max: 10, standards: ['std2-cv-03', 'std2-cv-04'], free: true }
    ],
    // === التكنولوجيا ===
    technology: [
      { code: 'مع1', label: 'الأدوات والمواد', max: 10, standards: ['std2-tc-01', 'std2-tc-02'], free: true },
      { code: 'مع2', label: 'التصميم والإنجاز', max: 10, standards: ['std2-tc-03', 'std2-tc-04'], free: true }
    ],
    // === الإعلامية ===
    ict: [
      { code: 'مع1', label: 'المكونات والوظائف', max: 10, standards: ['std2-ic-01', 'std2-ic-02'], free: true },
      { code: 'مع2', label: 'التعامل مع الحاسوب', max: 10, standards: ['std2-ic-03', 'std2-ic-04'], free: true }
    ],
    // === التربية التشكيلية ===
    art: [
      { code: 'مع1', label: 'الرسم والتعبير', max: 10, standards: ['std2-ar-01', 'std2-ar-02'], free: true },
      { code: 'مع2', label: 'التلوين والتركيب', max: 10, standards: ['std2-ar-03', 'std2-ar-04'], free: true }
    ],
    // === التربية الموسيقية ===
    music: [
      { code: 'مع1', label: 'الأناشيد والإيقاع', max: 10, standards: ['std2-mu-01', 'std2-mu-02'], free: true },
      { code: 'مع2', label: 'الآلات والغناء', max: 10, standards: ['std2-mu-03', 'std2-mu-04'], free: true }
    ],
    // === التربية البدنية ===
    pe: [
      { code: 'مع1', label: 'الحركات الأساسية', max: 10, standards: ['std2-pe-01', 'std2-pe-02'], free: true },
      { code: 'مع2', label: 'الألعاب والتعاون', max: 10, standards: ['std2-pe-03', 'std2-pe-04'], free: true }
    ]
  }
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

function loadStandards(level) {
  if (!fs.existsSync(STANDARDS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(STANDARDS_PATH, 'utf8'));
  return (data.standards || []).filter((s) => s.level === level);
}

/**
 * يولّد امتحاناً رسمياً كاملاً حسب معايير المادة.
 * يعيد ورقة ببنية النظام الرسمي: criteria[] + questions[] (كل سؤال موسوم بمعياره).
 */
export function generateStandardsExam({ gradeId = 'year1', subject = 'math', seed = null } = {}) {
  const preset = CRITERIA_PRESETS[gradeId]?.[subject];
  if (!preset) {
    return { error: `لا توجد جداول معايير مولِّدة بعد لـ ${gradeId}/${subject}.` };
  }

  const allStandards = loadStandards(gradeId);
  const stdLabel = (id) => {
    const s = allStandards.find((x) => x.id === id);
    return s ? `${s.domain} — ${s.criterion}` : id;
  };

  const rand = seededRandom(hashSeed(seed ?? Date.now(), gradeId, subject));
  const criteria = [];
  const questions = [];
  let qNum = 0;

  for (const crit of preset) {
    const perQuestionPoints = crit.free
      ? null
      : Math.max(1, Math.floor((crit.max * 2) / crit.standards.length)) / 2;

    for (const stdId of crit.standards) {
      qNum += 1;
      const gen = GENERATORS[stdId];
      const freeGen = FREE_GENERATORS[stdId];

      if (gen) {
        // سؤال موضوعي مولَّد إجرائياً
        const generated = gen(rand);
        const points = crit.free ? 0 : perQuestionPoints;
        questions.push({
          id: `q${qNum}`,
          num: qNum,
          type: 'MCQ',
          prompt: generated.prompt,
          options: generated.options,
          correctOption: generated.correctOption,
          points,
          criterion: crit.code,
          standardId: stdId,
          standardLabel: stdLabel(stdId)
        });
      } else if (freeGen) {
        // سؤال حر (تصحيح يدوي) — كتابة/إنتاج/إملاء
        const spec = freeGen();
        const points = crit.max / crit.standards.length;
        questions.push({
          id: `q${qNum}`,
          num: qNum,
          type: 'FREE',
          prompt: spec.prompt,
          freeLines: spec.freeLines || 2,
          points: Math.round(points * 2) / 2,
          criterion: crit.code,
          standardId: stdId,
          standardLabel: stdLabel(stdId)
        });
      }
    }

    criteria.push({ code: crit.code, label: crit.label, max: crit.max });
  }

  // ضبط دقيق: مجموع نقاط الأسئلة الموضوعية = مجموع maxima
  const totalMax = criteria.reduce((s, c) => s + c.max, 0);
  const objectiveSum = questions.filter((q) => q.type === 'MCQ').reduce((s, q) => s + q.points, 0);
  if (!crit_free_only(preset) && objectiveSum > 0) {
    const factor = (totalMax - freePoints(questions)) / objectiveSum;
    for (const q of questions) if (q.type === 'MCQ') Object.assign(q, { points: Math.round(q.points * factor * 2) / 2 });
  }

  return {
    gradeId,
    subject,
    totalScore: totalMax,
    criteria,
    questions,
    blueprintNote: 'امتحان مبني على المعايير الرسمية: كل سؤال موسوم بمعياره ومعياره المرجعي. الأسئلة الموضوعية مولّدة إجرائياً طازجة، وأسئلة الكتابة حرة التصحيح.',
    generatedAt: new Date().toISOString()
  };
}

function crit_free_only(preset) {
  return preset.every((c) => c.free);
}
function freePoints(questions) {
  return questions.filter((q) => q.type === 'FREE').reduce((s, q) => s + q.points, 0);
}