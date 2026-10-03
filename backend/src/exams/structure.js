// بنية الورقة — Structure Checks (MASTER PROMPT §4,§6,§7,§36 + مواصفة المشروع).
//
// هذه فحوصات **الخطّ** لا الـPrompt (قرار المستخدم: «لا زيادة عشوائية في الـPrompt؛
// أصلح الـPipeline نفسه»). ضمانات تُفرض حتميًّا قبل الاعتماد:
//   1) نصّ القراءة: طوله من ملف السنة (y3+ ≥ 10 أسطر) + تشكيل تام لغويًّا + §C9: 120-200 كلمة.
//   2) القراءة y3+: كل معيار يُقاس بفرصة صريحة — قرينة + تعليل + إبداء رأي.
//   3) تنوع الصيغ: لا هيمنة قالب واحد («اجب/اجب/اجب» ليس اختبارًا §36).
//   4) الإيقاظ: تعليل + اكتشف/أصلح الخطأ بصيغة صحيحة (§C7).
//   5) كاشف الصيغ من نصّ التعليمة + حدود §C11 وجدول التكرار.
//   6) قسم الحساب الذهني: شكله §A2/§C13/§D6 متى وُجد.
// كلها opt-in عبر opts.requireStructure (مسار التوليد) — نمط requireCount نفسه،
// فلا تتغيّر وحدات الاختبار القائمة التي تتقدّم بفرضياتها الخاصة.

import { normalizeArabic } from '../services/curriculumService.js';

/** علامات التشكيل العربية: تنوين + حركات + سكون + شدة + ألف خنجرية (§ضبط). */
const TASHKEEL_RE = /[\u064B-\u0652\u0670]/g;
const AR_LETTERS_RE = /[\u0621-\u064A]/g;

/**
 * نسبة التشكيل في نصّ: علامات التشكيل ÷ حروف عربية.
 * نصّ مشكّل تشكيلًا تامًّا ≈ 0.35 فما فوق؛ نصّ مجرّد ≈ صفر.
 * @param {string} text
 * @returns {number} [0..~1]
 */
export function tashkeelRatio(text) {
  const s = String(text || '');
  const letters = s.match(AR_LETTERS_RE) || [];
  if (!letters.length) return 0;
  const marks = s.match(TASHKEEL_RE) || [];
  return marks.length / letters.length;
}

/** عدد أسطر النصّ الفعلية (غير الفارغة) — النصّ يُكتب سطرًا سطرًا كورقة الرسم. */
export function countLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .length;
}

/**
 * عدد كلمات النصّ بعد إزالة التشكيل والتطويل (§C9) — التشكيل يقطع الكلمة إلى
 * كتل حرفية فلا يُعدَّ بها (كان يعطي 469 بدل 131 على نصّ تجريبي).
 */
export function countWords(text) {
  const s = String(text || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '');
  return (s.match(/[\u0621-\u064Aa-zA-Z]+/g) || []).length;
}

/**
 * 1) جودة نصّ القراءة (§6,§7 MASTER): الطول من ملف السنة + التشكيل التام.
 * يُطبَّق فقط على موادها نصّية (textStimulus) — جدول/مثير رياضي أو مرئي لا يُقاس بسطر قراءة.
 * @returns {Array<{severity:string, code:string, message:string}>}
 */
