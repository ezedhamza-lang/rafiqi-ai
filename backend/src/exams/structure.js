// بنية الورقة — Structure Checks (MASTER PROMPT §4,§6,§7,§36 + مواصفة المشروع).
//
// هذه فحوصات **الخطّ** لا الـPrompt (قرار المستخدم: «لا زيادة عشوائية في الـPrompt؛
// أصلح الـPipeline نفسه»). ثلاثة ضمانات تُفرض حتميًّا قبل الاعتماد:
//   1) نصّ القراءة: طوله من ملف السنة (y3+ ≥ 10 أسطر) + تشكيل تام لغويًّا.
//   2) القراءة y3+: كل معيار يُقاس بفرصة صريحة — قرينة + تعليل + إبداء رأي.
//   3) تنوع الصيغ: لا هيمنة قالب واحد («اجب/اجب/اجب» ليس اختبارًا §36).
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
