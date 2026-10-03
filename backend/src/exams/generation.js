// مولّد الاختبار المخطّطي (§1,§10,§13,§14,§15,§30,§36,§76,§89).
//
// يبني برومبت التوليد **مركّبًا من الطبقات** لا كتلة ثابتة (Spec §35-§36):
//   CORE_POLICY + CURRICULUM_SCOPE + GRADE_PROFILE + SUBJECT_PROFILE + ASSESSMENT_MODE
//   + TASK_SPEC + VALIDATION_CONTRACT
// الملفات تُقرأ من profiles/* (قواعد تُعدَّل في ملف بيانات لا في الـPrompt).
// ثم يُطبِّع مخرَج النموذج إلى عقد السؤال §76 قبل إمراره على exam-pipeline.
// الأنواع محصورة في GENERATABLE_TYPES (§31: نوع السؤال في البيانات والنص والواجهة متطابق).

import { GENERATABLE_TYPES } from './question-validator.js';
import { subjectLabel } from './subject-labels.js';
import { buildStimuli } from './sind.js';
import { resolveProfiles, defaultStimulusType } from './profiles/index.js';
import { SCOPE_MONEY, SCOPE_GEO, SCOPE_MEASURE, stripDiacritics } from './subject-validators.js';

/**
 * برومبت التوليد (§1): لا يبدأ بلا معلومة — كل سؤال يحمل السنة والمادة والثلاثي
 * والنطاق والمكتسب والهدف والنقاط والصعوبة والمدة.
 */
