import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeArabic } from './curriculumService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const METHODOLOGIES_DIR = path.join(__dirname, '../../curriculum/shared/methodologies');

/**
 * بروفايلات المنهجية الرسمية — مصدر الحقيقة لكل مزيج (سنة × مادة × نوع درس).
 * القواعد مرتّبة من الأكثر تحديدًا إلى الأعمّ، ويتم اختيار البروفايل المناسب
 * تلقائيًا حسب (السنة × المادة × نوع الدرس) كما يلي:
 *   1) تطابق كامل: سنة + مادة + نوع درس
 *   2) تراجع إلى سنة + مادة فقط (يُقبل فقط إذا كانت النتيجة وحيدة بلا غموض)
 *   3) خطأ AMBIGUOUS_METHODOLOGY إذا طابقت عدة بروفايلات دون تحديد نوع الدرس
 *   4) خطأ NO_METHODOLOGY إن لم يطابق أي بروفايل
 */
const RULES = [
  { year: '1', subject: 'قراءة', lessonType: 'تعلّم حرف جديد', file: 'year1-reading-mixed-method.json' },
  { year: '1', subject: 'رياضيات', file: 'year1-math-standard.json' },
  { year: '1', subject: 'إيقاظ علمي', file: 'year1-science-awakening.json' },
  { year: '1', subject: 'إنتاج كتابي', file: 'year1-writing-production.json' },
  { year: '2', subject: 'قراءة', lessonType: 'نص سردي أو شعري', file: 'year2-reading-narrative.json' },
  { year: '2', subject: 'إيقاظ علمي', file: 'year2-science-awakening.json' },
  { year: '2', subject: 'إنتاج كتابي', file: 'year2-writing-narrative.json' },
  { year: '4', subject: 'رياضيات', file: 'year4-math-standard.json' },
  { subject: 'تواصل شفوي', file: 'oral-communication-standard.json' }
];

const YEAR_WORDS = {
  'الاولي': '1',
  'الثانية': '2',
  'الثالثة': '3',
  'الرابعة': '4',
  'الخامسة': '5',
  'السادسة': '6'
};

/**
 * توحيد اسم المادة قبل المقارنة: إزالة الهمزات المختلفة، توحيد المسافات،
 * حذف "ال" التعريف — بحيث "الإيقاظ العلمي" تُطابق "إيقاظ علمي" مهما كتبها المعلّم.
 */
export function normalizeSubject(subject) {
  const norm = normalizeArabic(subject);
  return norm
    .replace(/ال(?=[\u0621-\u064A])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readProfile(file) {
  const abs = path.join(METHODOLOGIES_DIR, file);
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * استخراج رقم السنة من سلسلة المستوى (مثال: "السنة الأولى أساسي" → "1").
 * يدعم الأسماء العربية والمكتوبة بالأرقام على حدّ سواء.
 */
export function extractYear(level) {
  const norm = normalizeArabic(level || '');
  const wordMatch = norm.match(/السنه\s+(الاولي|الثانية|الثالثة|الرابعة|الخامسة|السادسة)/);
  if (wordMatch) return YEAR_WORDS[wordMatch[1]];
  const digitMatch = norm.match(/السنه\s*(\d)/);
  if (digitMatch) return digitMatch[1];
  const standaloneMatch = norm.match(/^\s*(\d)\s*$/);
  if (standaloneMatch) return standaloneMatch[1];
  return null;
}

function listRuleCandidates({ subject, year }) {
  const subj = normalizeSubject(subject);
  return RULES.filter((r) => {
    const yearMatch = !r.year || (year && r.year === year);
    return yearMatch && normalizeSubject(r.subject) === subj;
  });
}

export class MethodologyError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'MethodologyError';
    this.code = code;
    this.details = details;
  }
}

/**
 * يحدّد البروفايل المناسب حسب (السنة × المادة × نوع الدرس).
 * يرمي MethodologyError برمز AMBIGUOUS_METHODOLOGY أو NO_METHODOLOGY عند التعذّر.
 */
export function resolveMethodology({ subject, level, lessonType }) {
  const year = extractYear(level);
  const candidates = listRuleCandidates({ subject, year });

  const typeNorm = lessonType ? normalizeArabic(lessonType) : null;
  const exact = candidates.filter(
    (r) => r.lessonType && typeNorm && normalizeArabic(r.lessonType) === typeNorm
  );
  if (exact.length === 1) return readProfile(exact[0].file);

  if (candidates.length === 1) return readProfile(candidates[0].file);

  if (candidates.length > 1) {
    throw new MethodologyError(
      'AMBIGUOUS_METHODOLOGY',
      `تطابق أكثر من منهجية واحدة لـ ${subject} — السنة ${year || '?'}. يرجى تحديد نوع الدرس بدقة أكبر.`,
      candidates.map((c) => ({ subject: c.subject, lessonType: c.lessonType || null, file: c.file }))
    );
  }

  throw new MethodologyError(
    'NO_METHODOLOGY',
    `لا توجد منهجية مُعرَّفة بعد لـ ${subject} — ${level || 'مستوى غير معروف'}.`
  );
}

/** قائمة كل بروفايلات المنهجية المتوفّرة (لملء قوائم الاختيار في الواجهة). */
export function listMethodologies() {
  if (!fs.existsSync(METHODOLOGIES_DIR)) return [];
  return fs
    .readdirSync(METHODOLOGIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      const content = readProfile(file);
      return {
        file,
        methodId: content?.methodId || file.replace(/\.json$/, ''),
        title: content?.title || file,
        appliesTo: content?.appliesTo || {},
        phases: (content?.phases || []).map((p) => p.name)
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'ar'));
}
