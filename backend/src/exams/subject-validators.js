// محقّقات المواد — Subject Validators (Spec §33-§34: عام ثم متخصص، PASS AND PASS).
//
// المحقّق العام (exam-pipeline) يمرّ أولًا: منهج/إجابات/غموض/عمر/صعوبة/تنقيط/لغة/
// نقاء المادة/تأصيل/نمط. ثم يأتي هذا المحقّق المتخصص حسب ملف المادة:
//   math     → وجود معطيات رقمية فعلية لا اختبار «رياضيات» بلا أرقام
//   reading  → أصل النصّ (نصّ مثير نصّي) + ترابط كل مهمة بالنصّ
//   science  → مثير مرصود + عدم انزلاقه إلى الحساب
//   language → ترابط المهمة بالمثير اللغوي
//   writing  → إنتاج فعلي + سجّة لا MCQ
// النتيجة النهائية: عام PASS **و** متخصص PASS → قابل للنشر.

import { getSubjectProfile } from './profiles/index.js';
import { toAsciiDigits } from './sind.js';

/**
 * إشارة حساب صريحة داخل نصّ (§55,§79): رقم ← عملية ← رقم، أو فعل حسابي صريح.
 * اختبار اللغة/القراءة/الإيقاظ لا يحويها: ظهورها = خلط المواد.
 * الفعل يجب أن يتبعه رقم («الجمعية 12» ليست حسابًا).
 * @returns {string|null} الإشارة أو null
 */
export function arithmeticSignal(raw) {
  const text = toAsciiDigits(String(raw || ''));
  const patterns = [
    /\d\s*[+−–—×÷*\/]\s*\d/,            // 12 + 8 ، 6 × 7 ، 24/4
    /\d\s*[+−–—×÷*\/]\s*(?:…|\.{3})/,   // أكمل: 3 + …
    /(?:…|\.{3})\s*=\s*\d/,             // … = 10
    /\d\s*=\s*\d/,                      // 5 = 5
    /(?:احسب|أنجز|الناتج|ناتج|المجموع|مجموع|طرح|قسمة|ضرب|جمع)[^\u0621-\u064A]{0,15}\d/ // «ما مجموع 120 و 45»
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0].trim();
  }
  return null;
}

const eqIssue = (severity, code, message, qIndex) => ({ severity, code, message, ...(qIndex !== undefined ? { qIndex } : {}) });

/** كلمات محتوى قابلة للتقاطع (تجاهل أدوات الاستفهام والأمر الشائعة). */
const STOP = new Set(['التي', 'هذا', 'هذه', 'إذا', 'ثم', 'عند', 'فيه', 'أنه', 'لكن', 'حيث', 'بعد', 'قبل', 'التي']);
function contentWords(text) {
  return String(text || '')
    // تشكيل أولًا (§7): النصّ المشكّل والسؤال المجرّد يُقاسان بالمعيار نفسه —
    // بدون هذا السطر تفرّم الحركاتُ كلمةَ النصّ إلى حروفٍ مفردة فيفشل الاستناد (§42)
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^ال/, ''))
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

/** هل يتقاطع نصّ المهمة مع لغة المثير (كلمة محتوى ≥ 4 أحرف)؟ */
function overlaps(qText, sText) {
  const sWords = new Set(contentWords(sText).map((w) => w.slice(0, 6)));
  return contentWords(qText).some((w) => sWords.has(w.slice(0, 6)) || [...sWords].some((s) => s.includes(w.slice(0, 5))));
}

function questionBody(q) {
  return [
    q.prompt,
    ...(Array.isArray(q.options) ? q.options : []),
    ...(Array.isArray(q.orderItems) ? q.orderItems : [])
  ].join(' \n ');
}

const SHAPE_HINT = /(مضلع|مثلث|مربع|دائرة|مستطيل|زاوية|مساحة|محيط|خط|نقطة)/;

// ————— فحوص الرياضيات الموسّعة (شريحة §B3 في مواصفة2026-10-03) —————
// قرار المستخدم: مدقّق موجَّه لا سؤال «هل توجد الهندسة؟»:
//   هندسة6 نقاط (في التعلمات؟ يقيس خاصية؟ مساحة رسم؟ مستوى السنة → OUT_OF_SCOPE)
//   نقود4 نقاط (في الوحدة؟ مهارة فعلية؟ قيم صحيحة؟ قطعة وظيفة لها في الحل)
//   ربط السندات: سند1 ← ≥4 أسئلة ← سند2 يكمله سياقيًّا (§D5)
//   مساحة مستقلة للعملية العمودية (§D12) + إسناد معيار رسمي لكل سؤال (§B2)
// كلها opt-in عبر strict ← opts.requireStructure — لا تتغيّر وحدات الاختبار الحالية.