export function buildExamPrompt(blueprint = {}, { previousIssues } = {}) {
  // الطبقات (Spec §35-§36): مادة + سنة + وضع تُقرأ من ملفات profiles/* لا من نصّ صارم هنا.
  const { subject: sp, grade: gp, mode, evidenceKind } = resolveProfiles({
    subject: blueprint.subject,
    grade: blueprint.grade,
    assessmentType: blueprint.assessmentType
  });
  const subjectName = subjectLabel(blueprint.subject) || 'هذه المادة';
  const quant = sp.forbidArithmetic === false;
  const gradeLanguage = quant ? (gp.languageQuant || gp.language) : gp.language;
  const lessonsLine = (blueprint.scopeLessons || [])
    .slice(0, 30)
    .map((l) => `- ${l.title}${l.period ? ` (الفترة ${l.period})` : ''}${l.competencies?.length ? ` ← ${l.competencies.join(' / ')}` : ''}`)
    .join('\n');

  const perQuestionPoints = (Number(blueprint.targetPoints) / Number(blueprint.questionCount || 8)).toFixed(1);
  const typesLine = (blueprint.types?.length ? blueprint.types : GENERATABLE_TYPES).join(', ');
  const ruleLines = (arr) => (Array.isArray(arr) && arr.length ? arr.map((r) => `- ${r}`).join('\n') : '- القواعد العامة في هذا القسم وحدها');

  // قواعد المثير تابعة لملف المادة (§3): رياضيات ← مثير عددي بعملية مسموحة؛ غيرها ←
  // مثير نصّي بلا حساب (§55,§79). «وضعية بالأرقام» العامة كانت تخلط الحساب في اختبار اللغة.
  const stimulusRules = quant
    ? [
      '- المثير (stimuli) إلزامي: ابدأ بوضعية عددية أو جدول أرقام أو شكل هندسي موصوف ثم اربط كل سؤال به عبر "sindId"',
      '- كل رقم في السؤال أو بدائله يجب أن يكون واردًا في المثير أو ناتجًا عنه بعملية حسابية على أرقامه — لا رقم من عندي (§42)',
      '- إن احتجت جدولًا أو أشكالًا هندسية في السؤال فاذكرها في المثير أولًا (§160,§161)'
    ].join('\n')
    : [
      `- المثير (stimuli) إلزامي: ابدأ بمثير حقيقي مناسب لـ«${subjectName}» (${sp.stimulusHint}) ثم اربط كل سؤال به عبر "sindId"`,
      '- لا وضعية عددية ولا عملية حسابية ولا أشكال هندسية في هذا الاختبار: الأرقام إن وردت (سنة، ترقيم، قياس) تبقى كما هي في المثير ولا تُطلب عليها عملية (§42,§55)',
      '- كل رقم في السؤال أو بدائله يجب أن يكون واردًا في المثير — لا رقم من عندي (§42)'
    ].join('\n');

  // نقاء المادة (§55): الاختبار يقيس مادته فقط — لا خلط بمواد أخرى في أي اتجاه.
  const purityRule = quant
    ? `- هذا اختبار «${subjectName}» حصراً: كل سؤال يقيس مكتسبًا في هذه المادة — لا تخلطه بأسئلة لغة أو قراءة أو علوم أو مادة أخرى (§55)`
    : `- هذا اختبار «${subjectName}» حصراً: كل سؤال يقيس مكتسبًا في هذه المادة — لا تخلطه بأسئلة حساب أو رياضيات (§55)`;

  // محاذاة التوليد مع مدقّقات الشريحة الموسّعة (§D5,§D11,§D12,§B3): كل قاعدة يُرفض
  // عندها المخرَج تُقال للنموذج صراحةً هنا — لا مدقّق بلا قاعدة معلنة (نفس شروط المدقّق حرفيًّا).
  const yearIdx = Number(String(blueprint.grade || '').match(/year\s*(\d+)/i)?.[1] || 0);
  const scopeText = stripDiacritics((blueprint.scopeLessons || [])
    .map((l) => [l.title, ...(l.competencies || [])].join(' '))
    .join(' \n '));
  const strictRules = [
    '- سؤال الترتيب (ORDER) بلا حقلين يُرفض: "orderItems" (عناصر مبعثرة ≥ 2) و"correctAnswer" (التسلسل الصحيح كاملًا في ترتيبه الصحيح)'
  ];
  strictRules.push('- لا يكشف سؤال لاحق إجابة سؤال سابق: لا تُكرَّر إجابة سؤال (ولا خيارها الصحيح) متنًا أو بدائلًا في سؤال لاحق (§D11)');
  if (quant && yearIdx >= 3) {
    strictRules.push('- رياضيات السنة الرابعة فما فوق: سنّان مترابطان (§D5) — الأول يغذّي ≥ 4 أسئلة، والثاني يكمّل سياقه لا أن يفتح وضعية جديدة، ويتقاطعان لغويًّا (نفس الأسماء والموضوع)');
    strictRules.push('- رياضيات y3+: أدرج سؤالًا واحدًا على الأقل لعملية حسابية حاملًا "layout": "vertical" (مساحة مستقلة للعملية العمودية §D12) — وحين يطلب السؤال رسمًا أو إتمام مسار استعمل "layout": "drawing" (§B3-هندسة-4)');
  }
  if (quant && SCOPE_MONEY.test(scopeText)) {
    strictRules.push('- النقود من تعلمات هذه الوحدة: أدرج وضعية نقود فعلية واحدة على الأقل بقيم تونسية صحيحة متداولة (1 دينار = 1000 مليم) (§B3-نقود-1,3)');
  }
  if (quant && SCOPE_GEO.test(scopeText)) {
    strictRules.push('- الهندسة من تعلمات هذه الوحدة: أدرج سؤالًا هندسيًّا يوظّف خاصية فعلية لا مجرد ذكر شكل (§B3-هندسة-1)');
  }
  if (quant && SCOPE_MEASURE.test(scopeText)) {
    strictRules.push('- وحدات القياس من تعلمات هذه الوحدة: أدرج سؤالًا يوظّف قياسًا أو تحويل وحدات فعليًّا (§B3-قياس)');
  }

  const system = `أنت مختصّ تونسي في بناء الاختبارات التقويمية للتعليم الابتدائي (المركز الوطني البيداغوجي). تبني اختبارًا وفق المخطّط المعطى وطبقات ملفات المادة والسنة الظاهرة فيه، لا سؤالًا عامًّا.`;

  const user = `ابنِ اختبارًا تقويميًّا تونسيًّا وفق الطبقات التالية حرفياً:

[1] السياق النظامي:
السنة: ${blueprint.gradeLabel || blueprint.grade}
المادة: ${subjectName}
الثلاثي: ${blueprint.trimester}
نوع التقييم: ${blueprint.assessmentType}
عدد الأسئلة: ${blueprint.questionCount}
المجموع: ${blueprint.targetPoints} نقطة
المدة: ${blueprint.durationMinutes} دقيقة
أنواع الأسئلة المسموح بها فقط: ${typesLine}

[2] نطاق المنهج (المصدر الوحيد §2):
دروس ونطاق المنهج الرسمي لهذا الاختيار (المصدر الوحيد — لا تخترع درسًا خارجه §2):
${lessonsLine || '- (بلا دروس مسجّلة — التزم بلغة البرنامج المذكورة أعلاه فقط)'}

[3] ملف السنة — ${gp.label}:
- ${gradeLanguage}
- التعليمية لا تتجاوز ${gp.maxPrompt} حرفًا (§39,§40)

[4] ملف المادة — ${subjectName} (نوع الدليل: ${evidenceKind}):
- نوع المثير المناسب: ${sp.stimulusHint}
- أنواع المهام المفضّلة: ${sp.preferredTaskTypes.filter((t) => GENERATABLE_TYPES.includes(t)).join('، ')}
${ruleLines(sp.promptRules)}

[5] ملف وضع التقييم — ${mode.label}:
${ruleLines(mode.promptRules)}

[6] قواعد إلزامية (Core مشترك):
- أخرج كائن JSON واحدًا بالشكل: {"stimuli":[{"id":"s1","title":"السند 1","text":"…","purpose":"…"}],"questions":[…]} — بلا شرح ولا markdown
${stimulusRules}
${strictRules.join('\n')}
- لا تغيّر الوحدات (مليم/دينار/سم…) ولا أسماء الأشخاص والأماكن بين المثير والسؤال (§45,§46)، ولا تستعمل «الثاني» إلا إن ورد في المثير (§159)
- ${purityRule}
- كل سؤال يحمل الحقول كاملة (§76): id, grade, subject, term, domain, lesson, competency, objective, type, difficulty (1 تعرف → 5 إدماج), points, prompt, options (للـMCQ), correctAnswer, acceptedAnswers, expectedResponseType (للـOPEN), estimatedTime, sindId
- objective = هدف تعليمي صريح يجيب: «لماذا هذا السؤال موجود؟ يقيس …» (§123) مأخوذ من أهداف الدروس المعطاة
- competency من كفايات الدروس المعطاة حصراً (§55)
- إجابة واحدة صحيحة بالضبط في الاختيار من متعدد؛ البدائل متقاربة الطول بلا إشارة للجواب (§26,§91)
- لا تكتب الجواب داخل السؤال (§28)، ولا جملة تحتوي «صواب/خطأ» كسؤال صح/خطأ
- points: قيم من 0.5 إلى 4 بخطوة 0.5، ووزّع ليقارب مجموعها ${blueprint.targetPoints} نقطة (متوسط كل سؤال ≈ ${perQuestionPoints} — أسئلة مركّبة أعلى: §8)
- لا تكرار بين الأسئلة ولا قياس نفس المكتسب 5 مرات (§9,§53)
- تنويع الأنواع والمصاعب (§30,§36): لا كلها اختيارًا ولا كلها مستوى 1
- راجع الزمن: مجموع estimatedTime لا يتجاوز ${blueprint.durationMinutes} دقيقة (§38)
- أعد JSON فقط: كائن فيه stimuli وquestions، بلا شرح ولا markdown${previousIssues ? `\n\nتنبيه: إخراجك السابق رُفض بسبب: ${previousIssues} — صحّحه` : ''}`;

  return { system, user, maxTokens: 6000 };
}