export function checkStimulusText({ stimuli = [], gradeProfile = {}, subjectProfile = null } = {}) {
  const issues = [];
  if (!subjectProfile || subjectProfile.textStimulus !== true) return issues;
  const minLines = Number(gradeProfile.minStimulusLines) || 0;
  const minTash = Number(subjectProfile.minTashkeelRatio) || 0;
  const gradeLabel = gradeProfile.label || gradeProfile.id || '';

  stimuli.forEach((s, i) => {
    const text = String(s?.text || '');
    const lines = countLines(text);
    if (minLines && lines < minLines) {
      issues.push({
        severity: 'error',
        code: 'TEXT_TOO_SHORT',
        message: `المثير ${i + 1}: نصّه ${lines} سطرًا والمطلوب ≥ ${minLines} أسطر في ${gradeLabel} — نصّ قراءة يقرأه التلميذ فعليًّا، أوزّعه على أسطر (§6)`
      });
    }
    if (minTash > 0) {
      const ratio = tashkeelRatio(text);
      if (ratio < minTash) {
        issues.push({
          severity: 'error',
          code: 'TASHKEEL_MISSING',
          message: `المثير ${i + 1}: نسبة التشكيل ${Math.round(ratio * 100)}% والمطلوب ≥ ${Math.round(minTash * 100)}% — تشكيل لغوي دقيق لا تشكيل آلي سطحي (§7)`
        });
      }
    }
    // §C9 (شريحة ٥): نصّ القراءة 120-200 كلمة — نطاق مُعزل حتى لا يكون السند
    // خُطًّا مقطّعًا ولا سندًا زائدًا عن قراءة الصفّ. القراءة فقط (قيد المواصفة).
    const minWords = Number(gradeProfile.minStimulusWords) || 0;
    const maxWords = Number(gradeProfile.maxStimulusWords) || 0;
    if (subjectProfile.id === 'reading' && (minWords || maxWords)) {
      const words = countWords(text);
      if (minWords && words < minWords) {
        issues.push({
          severity: 'error',
          code: 'WORDS_RANGE',
          message: `المثير ${i + 1}: نصّه ${words} كلمة والمطلوب ${minWords}-${maxWords || '…'} كلمة — نصّ قراءة حقيقي يغطّي حدثًا كاملًا (§C9)`
        });
      } else if (maxWords && words > maxWords) {
        issues.push({
          severity: 'warn',
          code: 'TEXT_TOO_LONG',
          message: `المثير ${i + 1}: نصّه ${words} كلمة وأقصى طول ${maxWords} — أغلِف الطول الزائد أو اقطعه إلى مقطعين (§C9)`
        });
      }
    }
  });
  return issues;
}

/** كلمات مفتاحية لكل فرصة قياس إلزامية في القراءة (§8,§9,§10). */
const READING_ITEM_PATTERNS = {
  evidence: /قرين|عبارة تدل|يبيّن من النص|يُبين من النص|استخرج من النص|دليل من النص/,
  justification: /علّل|علل|لماذا|فسّر|برّر|اذكر السبب/,
  opinion: /رأيك|رأيي|ما رأيك|توافق|هل مررت|ماذا كنت|ماذا ترى/
};
const READING_ITEM_LABELS = {
  evidence: 'سؤال قرينة من النص (استدلال §9)',
  justification: 'سؤال تعليل/لماذا (§8)',
  opinion: 'سؤال إبداء رأي (§10)'
};

/**
 * 2) فرص القياس الإلزامية في مادة القراءة (y3+): قرينة + تعليل + رأي.
 * «هل كان سعيدًا؟» بلا قرينة لا يقيس استدلالًا (§9)؛ الرأي بلا «علّل» شكلٌ فارغ (§10).
 */
export function checkReadingItems({ questions = [], gradeProfile = {}, subjectProfile = null } = {}) {
  const issues = [];
  if (subjectProfile?.id !== 'reading') return issues;
  const required = Array.isArray(gradeProfile.readingItems) ? gradeProfile.readingItems : [];
  if (!required.length) return issues;

  const allPrompts = questions.map((q) => normalizeArabic(String(q.prompt || '')));
  required.forEach((kind) => {
    const pattern = READING_ITEM_PATTERNS[kind];
    if (!pattern) return;
    const hit = allPrompts.some((p) => pattern.test(p));
    if (!hit) {
      issues.push({
        severity: 'error',
        code: 'READING_ITEM_MISSING',
        message: `لا يوجد ${READING_ITEM_LABELS[kind]} في اختبار القراءة — كل معيار يُقاس بفرصة صريحة (§27 MASTER)`
      });
    }
  });
  return issues;
}

/**
 * 3) تنوع الصيغ (§4,§36): الاختبار كله قالب واحد = قياس أحادي.
 * - خطأ: ≥5 أسئلة وعدد الصيغ <3 (هيمنة حقيقية).
 * - تنبيه: ≥6 أسئلة وعدد الصيغ <4، أو صيغة واحدة تتجاوز 60%.
 * @returns {{issues:Array, table:string, distinct:number, total:number}}
 */