/** تجريد التشكيل والهمزات للتطابق النصّي. */
export const stripDiacritics = (s) => String(s || '')
  .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي');

/** النقود في تعلمات الوحدة (عناوين الدروس + الكفاءات) — بصيغة بعد stripDiacritics. */
export const SCOPE_MONEY = /نقود|دينار|مليم|ثمن|سعر|شراء|بيع|مصروف|مصاريف|اجور|تذاكر|ادخار|ميزانية|نقدي/;
/** الهندسة في تعلمات الوحدة؟ */
export const SCOPE_GEO = /شبكة|مسالك|مثلث|مربع|دائرة|مستطيل|معين|متوازي|محيط|مساحة|زوايا?|اضلاع|ضلع|قطر|هندسي/;
/** وحدات القياس في تعلمات الوحدة؟ */
export const SCOPE_MEASURE = /قيس|سنتيم|متر|كتل|سعة|لتر|وزن|زمن|وحدات? القياس|قياس/;

/** السؤال وضعية نقود فعلية؟ */
const Q_MONEY = /مليم|دينار|دنانير|قطعة نقدية|ورقة نقدية|ثمن|سعر|مبلغ|ادخار|اشتري|شراء|يبقى|الباقي|يدفع|دفع/;
/** السؤال يقيس/يوظّف خاصية هندسية؟ */
const Q_GEO = /شبكة|مسالك|مثلث|مربع|دائرة|مستطيل|معين|متوازي|محيط|مساحة|زوايا?|اضلاع|ضلع|قطر|هندسي/;
/** السؤال يوظّف وحدات قياس فعلية؟ */
const Q_MEASURE = /سنتيم|متر|قيس|طول|وزن|كتل|لتر|زمن|مسافة|وحدة|حول/;
/** فعل رسم يقتضي مساحة رسم (§B3-4). */
const DRAW_VERB = /ارسم|اكمل (?:المسار|الرسم|الشكل)/;
/** فعل قياس/تحليل يجعل السؤال الهندسي «يقيس خاصية لا مجرد رسم». */
const GEO_ANALYZE = /احسب|حدد|عين|قارن|رتب|اختر|اكمل|ارسم|حرك|تبين|كم|وظف|ما هو/;
/** فعل مهمة حقيقية في السؤال المالي (§B3-نقود-2). */
const MONEY_TASK = /كم|احسب|انجز|اكمل|اختر|مثل|قارن|اقل|حدد|اعطني|ما هو|اي|يبقى|دفع/;
/** إشارات تنفيذ حساب (صحة الحساب M2). */
const CALC_EXEC = /انجز|عمودي|افقي|احسب|الناتج|مجموع|اجمع|اطرح|قسم|اضرب|صحح الحساب/;

const digitsIn = (s) => (String(s || '').match(/\d/g) || []).length;

/** يتقاطع نصّان لغويًّا (كلمة محتوى ≥4 أحرف)؟ — لاستمرارية السند الثاني. */
function sharesContent(a, b) {
  const A = new Set(contentWords(a).map((w) => w.slice(0, 6)));
  return contentWords(b).some((w) => A.has(w.slice(0, 6)));
}

/** قيم القطع النقدية التونسية المتداولة (1 د = 1000 م) — فحص §B3-نقود-3. */
const MILLIME_COINS = new Set([1, 2, 5, 10, 20, 50, 100, 200, 250, 500]);
const DINAR_CASH = new Set([1, 2, 5, 10, 20, 50, 100]);

