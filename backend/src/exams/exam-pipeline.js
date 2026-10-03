// خط أنابيب تدقيق الاختبار (§49,§66,§125,§126,§129).
//
// التوليد ليس الحكم النهائي: كل اختبار يمرّ بالسلسلة
//   منهج ← إجابات ← غموض ← عمر ← صعوبة ← تنقيط ← لغة ← طباعة ← اعتماد
// وأي فشل → REJECT برسالة محدّدة لا «تم إنشاء الاختبار بنجاح» الكاذبة (§126).
// المخرج تقرير `audit` بتTickات ✓/⚠/✗ (§66) + حالة `needs_review` حتى يراجعه
// المدرس ويُصرّح بـ `approved` (§61) — الذكاء الاصطناعي لا ينشر مباشرة (§106).

import { validateQuestion } from './question-validator.js';
import { findDuplicates } from './duplicate-detector.js';
import { bindAndCheck } from './grounding.js';
import { comparePatterns } from './pattern.js';
import { verifyTotal, totalPoints, distributePoints } from './points-engine.js';
import { validateBlueprint, analyzeCoverage } from './exam-blueprint.js';
import { matchesScopeText } from './curriculum-index.js';
import { subjectLabel } from './subject-labels.js';
import { forbidsArithmetic, getSubjectProfile, getGradeProfile } from './profiles/index.js';
import { runSubjectValidators, arithmeticSignal } from './subject-validators.js';
import { checkStimulusText, checkReadingItems, checkFormatVariety, checkAnswerChain, checkStimulusMeta, checkScienceItems, checkFormatLabels, checkMentalShape } from './structure.js';
import { MATH_CRITERIA, criteriaTable, criteriaDistribution } from './criterion-map.js';
import { criteriaGrid } from './criteria-grids.js';
import { assignCriterion, buildSpecMatrix, analyticalReport } from './spec-matrix.js';
import { repairExam } from './repair.js';
import { normalizeArabic } from '../services/curriculumService.js';

const issue = (severity, code, message, qIndex) => ({ severity, code, message, ...(qIndex !== undefined ? { qIndex } : {}) });

/** فحوصات §66 — يعاد شكلها للمدرس كقائمة ✓/⚠. */
function buildAudit(checks) {
  return checks.map((c) => ({ id: c.id, label: c.label, status: c.status, detail: c.detail || '' }));
}

const STATUS_ICON = { pass: '✓', warn: '⚠', fail: '✗' };