/**
 * يقرأ مخرَج النموذج نصًّا إلى مصفوفة أسئلة خام (§89): JSON كامل أولًا،
 * ثمّ مصفوفة داخل نص، ثمّ كائن يحوي `questions` — بلا تخمين عند الفشل (§2).
 * @returns {Array|null} null عند فشل القراءة (المستدعي يعيد المحاولة/يرفض)
 */
export function parseGeneratedPayload(text) {
  if (!text) return null;
  const s = String(text);
  const candidates = [s];
  const arr = s.match(/\[[\s\S]*\]/);
  if (arr) candidates.push(arr[0]);
  const obj = s.match(/\{[\s\S]*\}/);
  if (obj) candidates.push(obj[0]);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
    } catch { /* جرّب المرشّح التالي */ }
  }
  return null;
}

/**
 * قراءة مخرَج النموذج كاختبار كامل: سندات + أسئلة (§1,§105).
 * يقبل الكائن المطلوب `{"stimuli":[…],"questions":[…]}`، أو مصفوفة أسئلة خام
 * (فيُعدّ سندًا ناقصًا — يكتشفه المدقّق NO_STIMULUS ولا نحجب الصراحة هنا §126).
 * @returns {{stimuli:Array, questions:Array}|null} null عند فشل القراءة
 */