/** مطابقات القيمة النقدية في نصّ (تساوي صريح) — تحقّق a ↔ b×1000. */
function moneyValueIssues(text) {
  const out = [];
  const t = stripDiacritics(toAsciiDigits(text));
  const patterns = [
    // «250 مليمًا يساوي 0.25 دينارًا» → 250 يجب أن تساوي b×1000
    { re: /(\d+(?:[.,]\d+)?)\s*مليم[^\d]{0,15}?(?:يساوي|يعادل|تساوي|هو|=)\s*(\d+(?:[.,]\d+)?)\s*(?:دينار|دنانير)/g,
      stated: (a) => a, correct: (a, b) => b * 1000 },
    // «5 دنانيرًا تساوي 5000 مليمًا» → b يجب أن يساوي a×1000
    { re: /(\d+(?:[.,]\d+)?)\s*(?:دينار|دنانير)[^\d]{0,15}?(?:يساوي|يعادل|تساوي|هو|=)\s*(\d+(?:[.,]\d+)?)\s*مليم/g,
      stated: (a, b) => b, correct: (a) => a * 1000 }
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.re.exec(t))) {
      const a = parseFloat(m[1].replace(',', '.'));
      const b = parseFloat(m[2].replace(',', '.'));
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const statedVal = p.stated(a, b);
      const expected = p.correct(a, b);
      if (Math.abs(statedVal - expected) > 0.5) {
        out.push(eqIssue('error', 'MONEY_VALUE_INVALID',
          `قيمة نقدية خاطئة في «${m[0].trim()}»: المقابل الصحيح ${expected} مليمًا (1 دينار = 1000 مليم §B3-نقود-3)`));
      }
    }
  }
  return out;
}