export function checkFormatVariety(questions = []) {
  const issues = [];
  const counts = {};
  questions.forEach((q) => {
    const t = String(q?.type || 'UNKNOWN');
    counts[t] = (counts[t] || 0) + 1;
  });
  const total = questions.length;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const distinct = entries.length;
  const table = entries.map(([t, c]) => `${t}×${c}`).join(' · ');
  if (!total) return { issues, table, distinct, total };

  const [topType, topCount] = entries[0];
  const share = topCount / total;

  if (total >= 5 && distinct < 3) {
    issues.push({
      severity: 'error',
      code: 'FORMAT_MONOTONY',
      message: `${distinct} صيغة فقط في ${total} أسئلة (هيمنة «${topType}» ${Math.round(share * 100)}%) — التنويع شرط قياس لا زينة (§4,§36)`
    });
  } else if (total >= 6 && distinct < 4) {
    issues.push({
      severity: 'warn',
      code: 'FORMAT_SPARSE',
      message: `${distinct} صيغ فقط في ${total} أسئلة — نوّع: اختر/ضع علامة/رتّب/اربط/استخرج/علّل/قرينة/رأي (§4)`
    });
  }
  if (total >= 6 && share > 0.6) {
    issues.push({
      severity: 'warn',
      code: 'FORMAT_DOMINANT',
      message: `صيغة «${topType}» تشغل ${Math.round(share * 100)}% من الأسئلة — أعد التوزيع (§36)`
    });
  }
  return { issues, table, distinct, total };
}