export function parseGeneratedExamPayload(text) {
  if (!text) return null;
  const s = String(text);
  const candidates = [s];
  const obj = s.match(/\{[\s\S]*\}/);
  if (obj) candidates.push(obj[0]);
  const arr = s.match(/\[[\s\S]*\]/);
  if (arr) candidates.push(arr[0]);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed)) return { stimuli: [], questions: parsed };
      if (parsed && Array.isArray(parsed.questions)) {
        return { stimuli: Array.isArray(parsed.stimuli) ? parsed.stimuli : [], questions: parsed.questions };
      }
    } catch { /* جرّب المرشّح التالي */ }
  }
  return null;
}

/**
 * تطبيع السندات الخام القادمة من النموذج (§3): نصّ حقيقي + أرقامه + وقفته.
 * @returns {{stimuli:Array, invalid:Array<string>}}
 */
export function normalizeGeneratedStimuli(rawStimuli, blueprint = {}) {
  const { stimuli, invalid } = buildStimuli(rawStimuli);
  const defType = defaultStimulusType(blueprint.subject); // النوع الافتراضي من ملف المادة (§14)
  const rawList = Array.isArray(rawStimuli) ? rawStimuli.filter(Boolean) : [];
  const rawById = new Map(rawList.map((r) => [String(r.id || ''), r]));
  return {
    stimuli: stimuli.map((s, i) => {
      const raw = rawById.get(String(s.id)) || {};
      const requested = String(raw.stimulusType || raw.type || '').trim();
      return {
        ...s,
        id: s.id || `s${i + 1}`,
        grade: blueprint.grade || null,
        // نوع المثير يُمرَّر كما طلبه النموذج؛ ما يخرج عن ملف المادة يصلحه repair.js
        // (إصلاح حتمي في الـPipeline لا تعليمات في الـPrompt).
        stimulusType: requested || defType
      };
    }),
    invalid
  };
}

/** يُطبِّع مخرَج النموذج إلى عقد السؤال §76 + يفرض القيود الثابتة من المخطّط. */
export function normalizeGeneratedQuestions(raw, blueprint = {}) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.questions) ? raw.questions : null;
  if (!list) return null;
  const t = Number(blueprint.trimester) || null;
  const out = [];
  list.forEach((q, i) => {
    if (!q || typeof q !== 'object') return;
    const type = String(q.type || '').toUpperCase();
    const prompt = String(q.prompt || q.text || '').trim();
    if (!prompt) return;
    const normalized = {
      id: `q${i + 1}`,
      grade: blueprint.grade,
      subject: blueprint.subject,
      term: t,
      domain: q.domain || null,
      lesson: q.lesson || null,
      competency: q.competency || null,
      objective: q.objective || null,
      type: GENERATABLE_TYPES.includes(type) ? type : 'MCQ',
      difficulty: Math.min(5, Math.max(1, Number(q.difficulty) || 2)),
      points: Number(q.points) || null,
      prompt,
      estimatedTime: Number(q.estimatedTime) || null,
      ...(q.options && Array.isArray(q.options) ? { options: q.options.map((o) => String(o).trim()).filter(Boolean) } : {}),
      ...(q.correctAnswer !== undefined ? { correctAnswer: typeof q.correctAnswer === 'number' && type === 'MCQ'
        ? String((q.options || [])[q.correctAnswer] ?? '')
        : String(q.correctAnswer) } : {}),
      ...(Array.isArray(q.acceptedAnswers) ? { acceptedAnswers: q.acceptedAnswers.map(String) } : {}),
      ...(type === 'ORDER' && Array.isArray(q.orderItems) ? { orderItems: q.orderItems.map(String) } : {}),
      ...(q.expectedResponseType ? { expectedResponseType: String(q.expectedResponseType) } : {}),
      ...(Number(q.answerLines) ? { answerLines: Number(q.answerLines) } : {}),
      ...(q.layout ? { layout: String(q.layout) } : {}), // بنية العرض: vertical|drawing|horizontal (§D12)
      ...(q.sindId || q.stimulusId ? { sindId: String(q.sindId || q.stimulusId) } : {}),
      status: 'needs_review'
    };
    // MCQ يحتاج `correct` أيضًا (gradeOfficialExam يقرأه) — نفس مفتاح correctAnswer
    if (normalized.type === 'MCQ' && normalized.correctAnswer) normalized.correct = normalized.correctAnswer;
    out.push(normalized);
  });
  return out.length ? out : null;
}