const VALIDATORS = {
  /** الرياضيات: معطيات رقمية حقيقية + لا إفراط اختيار عند هدف الحل (§30,§42)
   *  + الشريحة الموسّعة (strict): ربط السندات/نقود/هندسة/قياس/مساحة عمودية. */
  math({ questions, stimuli, blueprint, strict }) {
    const out = [];
    const withData = questions.filter((q) => {
      const body = questionBody(q);
      return /\d/.test(toAsciiDigits(body)) || SHAPE_HINT.test(body);
    });
    if (questions.length && !withData.length) {
      out.push(eqIssue('error', 'MATH_NO_DATA', 'اختبار رياضيات بلا معطيات رقمية ولا تمثيل: لا تقيس المادة (§42,§79)'));
    }
    if (questions.length >= 5 && questions.every((q) => q.type === 'MCQ')) {
      out.push(eqIssue('warn', 'MATH_ALL_MCQ', 'كل الأسئلة اختيارًا: فضّل أثر الحل أو التفسير عند هدف التفكير (§30)'));
    }
    if (!strict || !questions.length) return out;

    const yearIdx = Number(String(blueprint?.grade || '').match(/year\s*(\d+)/i)?.[1] || 0);
    const scopeText = stripDiacritics((blueprint?.scopeLessons || [])
      .map((l) => [l.title, ...(l.competencies || [])].join(' '))
      .join(' \n '));
    const prompts = questions.map((q) => stripDiacritics(q?.prompt || ''));
    const moneyIdx = questions.map((q, i) => (Q_MONEY.test(prompts[i]) ? i : -1)).filter((i) => i >= 0);
    const geoIdx = questions.map((q, i) => (Q_GEO.test(prompts[i]) ? i : -1)).filter((i) => i >= 0);
    const measIdx = questions.map((q, i) => (Q_MEASURE.test(prompts[i]) ? i : -1)).filter((i) => i >= 0);

    // §D5: ربط السندات — y3+ سندان مترابطان، الأول يغذّي ≥4 أسئلة والثاني يكمله.
    if (yearIdx >= 3 && questions.length >= 5 && stimuli.length < 2) {
      out.push(eqIssue('error', 'MATH_STIMULUS_LINKAGE',
        'رياضيات y3+: سند واحد فقط — المطلوب سندان مترابطان: السند الأول ≥4 أسئلة ثمّ السند الثاني يكمل سياقه (§D5)'));
    }
    if (stimuli.length >= 2) {
      const firstId = String(stimuli[0]?.id || '');
      const feed = questions.filter((q) => String(q?.sindId || '') === firstId).length;
      if (questions.length >= 6 && feed < 4) {
        out.push(eqIssue('warn', 'MATH_FEED_LIGHT',
          `السند الأول يغذّي ${feed} أسئلة فقط والمطلوب ≥4 ليرتبط التلميذ بمعطياته ثم ينتقل (§D5)`));
      }
      if (!sharesContent(stimuli[0]?.text || '', stimuli[1]?.text || '')) {
        out.push(eqIssue('error', 'MATH_STIMULUS_DISJOINT',
          'السند الثاني لا يتقاطع لغويًّا مع الأول: يجب أن يكمل سياقه لا أن يفتح وضعية جديدة (§D5)'));
      }
    }

    // §B3-نقود: في التعلمات ← واجب (1) + مهارة فعلية (2) + قيم صحيحة (3) + وظيفة للقطعة (4).
    if (SCOPE_MONEY.test(scopeText) && !moneyIdx.length) {
      out.push(eqIssue('error', 'MONEY_MISSING',
        'النقود من تعلمات هذه الفترة لكن لا سؤال مالي في الورقة: وضعية نقود فعلية إلزامية (§B3-نقود-1)'));
    }
    moneyIdx.forEach((i) => {
      const p = prompts[i];
      const ans = stripDiacritics(questions[i]?.correctAnswer || '');
      if (digitsIn(p) === 0 && !/\d/.test(ans) && MONEY_TASK.test(p)) {
        out.push(eqIssue('warn', 'MONEY_NOT_APPLIED',
          `السؤال ${i + 1}: ذكر النقود بلا قيمة رقمية تُوظَّف — هل يقيس مهارة توظيف فعلية لا زينة؟ (§B3-نقود-2)`, i));
      }
      if (/قطعة نقدية|قطعة نقدية|ورقة نقدية/.test(p) && digitsIn(p) < 2 && !/\d/.test(ans)) {
        out.push(eqIssue('warn', 'MONEY_COIN_UNUSED',
          `السؤال ${i + 1}: ذكر قطعة/ورقة نقدية دون قيمة أخرى تُحسب معها — للقطع وظيفة في الحل (§B3-نقود-4)`, i));
      }
      // فحص صيغ القطع مقابل النظام التونسي
      const coin = p.match(/قطعة(?:ا)?\s*(?:نقدية)?\s*(?:من|بقيمة)\s*(\d+)\s*(مليم|دينار|دنانير)/);
      if (coin) {
        const v = Number(coin[1]);
        const ok = coin[2].startsWith('مليم') ? MILLIME_COINS.has(v) : DINAR_CASH.has(v);
        if (!ok) {
          out.push(eqIssue('error', 'MONEY_DENOM_INVALID',
            `السؤال ${i + 1}: القطعة النقدية «${v} ${coin[2]}» غير متداولة في النظام التونسي (§B3-نقود-3)`, i));
        }
      }
    });
    out.push(...moneyValueIssues(stimuli.map((s) => s?.text || '').join('\n') + '\n' + prompts.join('\n')));

    // §B3-هندسة: في التعلمات ← واجب (1) + يقيس خاصية لا مجرد رسم (3) + مساحة رسم (4).
    if (SCOPE_GEO.test(scopeText) && !geoIdx.length) {
      out.push(eqIssue('error', 'GEOMETRY_MISSING',
        'الهندسة من تعلمات هذه الفترة لكن لا سؤال هندسي: أوظّف خاصية هندسية فعليًّا (§B3-هندسة-1)'));
    }
    geoIdx.forEach((i) => {
      if (!GEO_ANALYZE.test(prompts[i])) {
        out.push(eqIssue('warn', 'GEOMETRY_NOT_MEASURED',
          `السؤال ${i + 1}: يذكر عنصرًا هندسيًّا دون فعل قياس/تحليل — هل يقيس خاصية هندسية لا مجرد رسم؟ (§B3-هندسة-3)`, i));
      }
      if (DRAW_VERB.test(prompts[i]) && questions[i]?.layout && questions[i].layout !== 'drawing') {
        out.push(eqIssue('warn', 'DRAWING_SPACE_MISSING',
          `السؤال ${i + 1}: يطلب رسمًا لكن layout = «${questions[i].layout}» — للرسم مساحة كافية (§B3-هندسة-4)`, i));
      }
    });

    // §B3-قياس: في التعلمات ← واجب: سؤال يوظّف وحدات قياس فعلية.
    if (SCOPE_MEASURE.test(scopeText) && !measIdx.length) {
      out.push(eqIssue('error', 'MEASURE_MISSING',
        'وحدات القياس من تعلمات هذه الفترة لكن لا سؤال يوظّفها: قيس/تحويل وحدات إلزامي (§B3-قياس)'));
    }

    // §D12: مساحة مستقلة للعملية العمودية y3+ (إضافة سطر عمودي ← إطار مستقل في العرض).
    questions.forEach((q, i) => {
      if (/عمودي/.test(prompts[i]) && q?.layout && q.layout !== 'vertical') {
        out.push(eqIssue('error', 'VERTICAL_SPACE_MISSING',
          `السؤال ${i + 1}: يطلب تنفيذ العملية عموديًّا لكن layout = «${q.layout}» — مساحة مستقلة للعملية العمودية (§D12)`, i));
      }
    });
    const hasOp = questions.some((q, i) => /\d/.test(prompts[i]) && (CALC_EXEC.test(prompts[i]) || /[+\-−×÷]\s*\d|\d\s*=/.test(prompts[i])));
    if (yearIdx >= 3 && hasOp && !questions.some((q) => q?.layout === 'vertical')) {
      out.push(eqIssue('error', 'NO_VERTICAL_WORK_SPACE',
        'ورقة عمليات y3+ بلا مساحة مخصّصة للعملية العمودية: أضف سؤالًا بـ layout «vertical» (§D12)'));
    }
    return out;
  },

  /** القراءة: أصل نصّي + كل مهمة مترابطة بالنصّ (لا سؤال من خارج النصّ §42). */
  reading({ questions, stimuli }) {
    const out = [];
    if (!stimuli.length) {
      out.push(eqIssue('error', 'READING_NO_TEXT', 'اختبار قراءة بلا نصّ مرجعي: النصّ هو أصل كل مهمة (§42)'));
      return out;
    }
    const text = stimuli.map((s) => s.text).join(' \n ');
    questions.forEach((q, idx) => {
      if (!overlaps(questionBody(q), text)) {
        out.push(eqIssue('warn', 'READING_NOT_GROUNDED', `السؤال ${idx + 1}: لا يتقاطع مع لغة النصّ المرجعي — راجع استناده (§42)`, idx));
      }
    });
    return out;
  },

  /** الإيقاظ: مثير مرصود + لا انزلاق إلى الحساب (الممحّن العام يمنعه أيضًا). */
  science({ questions, stimuli }) {
    const out = [];
    if (!stimuli.length) {
      out.push(eqIssue('error', 'SCIENCE_NO_STIMULUS', 'اختبار إيقاظ بلا مشهد/صورة/تجربة: الطفل يستدل من مرصود (§3-4)'));
      return out;
    }
    const text = stimuli.map((s) => s.text).join(' \n ');
    questions.forEach((q, idx) => {
      if (!overlaps(questionBody(q), text)) {
        out.push(eqIssue('warn', 'SCIENCE_NOT_GROUNDED', `السؤال ${idx + 1}: لا يستند إلى عناصر المشهد الموصوف (§42)`, idx));
      }
    });
    return out;
  },

  /** اللغة: ترابط المهمة بالمثير اللغوي (لا حساب، لا سؤال بلا سياق). */
  language({ questions, stimuli }) {
    const out = [];
    if (!stimuli.length) return out;
    const text = stimuli.map((s) => s.text).join(' \n ');
    questions.forEach((q, idx) => {
      if (!overlaps(questionBody(q), text)) {
        out.push(eqIssue('warn', 'LANG_NOT_GROUNDED', `السؤال ${idx + 1}: لا يستند إلى السند اللغوي (§42)`, idx));
      }
    });
    return out;
  },

  /** الإنتاج الكتابي: مهمة إنتاج فعلية + سجّة، لا اختيار من متعدد وحده (§26). */
  writing({ questions }) {
    const out = [];
    const production = questions.filter((q) => q.type === 'OPEN' || q.expectedResponseType || q.answerLines);
    if (questions.length && !production.length) {
      out.push(eqIssue('error', 'WRITING_NO_PRODUCTION', 'اختبار إنتاج بلا مهمة إنتاج: الاختيار وحده لا يقيس الكتابة (§26)'));
    }
    return out;
  }
};

/**
 * تشغيل محقّق(ات) المادة حسب ملفها — يُستدعى بعد المحقّق العام (PASS AND PASS).
 * @param {{blueprint:object, questions:Array, stimuli:Array, strict?:boolean}} exam
 *   strict ← opts.requireStructure: يفعّل الفحوص الموسّعة (§B3) دون تغيّر الوحدات الحالية.
 * @returns {{issues:Array, ran:string[]}}
 */
export function runSubjectValidators({ blueprint = {}, questions = [], stimuli = [], strict = false } = {}) {
  const profile = getSubjectProfile(blueprint.subject);
  const names = Array.isArray(profile.validators) ? profile.validators : [];
  const issues = [];
  const ran = [];
  for (const name of names) {
    const fn = VALIDATORS[name];
    if (!fn) continue;
    ran.push(name);
    issues.push(...fn({ blueprint, questions, stimuli, profile, strict }));
  }
  return { issues, ran };
}