export function auditReportLines(audit = []) {
  return audit.map((c) => `${STATUS_ICON[c.status] || '•'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
}

/**
 * يدقّق اختبارًا كاملًا مكوّنًا من blueprint + questions (+passages).
 * @param {object} exam { blueprint, questions, passages?, durationMinutes?, title? }
 * @param {object} opts { autoFixPoints=true } يوزّع النقاط آليًّا ليصدم Σ = الهدف
 * @returns {{approved:boolean, status:string, questions:Array, issues:Array, audit:Array, coverage:object, report:string[]}}
 */
export function validateExam(exam = {}, opts = {}) {
  const bp = exam.blueprint || {};
  const issues = [];
  const checks = [];

  // 1) المخطّط (§51)
  const bpResult = validateBlueprint(bp);
  issues.push(...bpResult.issues);
  checks.push({
    id: 'blueprint',
    label: 'المخطّط مكتمل (سنة/مادة/ثلاثي/عدد/مجموع)',
    status: bpResult.issues.some((i) => i.severity === 'error') ? 'fail' : bpResult.issues.length ? 'warn' : 'pass',
    detail: bpResult.issues.map((i) => i.message).join('؛ ')
  });

  // 0) الإصلاح الحتمي قبل التدقيق (Spec §36): ما يمكن ترميمه يُصلَح هنا برمجيًّا —
  //    لا بطلب من النموذج في الـPrompt (الإصلاح في الـPrompt = عشوائية). ما لا يمكن
  //    إصلاحه (نقاء المادة، المنهج، الإجابات) يبقى خطأً يذهب في previousIssues.
  const repaired = repairExam({
    blueprint: bp,
    questions: Array.isArray(exam.questions) ? exam.questions : [],
    stimuli: Array.isArray(exam.stimuli) ? exam.stimuli : [],
    notes: Array.isArray(exam.repairNotes) ? exam.repairNotes : []
  });
  const repairNotes = repaired.notes;
  repairNotes.forEach((n) => {
    issues.push(issue(n.severity === 'error' ? 'error' : 'warn', n.code, n.message, n.qIndex));
  });
  if (repairNotes.length) {
    checks.push({
      id: 'repair',
      label: 'إصلاح حتمي قبل التدقيق (لا يُطلب من النموذج)',
      status: repairNotes.some((n) => n.severity === 'error') ? 'fail' : 'warn',
      detail: repairNotes.slice(0, 3).map((n) => n.message).join('؛ ')
    });
  }

  // مرآة `correct` (يقرأها gradeOfficialExam) تُعاد مزامنتها مع correctAnswer قبل كل فحص:
  // تعديل المعلّم للإجابة لا يترك مرآة قديمة تُنقّط/تُقيّم بقيمة مهجورة (§61,§76).
  let questions = repaired.questions.map((q) => (q.type === 'MCQ' && q.correctAnswer !== undefined ? { ...q, correct: q.correctAnswer } : { ...q }));
  if (!questions.length) {
    issues.push(issue('error', 'NO_QUESTIONS', 'لا أسئلة في الاختبار'));
    checks.push({ id: 'questions', label: 'وجود أسئلة', status: 'fail', detail: 'لا أسئلة' });
    return { approved: false, status: 'rejected', questions, issues, audit: buildAudit(checks), coverage: {}, report: auditReportLines(buildAudit(checks)), repairNotes, stimuli: repaired.stimuli };
  }

  // 2) عقد السؤال الفردي: منهج + إجابة + غموض + عمر + لغة (§50,§55)
  const perQuestion = [];
  questions.forEach((q, idx) => {
    const res = validateQuestion(q, { examTrimester: bp.trimester, requireObjective: true });
    perQuestion.push({ idx, ...res });
    for (const i of res.issues) issues.push(issue(i.severity, i.code, `السؤال ${idx + 1}: ${i.message}`, idx));
  });
  const qErrors = perQuestion.filter((p) => !p.valid);
  checks.push({
    id: 'questions',
    label: 'صحة الأسئلة (منهج + إجابة + وضوح + مستوى)',
    status: qErrors.length ? 'fail' : perQuestion.some((p) => p.issues.length) ? 'warn' : 'pass',
    detail: qErrors.length ? `${qErrors.length} سؤال(ات) مرفوض(ة)` : ''
  });

  // 2a) سلامة العدّاد (§51): عدد الأسئلة يجب أن يساوي المخطّط — النموذج الذي يعيد
  //     5 من 8 أسئلة لا يمرّ بـ«ناجح» بصمت. opt-in عبر opts.requireCount (مسار التوليد).
  if (opts.requireCount) {
    const want = Number(bp.questionCount) || 0;
    const got = questions.length;
    const countOk = want > 0 && got === want;
    if (!countOk) {
      issues.push(issue('error', 'QUESTION_COUNT_MISMATCH', `عدد الأسئلة (${got}) لا يساوي عدد المخطّط (${want}) — اختبار ناقص أو زائد (§51)`));
    }
    checks.push({
      id: 'count',
      label: 'عدّاد الأسئلة يساوي المخطّط (§51)',
      status: countOk ? 'pass' : 'fail',
      detail: countOk ? `${got}/${want}` : `${got} من ${want}`
    });
  }

  // 2b) الانتماء لنطاق المخطّط (§57,§58): الدرس/المجال/المكتسب يجب أن يكونا
  // ضمن نطاق المخطّط الثلاثي نفسه — الحارس أعلاه يفحص السنة كاملة، هنا النطاق المعلن.
  if (Array.isArray(bp.scopeLessonIds) && bp.scopeLessonIds.length) {
    const scopeLessonTitles = (bp.scopeLessons || []).map((l) => normalizeArabic(l.title));
    const scopeDomains = (bp.domains || []).map((d) => normalizeArabic(d));
    const scopeComps = (bp.competencies || []).map((c) => normalizeArabic(c));
    const outOfScope = [];
    questions.forEach((q, idx) => {
      const lesson = String(q.lesson || '').trim();
      const domain = String(q.domain || '').trim();
      const comp = String(q.competency || '').trim();
      if (!lesson && !domain && !comp) return; // بلا سند — عولج في فحص المخطط أعلاه (CURRICULUM_UNKNOWN)
      const inScope =
        (lesson && scopeLessonTitles.some((t) => t && matchesScopeText(lesson, t))) ||
        (domain && scopeDomains.some((d) => d === normalizeArabic(domain) || matchesScopeText(domain, d))) ||
        (comp && scopeComps.some((c) => c && (matchesScopeText(comp, c) || matchesScopeText(c, comp))));
      if (!inScope) outOfScope.push(idx);
    });
    if (outOfScope.length) {
      outOfScope.forEach((idx) => {
        issues.push(issue('error', 'OUT_OF_SCOPE', `السؤال ${idx + 1}: «${String(questions[idx].lesson || questions[idx].competency || questions[idx].domain).slice(0, 60)}» خارج نطاق المخطّط المعلن (§57)`, idx));
      });
      checks.push({
        id: 'scope',
        label: 'كل سؤال داخل نطاق المخطّط',
        status: 'fail',
        detail: `${outOfScope.length} سؤال خارج النطاق`
      });
    } else {
      checks.push({ id: 'scope', label: 'كل سؤال داخل نطاق المخطّط', status: 'pass', detail: '' });
    }
  }

  // 2c) التأصيل ومنع السؤال اليتيم (§7,§42,§105,§158): السند أصل كل سؤال سنّدي.
  //     `stimulusRequired` يفرض سندًا حقيقيًا (اختبار بلا سند = رفض §18)؛
  //     ووجود سندات يكفي لتفعيل الفحص حتى لو لم يُطلب صراحة.
  const stimuli = repaired.stimuli;
  const requireStimulus = exam.stimulusRequired === true;
  if (requireStimulus || stimuli.length) {
    const g = bindAndCheck(stimuli, questions, { requireStimulus });
    g.issues.forEach((i) => issues.push(issue(i.severity === 'error' ? 'error' : 'warn', i.code, i.message, i.qIndex)));
    questions = g.questions; // إضافة sindId الربط إلى المخرج (لا يُفقد التوثيق)
    const gErrors = g.issues.filter((i) => i.severity === 'error');
    checks.push({
      id: 'grounding',
      label: 'ارتباط الأسئلة بالسند (لا سؤال يتيم §7)',
      status: gErrors.length ? 'fail' : g.issues.length ? 'warn' : 'pass',
      detail: gErrors.length
        ? gErrors.slice(0, 3).map((i) => i.message).join('؛ ')
        : `${g.grounded}/${g.total} سؤال مؤسَّل`
    });
  } else {
    checks.push({ id: 'grounding', label: 'ارتباط الأسئلة بالسند (لا سؤال يتيم §7)', status: 'pass', detail: 'اختبار بلا سند — فحص غير مطلوب' });
  }

  // 2d) العائلة المرجعية إن وُجد نموذج مرجعي (§154-157): بنية + استجابة + قفل البيانات
  if (exam.reference && typeof exam.reference === 'object') {
    const cmp = comparePatterns(exam.reference, { ...exam, questions, stimuli });
    cmp.issues.forEach((i) => issues.push(issue(i.severity, i.code, i.message)));
    checks.push({
      id: 'pattern',
      label: 'مطابقة عائلة النموذج المرجعي (§154-157)',
      status: cmp.status === 'fail' ? 'fail' : cmp.issues.length ? 'warn' : 'pass',
      detail: cmp.issues.map((i) => i.message).join('؛ ')
    });
  }

  // 2e) نقاء المادة وملفها (§55,§79 + Spec §14-§15): الاختبار يقيس مادته فقط —
  //     لا رمز مادة أخرى، ولا محتوى حسابي في مادة تمنعه، ونوع المثير من ملف المادة.
  const sp = bp.subject ? getSubjectProfile(bp.subject) : null;
  const subjectIssues = [];
  if (bp.subject) {
    const quant = !forbidsArithmetic(bp.subject);
    questions.forEach((q, idx) => {
      const qSubject = String(q.subject || '').trim();
      if (qSubject && qSubject !== String(bp.subject)) {
        subjectIssues.push(issue('error', 'SUBJECT_MISMATCH', `السؤال ${idx + 1}: مادته «${subjectLabel(qSubject)}» تخالف مادة المخطّط «${subjectLabel(bp.subject)}» (§55)`, idx));
        return;
      }
      if (quant) return;
      const qText = [
        q.prompt,
        ...(Array.isArray(q.options) ? q.options : []),
        ...(Array.isArray(q.orderItems) ? q.orderItems : [])
      ].join(' \n ');
      const signal = arithmeticSignal(qText);
      if (signal) {
        subjectIssues.push(issue('error', 'SUBJECT_MIX', `السؤال ${idx + 1}: محتوى حسابي «${signal}» في اختبار «${subjectLabel(bp.subject)}» — الاختبار يقيس مادته فقط (§55,§79)`, idx));
      }
    });
    if (!quant) {
      stimuli.forEach((s, i) => {
        const signal = arithmeticSignal(s.text);
        if (signal) {
          subjectIssues.push(issue('error', 'SUBJECT_MIX', `المثير ${i + 1}: محتوى حسابي «${signal}» في اختبار «${subjectLabel(bp.subject)}» — المثير نصّي بلا حساب (§55,§79)`));
        }
      });
    }
    // نوع المثير (Spec §14-§15): من ملف المادة، والخروج عنه تنبيه لا إسقاط صامت.
    const allowedTypes = Array.isArray(sp?.stimulusTypes) ? sp.stimulusTypes : [];
    stimuli.forEach((s, i) => {
      const t = String(s.stimulusType || 'text');
      if (allowedTypes.length && !allowedTypes.includes(t)) {
        subjectIssues.push(issue('warn', 'STIMULUS_TYPE', `المثير ${i + 1}: نوعه «${t}» خارج أنواع «${sp.label}» المسموحة (${allowedTypes.join('، ')}) (§14)`));
      }
    });
  }
  issues.push(...subjectIssues);
  checks.push({
    id: 'subject',
    label: 'نقاء المادة ونوع المثير (§55,§14)',
    status: subjectIssues.some((i) => i.severity === 'error') ? 'fail' : subjectIssues.length ? 'warn' : 'pass',
    detail: subjectIssues.slice(0, 3).map((i) => i.message).join('؛ ')
  });

  // 2e′) اشتقاق حتمي للبنية (§D12,§B2) — قبل محقّق المادة كي يراها محقّق الرياضيات:
  //   - layout: «عمودي» ← إطار مستقل للعملية العمودية، فعل رسم ← مساحة رسم.
  //   - criterion: إجباري لكل سؤال **بكل المواد** (قرار المستخدم §D8): الرموز
  //     الرسمية M1–M4/D/HC للرياضيات، وشبكة التنقيط (مع1..) لبقية المواد.
  //   يُشغَّل مع requireStructure فقط حتى لا تتغيّر وحدات الاختبار القائمة.
  const DRAW_VERB = /ارسم|أرسم|أكمل (?:المسار|الرسم|الشكل)/;
  let specMatrix = null;
  let analyticalLines = [];
  if (opts.requireStructure) {
    const grid = criteriaGrid(bp.subject);
    questions.forEach((q) => {
      const p = String(q?.prompt || '');
      if (!q.layout && /عمودي/.test(p)) q.layout = 'vertical';
      if (!q.layout && DRAW_VERB.test(p)) q.layout = 'drawing';
      // القيمة الصريحة إن كانت مشروعية، وإلا الاشتقاق الحتمي من نصّ المهمّة
      q.criterion = assignCriterion(q, { subject: bp.subject, grid });
    });
  }

  // 2f) محقّق المادة المتخصص (Spec §33-§34): المحقّق العام (أعلاه) PASS
  //     **و** محقّق المادة PASS — وإلا لا يُعتمد الاختبار.
  const { issues: specIssues, ran: specRan } = runSubjectValidators({ blueprint: bp, questions, stimuli, strict: !!opts.requireStructure });
  specIssues.forEach((i) => issues.push(issue(i.severity, i.code, i.message, i.qIndex)));
  const specErrors = specIssues.filter((i) => i.severity === 'error');
  checks.push({
    id: 'subjectFit',
    label: specRan.length ? `ملف المادة: محقّق ${specRan.join(' + ')} (PASS AND PASS)` : 'ملف المادة: لا محقّق متخصص مسجّل',
    status: specErrors.length ? 'fail' : specIssues.length ? 'warn' : 'pass',
    detail: specIssues.length ? specIssues.slice(0, 3).map((i) => i.message).join('؛ ') : (specRan.length ? 'مطابق لملف المادة' : '')
  });

  // 2g) بنية الورقة (MASTER PROMPT §4,§6,§7,§36): نصّ القراءة بطول السنة وتشكيل
  //     تام، فرص قياس صريحة في القراءة y3+ (قرينة/تعليل/رأي)، وتنويع الصيغ —
  //     فرضيات في الكود لا في الـPrompt. opt-in عبر opts.requireStructure (مسار التوليد)
  //     بنمط requireCount حتى لا تتغيّر وحدات الاختبار القائمة.
  if (opts.requireStructure) {
    const gp = getGradeProfile(bp.grade);
    const textIssues = checkStimulusText({ stimuli, gradeProfile: gp, subjectProfile: sp });
    const itemIssues = checkReadingItems({ questions, gradeProfile: gp, subjectProfile: sp });
    const variety = checkFormatVariety(questions);
    const chainIssues = checkAnswerChain(questions, stimuli);
    const metaIssues = checkStimulusMeta(stimuli);
    // §C7 الإيقاظ: تعليل + اكتشف/أصلح الخطأ بصيغة صحيحة (يُشترط من y2)
    const scienceIssues = checkScienceItems({ questions, gradeProfile: gp, subjectProfile: sp });
    // §C1,§C11: الصيغ من نصّ التعليمة + جدول التكرار + حدود العربية
    const labelStats = checkFormatLabels(questions, bp.subject);
    // §A2,§C13,§D6: قسم الحساب الذهني إن وُجد في المخطّط أو الأسئلة
    const mental = checkMentalShape({
      mentalMath: exam.mentalMath || bp.mentalMath || null,
      questions,
      targetPoints: Number(bp.targetPoints) || 20
    });
    const structureIssues = [
      ...textIssues, ...itemIssues, ...variety.issues, ...chainIssues, ...metaIssues,
      ...scienceIssues, ...labelStats.issues, ...mental.issues
    ];
    structureIssues.forEach((i) => issues.push(issue(i.severity, i.code, i.message, i.qIndex)));
    checks.push({
      id: 'text',
      label: 'جودة نصّ القراءة (طول السنة + تشكيل تام §6-§7)',
      status: textIssues.some((i) => i.severity === 'error') ? 'fail' : textIssues.length ? 'warn' : 'pass',
      detail: textIssues.slice(0, 2).map((i) => i.message).join('؛ ')
    });
    if (sp?.id === 'reading') {
      const readErr = itemIssues.filter((i) => i.severity === 'error');
      checks.push({
        id: 'readingItems',
        label: 'فرص قياس القراءة (قرينة + تعليل + رأي §27)',
        status: readErr.length ? 'fail' : itemIssues.length ? 'warn' : 'pass',
        detail: readErr.length ? readErr.map((i) => i.message).join('؛ ') : 'الفرص الثلاث متوفرة'
      });
    }
    if (sp?.id === 'science' && (Array.isArray(gp.scienceItems) ? gp.scienceItems.length : 0)) {
      const sciErr = scienceIssues.filter((i) => i.severity === 'error');
      checks.push({
        id: 'scienceItems',
        label: 'الإيقاظ: تعليل + اكتشف/أصلح الخطأ بصيغة صحيحة (§C7)',
        status: sciErr.length ? 'fail' : scienceIssues.length ? 'warn' : 'pass',
        detail: sciErr.length ? sciErr.map((i) => i.message).join('؛ ') : 'فرصتا التعليل والإصلاح متوفرتان'
      });
    }
    checks.push({
      id: 'formats',
      label: 'تنويع صيغ الأسئلة (لا هيمنة قالب §36)',
      status: variety.issues.some((i) => i.severity === 'error') ? 'fail' : variety.issues.length ? 'warn' : 'pass',
      detail: `${variety.distinct} صيغ في ${variety.total}: ${variety.table}`
    });
    checks.push({
      id: 'formatLabels',
      label: 'كاشف الصيغ من نصّ التعليمة + جدول التكرار (§C1,§C11)',
      status: labelStats.issues.some((i) => i.severity === 'error') ? 'fail' : labelStats.issues.length ? 'warn' : 'pass',
      detail: labelStats.issues.length
        ? labelStats.issues.map((i) => i.message).join('؛ ')
        : `${labelStats.distinct} صيغ: ${labelStats.table}`
    });
    if (mental.ran) {
      const menErr = mental.issues.filter((i) => i.severity === 'error');
      checks.push({
        id: 'mental',
        label: 'شكل قسم الحساب الذهني المستقل (§A2,§C13,§D6)',
        status: menErr.length ? 'fail' : mental.issues.length ? 'warn' : 'pass',
        detail: menErr.length ? menErr.map((i) => i.message).join('؛ ') : 'عنوانه وزمنه وتنقيطه مطابقون'
      });
    }
    checks.push({
      id: 'chain',
      label: 'لا يكشف سؤال لاحق إجابة سؤال سابق (§D11)',
      status: chainIssues.some((i) => i.severity === 'error') ? 'fail' : 'pass',
      detail: chainIssues[0]?.message || 'لا كشف مباشر'
    });
    checks.push({
      id: 'sanadMeta',
      label: 'السند بلسان التلميذ لا بلسان التخطيط (§/كفاءات/أهداف)',
      status: metaIssues.some((i) => i.severity === 'error') ? 'fail' : 'pass',
      detail: metaIssues[0]?.message || 'لا نصّ منهجي داخل السندات'
    });
    if (bp.subject === 'math' && questions.length) {
      const dist = criteriaDistribution(questions);
      const distText = Object.entries(dist)
        .map(([k, v]) => `${MATH_CRITERIA[k].code}=${v.points}ن/×${v.count}`)
        .join(' · ');
      // تغطية المعايير الأربعة (S1): ناقص ← تنبيه صادق لا حجب — القرار للمعلّم.
      const covered = Object.keys(dist)
        .filter((k) => MATH_CRITERIA[k]?.kind === 'standard').length;
      checks.push({
        id: 'criteria',
        label: 'إسناد المعيار الرسمي لكل سؤال (رمز ظاهر + مصدر §B2)',
        status: covered >= 4 ? 'pass' : 'warn',
        detail: `${criteriaTable(questions)} ⟵ ${distText} · تغطية المعايير: ${covered}/4`
      });
    }
  }

  // 3) التكرار (§53,§110)
  const dups = findDuplicates(questions);
  const hardDups = dups.filter((d) => d.level === 'duplicate');
  const softDups = dups.filter((d) => d.level === 'similar');
  hardDups.forEach((d) => issues.push(issue('error', 'DUPLICATE', `السؤالان ${d.a + 1} و${d.b + 1} متطابقان (${Math.round(d.ratio * 100)}%)`, d.a)));
  // تحذير عند تكرار أكثر من ثلثي المقياس (§10: REJECT حسب نسبة التكرار)
  if (softDups.length > questions.length * 0.5 && questions.length >= 4) {
    softDups.slice(0, 3).forEach((d) => issues.push(issue('warn', 'SIMILAR', `السؤالان ${d.a + 1} و${d.b + 1} متشابهان (${Math.round(d.ratio * 100)}%) — أعد صياغة أحدهما`, d.a)));
  }
  checks.push({
    id: 'duplicates',
    label: 'لا تكرار بين الأسئلة',
    status: hardDups.length ? 'fail' : softDups.length ? 'warn' : 'pass',
    detail: hardDups.length ? `${hardDups.length} زوج متطابق` : softDups.length ? `${softDups.length} زوج متشابه` : ''
  });

  // 4) التنقيط (§7,§46): Σ = الهدف
  const target = Number(bp.targetPoints) || 20;
  let totalCheck = verifyTotal(questions, target);
  if (!totalCheck.ok && opts.autoFixPoints !== false) {
    const fixed = distributePoints(questions, target);
    questions = fixed.questions;
    totalCheck = verifyTotal(questions, target);
    if (totalCheck.ok) {
      issues.push(issue('warn', 'POINTS_REDISTRIBUTED', `أُعيد توزيع النقاط آليًّا ليصبح المجموع = ${target} (§7)`));
    }
  }
  if (!totalCheck.ok) {
    issues.push(issue('error', 'POINTS_MISMATCH', `مجموع النقاط ${totalCheck.total} لا يساوي الهدف ${totalCheck.target} (§7,§125)`));
  }
  checks.push({
    id: 'points',
    label: `مجموع النقاط = ${target}`,
    status: totalCheck.ok ? 'pass' : 'fail',
    detail: totalCheck.ok ? '' : `الفعلي: ${totalCheck.total}`
  });

  // 4b) مصفوفة المواصفات + التقرير التحليلي (§D8,§A4,§C4) — تُبنى بعد تصحيح
  //     النقاط حتى تحمل الأرقام النهائية: معيار ← مؤشر ← صيغة ← نقاط ← عتبات ←
  //     أخطاء متوقعة ← تشخيص. CRITERION_MISSING إن تعذّر إسناد أي سؤال.
  if (opts.requireStructure) {
    const grid = criteriaGrid(bp.subject);
    specMatrix = buildSpecMatrix({ questions, grid, subject: bp.subject, targetPoints: target });
    analyticalLines = analyticalReport(specMatrix);
    const missingCrit = questions.filter((q) => !q.criterion);
    missingCrit.forEach((q) => {
      issues.push(issue('error', 'CRITERION_MISSING', `سؤال بلا معيار من مخطّط المعايير القابل للتهيئة («${String(q.prompt || '').slice(0, 40)}…») — حقل criterion إجباري لكل سؤال (§D8)`));
    });
    checks.push({
      id: 'specMatrix',
      label: 'مصفوفة المواصفات: معيار مُسند لكل سؤال + تقرير تحليلي (§D8)',
      status: missingCrit.length ? 'fail' : 'pass',
      detail: missingCrit.length
        ? `${missingCrit.length} سؤال بلا معيار (CRITERION_MISSING)`
        : `${specMatrix.rows.length} معيار · مقاس ${specMatrix.covered}/${specMatrix.standards} · التقرير التحليلي مرفق`
    });
  }

  // 5) التغطية والحمل (§9,§37,§38,§118)
  const coverage = analyzeCoverage(questions, { ...bp, durationMinutes: exam.durationMinutes || bp.durationMinutes });
  issues.push(...coverage.warnings);
  checks.push({
    id: 'coverage',
    label: 'التغطية متوازنة (مكتسبات/صعوبة/أنواع)',
    status: coverage.warnings.some((w) => w.severity === 'error') ? 'fail' : coverage.warnings.length ? 'warn' : 'pass',
    detail: coverage.warnings.map((w) => w.message).join('؛ ')
  });

  // 6) الطابع الطباعي (§100,§104): لا metadata ممنوعة في نسخة التلميذ + حقول الطباعة
  const forbiddenInPrint = ['correct_answer', 'aiConfidence', 'generatedAt', 'prompt_model'];
  const printIssues = questions.filter((q) => forbiddenInPrint.some((k) => k in q));
  if (printIssues.length) {
    issues.push(issue('warn', 'PRINT_METADATA', `${printIssues.length} سؤال يحوي بيانات داخلية — تنظّفها العارض قبل الطباعة (§104)`));
  }
  const missingPrompt = questions.filter((q) => !String(q.prompt || '').trim()).length;
  checks.push({
    id: 'layout',
    label: 'جاهزية الطباعة (نصوص كاملة، بلا بيانات داخلية)',
    status: missingPrompt ? 'fail' : printIssues.length ? 'warn' : 'pass',
    detail: missingPrompt ? `${missingPrompt} سؤال بلا نص` : ''
  });

  // 7) الحوكمة (§61,§106): التوليد لا يُعتمد مباشرة
  const hasError = issues.some((i) => i.severity === 'error');
  checks.push({
    id: 'review',
    label: 'حالة المراجعة (التوليد الآلي لا يُنشر مباشرة)',
    status: hasError ? 'fail' : 'warn',
    detail: hasError ? 'مرفوض — عدِّل ثم أعد الفحص' : 'يحتاج مراجعة المدرس ثم «اعتماد» (§61)'
  });

  const approved = !hasError;
  const status = hasError ? 'rejected' : 'needs_review';
  const report = auditReportLines(buildAudit(checks));
  // سطور التقرير التحليلي (معيار←مؤشر←نقاط←عتبات←تشخيص) تُرفق بتقرير المعلّم
  if (analyticalLines.length) report.push(...analyticalLines);
  return {
    approved, status, questions, issues, audit: buildAudit(checks), coverage, report, repairNotes, stimuli,
    specMatrix,
    analyticalReport: analyticalLines
  };
}

/** عقد النشر النهائي (§125) — يُستدعى قبل `published:true`. */
export function assertPublishable(exam = {}) {
  const missing = [];
  if (!exam.blueprint?.grade) missing.push('grade');
  if (!exam.blueprint?.subject) missing.push('subject');
  if (!exam.blueprint?.trimester) missing.push('term');
  const questions = exam.questions || [];
  if (!questions.length) missing.push('questions');
  const target = Number(exam.blueprint?.targetPoints) || 20;
  if (questions.length && totalPoints(questions) !== target) missing.push('pointsTotal');
  if (questions.some((q) => !q.prompt)) missing.push('prompt');
  // السند إلزامي في الاختبار السنّدي (§18,§105): لا نشر لورقة بلا أصل
  if (exam.stimulusRequired === true && !(Array.isArray(exam.stimuli) && exam.stimuli.length)) missing.push('stimuli');
  // الإجابة الصحيحة: correctAnswer لكل الأنواع المغلقة — إلا سؤال الترتيب الذي
  // يحمل تسلسله الصحيح في orderItems (لا نمنع نشر اختبار ترتيب صحيح أبدًا §125).
  const unanswered = questions.filter((q) => {
    if (q.type === 'OPEN') return false;
    if (q.type === 'ORDER' && Array.isArray(q.orderItems) && q.orderItems.length >= 2) return false;
    return q.correctAnswer === undefined || q.correctAnswer === null || String(q.correctAnswer).trim() === '';
  });
  if (unanswered.length) missing.push('answers');
  return { ok: missing.length === 0, missing };
}