/** تطبيع للتطابق الحرفي: تشكيل + همزات + ترقيم + علامات + مسافات. */
function normForLeak(s) {
  return String(s || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 4) §D11 (قرار المستخدم): لا يكشف سؤال لاحق إجابة سؤال سابق بشكل مباشر.
 * الشروط المنطقية لمنع الإيجابي الكاذب:
 *   - الإجابة نصّية ≥5 أحرف بعد التطبيع (القصيرة «صواب/خطأ» ليست كشفًا).
 *   - الأرقام المحضة مستثناة: اشتقاقها من معطيات السند سلسلة حلّ مشروعة.
 *   - الإجابة غير موجودة في أي سند: إجابات الملء/الاستخراج من السند متاحة
 *     للطالب من النصّ أصلًا فلا «يكشف» لها سؤال لاحق.
 * @returns {Array<{severity, code, message, qIndex}>}
 */
export function checkAnswerChain(questions = [], stimuli = []) {
  const issues = [];
  const stimText = normForLeak(stimuli.map((s) => s?.text || '').join(' \n '));
  questions.forEach((q, j) => {
    if (!q) return;
    const later = normForLeak(q.prompt) + ' \n ' + normForLeak((q.options || []).join(' \n '));
    if (!later.trim()) return;
    for (let i = 0; i < j; i++) {
      const prev = questions[i] || {};
      const answers = [prev.correctAnswer, ...(Array.isArray(prev.acceptedAnswers) ? prev.acceptedAnswers : [])];
      for (const raw of answers) {
        const a = normForLeak(raw);
        if (a.length < 5) continue;                 // قصير/عام: ليس كشفًا
        if (/^\d+$/.test(a)) continue;              // رقم محض: سلسلة حلّ مشروعة
        if (stimText.includes(a)) continue;         // متاح من السند أصلًا
        if (later.includes(a)) {
          issues.push({
            severity: 'error',
            code: 'ANSWER_CHAIN_LEAK',
            message: `السؤال ${j + 1}: يعيد إجابة السؤال ${i + 1} «${raw}» في متنها أو خياراتها — لا يجوز أن يكشف سؤال لاحق إجابة سؤال سابق (§D11)`,
            qIndex: j
          });
          return;                                   // إشارة واحدة لكل سؤال لاحق تكفي
        }
      }
    }
  });
  return issues;
}

/**
 * تطبيع لفحص اللغة التخطيطية: يزيل التشكيل والهمزات ويترك الرسوم (§ و:) كي تُكشف.
 * (التطبيع الحرفي normForLeak يحذف § والنقطة فلا يصلح لهذا الفحص.)
 */
function normMeta(s) {
  return String(s || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * قواعد كشف اللسان التخطيطي/المنهجي داخل سند يراه التلميذ (قرار المستخدم:
 * «تحديد المواقع ووظائف الحواس يجب ألا نجده في سند»). المصادر المرجعية لا
 * تُقال للتلميذ: إشارات المقاطع §، لسان الكفاءات/المعايير/المرتبة/المنهاج/
 * المؤشر/الأهداف، وصيغة هدف منهجي بعد النقطة («…: تحديد المواقع …»).
 */
const META_RULES = [
  { re: /§/, label: 'إشارة مقطع المواصفة (§…)' },
  { re: /كفاي|كفاء/, label: 'لسان الكفاءات' },
  { re: /معيار|معايير/, label: 'لسان المعايير' },
  { re: /مرتبه/, label: 'لسان المراتب' },
  { re: /منهاج/, label: 'ذكر المنهاج' },
  { re: /مؤشر/, label: 'لسان المؤشرات' },
  { re: /الهدف|الاهداف/, label: 'لسان الأهداف' },
  { re: /:\s*(?:تحديد|تمييز|استخراج|تفسير|استنتاج|تلخيص|فهم|وصف)(?=\s|$|[،.,])/, label: 'صيغة هدف منهجي بعد النقطة' }
];

/**
 * 5) السند بلسان التلميذ لا بلسان التخطيط: لا نصّ منهجي في عنوان السند أو
 *    غرضه أو متنّه (يُعرض كله للتلميذ). opt-in عبر requireStructure.
 * @returns {Array<{severity, code, message}>}
 */
export function checkStimulusMeta(stimuli = []) {
  const issues = [];
  const FIELDS = [['title', 'العنوان'], ['purpose', 'الغرض'], ['text', 'المتن']];
  stimuli.forEach((s, i) => {
    if (!s) return;
    FIELDS.forEach(([field, fieldLabel]) => {
      const value = s[field];
      if (!value) return;
      const norm = normMeta(value);
      const hit = META_RULES.find((r) => r.re.test(norm));
      if (hit) {
        issues.push({
          severity: 'error',
          code: 'STIMULUS_META',
          message: `السند ${i + 1} (${fieldLabel}): نصّ تخطيطي/منهجي — ${hit.label} — لا يُقال للتلميذ؛ أعد الصياغة بلسان التلميذ داخل السند نفسه`
        });
      }
    });
  });
  return issues;
}

// ── 6) الإيقاظ العلمي: تعليل + اكتشف/أصلح الخطأ (§C7 — شريحة ٣) ──────────

/** صيغة الإصلاح القوية (تُعدّ فرصة قياس) — بعد normMeta: أ→ا، ئ→ء، إزالة الشدّة. */
const STRONG_FIX = /اصلح|اشطب|تصريف خاط|صحح الخطا|تصحيح الخطا|تصرف خاط/;
/** صيغة ضعيفة وُثّقت بـ«0 نتيجة»: «أين الخطأ؟ صحّح العبارة» وحدها لا تقيس (§C7). */
const WEAK_FIX = /اين الخطا|صحح العبارة|صحح الجملة|صحح الكلمة|ما الخطا/;
/** تعليل بصيغة النصّ المطبَّع (normMeta: علل/فسر بلا شدّة). */
const SCI_JUST = /علل|لماذا|فسر|برر|اذكر السبب/;

/**
 * 6) محقّق الإيقاظ العلمي (§C7): فرصة تعليل + فرصة اكتشاف/إصلاح خطأ بصيغة
 * صحيحة. y1 مستثنى (allowedTypes بلا OPEN — الملف ملفّ السنة نفسها).
 * @returns {Array<{severity, code, message}>}
 */
export function checkScienceItems({ questions = [], gradeProfile = {}, subjectProfile = null } = {}) {
  const issues = [];
  if (subjectProfile?.id !== 'science') return issues;
  const required = Array.isArray(gradeProfile.scienceItems) ? gradeProfile.scienceItems : [];
  if (!required.length) return issues;

  const prompts = questions.map((q) => normMeta(q?.prompt));
  const hasJust = prompts.some((p) => SCI_JUST.test(p));
  const hasStrong = prompts.some((p) => STRONG_FIX.test(p));
  const hasWeak = prompts.some((p) => WEAK_FIX.test(p));

  if (required.includes('justification') && !hasJust) {
    issues.push({
      severity: 'error',
      code: 'MISSING_JUSTIFICATION',
      message: 'لا يوجد سؤال تعليل («علّل/لماذا/فسّر») في اختبار الإيقاظ — التعليل شرط قياس إلزامي في المادة (§C7)'
    });
  }
  if (required.includes('errorFix') && !hasStrong) {
    if (hasWeak) {
      issues.push({
        severity: 'error',
        code: 'ERROR_FIX_PHRASING',
        message: 'صيغة «أين الخطأ؟ صحّح العبارة» وحدها = 0 نتيجة (§C7) — أعِد الصياغة بصيغة إصلاح صريحة: «اكتب/تصرّف خاطئًا ثمّ أصلحه» أو «اشطب الخطأ»'
      });
    } else {
      issues.push({
        severity: 'error',
        code: 'MISSING_ERROR_FIX',
        message: 'لا يوجد سؤال اكتشاف/إصلاح خطأ في اختبار الإيقاظ — اطلب من التلميذ اكتشاف التصرّف الخاطئ ثمّ إصلاحه بصيغة «اكتب/تصرّف خاطئًا… أصلح/اشطب» (§C7)'
      });
    }
  } else if (hasStrong && hasWeak) {
    issues.push({
      severity: 'warn',
      code: 'ERROR_FIX_PHRASING',
      message: 'سؤال بصيغة «أين الخطأ؟ صحّح العبارة» بجوار صيغة الإصلاح القوية — أعد صياغته بصيغة «اكتب/تصرّف خاطئًا ثمّ أصلحه» (§C7)'
    });
  }
  return issues;
}

// ── 7) كاشف الصيغ من نصّ التعليمة + جدول التكرار (§C1,§C11 — شريحة ٤) ─────

/**
 * صيغة المهمّة كما يراها التلميذ في نصّ التعليمة (لا مجرّد نوع السؤال):
 * «فسّري…» تعليل، «ارسمي…» رسم، «اشرح…» شرح… — أساس جدول التكرار §C11.
 */
export function formatLabelOf(q) {
  const type = String(q?.type || '');
  const p = normMeta(q?.prompt);
  if (type === 'TRUE_FALSE') return 'صواب أم خطأ';
  if (type === 'ORDER') return 'ترتيب';
  if (type === 'MATCHING') return 'مطابقة';
  if (type === 'FILL_BLANK') return 'أكمل';
  if (type === 'EXTRACT') return 'استخراج';
  if (type === 'MCQ') {
    if (/ضع علامة/.test(p)) return 'ضع علامة';
    if (/اعرب/.test(p)) return 'أعرب';
    if (/فسر|علل|لماذا/.test(p)) return 'تعليل';
    return 'اختيار من متعدد';
  }
  if (type === 'OPEN') {
    if (/علل|لماذا|فسر|برر|اذكر السبب/.test(p)) return 'تعليل';
    if (/رايك|رايي|توافق|ماذا كنت|ماذا ترى/.test(p)) return 'إبداء رأي';
    if (/ارسم|مثيل/.test(p)) return 'رسم';
    if (/اشرح/.test(p)) return 'شرح';
    return 'تحرير';
  }
  return type || 'غير مصنّفة';
}

/**
 * 7) توزيع الصيغ حسب نصّ التعليمة + حدود §C11:
 * - تنبيه §C1: ورقة ≥7 أسئلة بأقلّ من 6 صيغ مختلفة (المتوسط التجريبي 7.9-8.7).
 * - حدود §C11 (العربية): «ضع علامة» ≤ 20%، «أعرب» ≤ 2%.
 * @returns {{issues:Array, table:string, distinct:number, total:number}}
 */
export function checkFormatLabels(questions = [], subject = '') {
  const issues = [];
  const counts = {};
  questions.forEach((q) => {
    const label = formatLabelOf(q);
    counts[label] = (counts[label] || 0) + 1;
  });
  const total = questions.length;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const distinct = entries.length;
  const table = entries.map(([l, c]) => `${l}×${c}`).join(' · ');
  if (!total) return { issues, table, distinct, total, counts };

  if (total >= 7 && distinct < 6) {
    issues.push({
      severity: 'warn',
      code: 'FORMAT_FEW_LABELS',
      message: `${distinct} صيغ فقط حسب نصّ التعليمة في ${total} أسئلة (المتوسط التجريبي 7.9-8.7، §C1) — جدول التكرار: ${table}`
    });
  }
  const subj = String(subject || '').toLowerCase();
  const isArabic = subj === 'arabic' || subj === 'اللغة العربية' || subj.includes('عرب');
  if (isArabic) {
    [['ضع علامة', 0.2], ['أعرب', 0.02]].forEach(([label, cap]) => {
      const share = (counts[label] || 0) / total;
      if (share > cap) {
        issues.push({
          severity: 'warn',
          code: 'FORMAT_LABEL_LIMIT',
          message: `صيغة «${label}» ${Math.round(share * 100)}% من الأسئلة والحدّ ${Math.round(cap * 100)}% (§C11) — جدول التكرار: ${table}`
        });
      }
    });
  }
  return { issues, table, distinct, total, counts };
}

// ── 8) قسم الحساب الذهني المستقل (§A2,§C13,§D6 — شريحة المصفوفة) ─────────

/**
 * شكل قسم الحساب الذهني المستقل: عنوانه صريح «الحساب الذهني»، ≤ 10 دقائق،
 * تنقيطه 0→4 وبقيّة الورقة 0→16 (§A2)، وعدد العمليات 4 في س1 و8 في س2-3 (§D6).
 * لا يُشترط غيابه — يُفحص متى وُجد قسم مُعلن أو أسئلة معلَّمة component=mental.
 * @returns {{ran:boolean, issues:Array}}
 */
export function checkMentalShape({ mentalMath = null, questions = [], targetPoints = 20 } = {}) {
  const flagged = (questions || []).filter((q) => q?.component === 'mental' || q?.mental === true);
  const ran = !!mentalMath || flagged.length > 0;
  const issues = [];
  if (!ran) return { ran, issues };

  if (mentalMath) {
    const title = String(mentalMath.title || '');
    if (!title.includes('الحساب الذهني')) {
      issues.push({
        severity: 'error',
        code: 'MENTAL_SHAPE',
        message: 'قسم الحساب الذهني بلا عنوانه الصريح «الحساب الذهني» — عنوان قسم مستقل لا يُدسّ في ورقه أخرى (§C13)'
      });
    }
    const minutes = Number(mentalMath.minutes) || 0;
    if (!minutes || minutes > 10) {
      issues.push({
        severity: 'error',
        code: 'MENTAL_SHAPE',
        message: `زمن قسم الحساب الذهني ${minutes || 'غير محدّد'} دقيقة والمقدّر ≤ 10 دقائق (§D6)`
      });
    }
    if (!flagged.length) {
      issues.push({
        severity: 'error',
        code: 'MENTAL_SHAPE',
        message: 'قسم الحساب الذهني مُعلن في المخطّط بلا أسئلة معلَّمة component=mental — إما ألغِ القسم أو املأه (§A2)'
      });
    }
  }
  if (flagged.length) {
    const pts = flagged.reduce((s, q) => s + (Number(q?.points) || 0), 0);
    const declared = Number(mentalMath?.points);
    const cap = declared || 4;
    if (pts !== cap) {
      issues.push({
        severity: 'error',
        code: 'MENTAL_SHAPE',
        message: `نقاط الحساب الذهني ${pts} والمطلوب ${cap} (تنقيطه 0→4 وبقيّة الورقة 0→16، §A2) — لا يُسمى قسم «4» وهو ${pts}`
      });
    }
    if (flagged.length > 12) {
      issues.push({
        severity: 'error',
        code: 'MENTAL_SHAPE',
        message: `${flagged.length} عملية حساب ذهني والمطلوب ≤ 12 (4 في س1 + 8 في س2-3، §D6)`
      });
    }
    const rest = (Number(targetPoints) || 20) - pts;
    if (rest <= 0) {
      issues.push({
        severity: 'error',
        code: 'MENTAL_SHAPE',
        message: 'قسم الحساب الذهني استهلك مجموع الورقة — بقيّة الأسئلة يجب أن تبقى 0→16 (§A2)'
      });
    }
  }
  return { ran, issues };
}
