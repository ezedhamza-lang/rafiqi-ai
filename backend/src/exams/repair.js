// مرحلة الإصلاح الحتمي — Deterministic Repair Stage (Spec §36, §42).
//
// الفصل: ما يمكن ترميمه برمجيًّا يُصلَح هنا قبل التدقيق — لا يُطلب من النموذج في
// الـPrompt (إصلاح في الـPrompt = عشوائية في الإخراج)، وما لا يمكن إصلاحه يبقى
// خطأً صريحًا يذهب في previousIssues لإعادة المحاولة.
// الخصائص: حتمي، بلا نموذج، بلا مصادفة، وقابل للتكرار (idempotent: التشغيل الثاني
// لا يعثر على شيء لإصلاحه فتبقى الملاحظات صفرية).
// ما لا يُصلَح أبدًا: نقاء المادة (SUBJECT_MIX/SUBJECT_MISMATCH) — كشف ورفض لا ترميم.

import { normalizeArabic } from '../services/curriculumService.js';
import { defaultStimulusType, getSubjectProfile } from './profiles/index.js';

// صيغ صح/خطأ الشائعة من النماذج ← الصيغة القانونية المقبولة (§27)
const TF_CANON = new Map([
  ['صواب', 'صواب'], ['صحيح', 'صواب'], ['صح', 'صواب'], ['true', 'صواب'], ['correct', 'صواب'],
  ['خطا', 'خطأ'], ['غلط', 'خطأ'], ['false', 'خطأ'], ['incorrect', 'خطأ']
]);

/**
 * إصلاح حتمي لمخرج التوليد قبل التدقيق.
 * @param {{blueprint:object, questions:Array, stimuli:Array, notes:Array}} input
 * @returns {{questions:Array, stimuli:Array, notes:Array}} notes: {severity, code, message, qIndex?}
 */
export function repairExam({ blueprint = {}, questions = [], stimuli = [], notes = [] } = {}) {
  const out = Array.isArray(notes) ? [...notes] : [];
  const sp = getSubjectProfile(blueprint.subject);
  const allowedTypes = Array.isArray(sp.stimulusTypes) ? sp.stimulusTypes : [];

  /* — (1) المثيرات: نوع المثير من ملف المادة + معرّفات فريدة — */
  const stimIdMap = new Map(); // المعرّف القديم ← المعرّف النهائي (هوية إن لم يتغيّر)
  const seenStim = new Set();
  const fixedStimuli = [];
  (Array.isArray(stimuli) ? stimuli : []).filter(Boolean).forEach((raw, i) => {
    const s = { ...raw };
    const oldId = String(s.id ?? '');
    const type = String(s.stimulusType || '').trim();
    if (!type) {
      // بلا نوع معلن ← النوع الافتراضي لملف المادة (صامت: لم يُطلب شيء خاطئ)
      s.stimulusType = defaultStimulusType(blueprint.subject);
    } else if (allowedTypes.length && !allowedTypes.includes(type)) {
      const def = defaultStimulusType(blueprint.subject);
      out.push({
        severity: 'warn',
        code: 'STIMULUS_TYPE_FIXED',
        message: `المثير ${i + 1}: نوعه «${type}» خارج أنواع «${sp.label}» المسموحة → صُوّر إلى «${def}» (§14)`
      });
      s.stimulusType = def;
      s.requestedStimulusType = s.requestedStimulusType || type;
    }
    let finalId;
    if (oldId && !seenStim.has(oldId)) {
      finalId = oldId;
      stimIdMap.set(oldId, oldId);
    } else {
      // معرّف مفقود أو مكرّر ← ترقيم حتمي مع خريطة إحالة
      finalId = `s${i + 1}`;
      while (seenStim.has(finalId)) finalId += 'x';
      if (oldId) stimIdMap.set(oldId, finalId);
      else stimIdMap.set(`#stim${i}`, finalId);
      s.id = finalId;
    }
    seenStim.add(finalId);
    fixedStimuli.push(s);
  });
  const stimIdSet = new Set(fixedStimuli.map((s) => String(s.id)));

  /* — (2) الأسئلة: مرجع السند + صيغ الإجابة + تفريد المعرّفات — */
  const seenQ = new Set();
  const fixedQuestions = [];
  let idNotePushed = false;
  (Array.isArray(questions) ? questions : []).filter(Boolean).forEach((raw, i) => {
    const q = { ...raw };

    // (أ) مرجع سند: معلّق (غير موجود) ← يُحذف فيُعاد ربطه حتميًّا في bindAndCheck (§151)
    if (q.sindId !== undefined && q.sindId !== null && String(q.sindId) !== '') {
      const sid = String(q.sindId);
      const mapped = stimIdMap.get(sid);
      if (mapped && stimIdSet.has(mapped)) {
        if (mapped !== sid) q.sindId = mapped; // مرجع قديم بعد إعادة ترقيم المثيرات
      } else {
        delete q.sindId;
        out.push({
          severity: 'warn',
          code: 'SIND_REF_REBOUND',
          qIndex: i,
          message: `السؤال ${i + 1}: أحال إلى سند غير موجود «${sid}» → أُحذف المرجع ليُعاد ربطه بأقرب سند (§151)`
        });
      }
    }

    // (ب) صيغة صح/خطأ: الشائعة من النماذج ← الصيغة القانونية (§27)
    if (String(q.type || '').toUpperCase() === 'TRUE_FALSE' && q.correctAnswer !== undefined && q.correctAnswer !== null) {
      const key = normalizeArabic(String(q.correctAnswer)).trim();
      const canon = TF_CANON.get(key);
      if (canon && String(q.correctAnswer) !== canon) {
        out.push({
          severity: 'warn',
          code: 'TF_ANSWER_FIXED',
          qIndex: i,
          message: `السؤال ${i + 1}: إجابة صح/خطأ «${q.correctAnswer}» عُوّضت بالصيغة القانونية «${canon}» (§27)`
        });
        q.correctAnswer = canon;
        if (q.correct !== undefined) q.correct = canon;
      }
    }

    // (ج) الاختيار من متعدد: إجابة تطابق خيارًا بعد التطبیع ← تُثبت على نص الخيار (§26)
    if (String(q.type || '').toUpperCase() === 'MCQ' && q.correctAnswer !== undefined && Array.isArray(q.options) && q.options.length) {
      const normOpts = q.options.map((o) => normalizeArabic(String(o)));
      const hit = normOpts.indexOf(normalizeArabic(String(q.correctAnswer)));
      if (hit >= 0 && q.options[hit] !== q.correctAnswer) {
        out.push({
          severity: 'warn',
          code: 'MCQ_ANSWER_ALIGNED',
          qIndex: i,
          message: `السؤال ${i + 1}: الإجابة «${q.correctAnswer}» تطابق خيارًا بعد التطبيع → ثُبّتت على «${q.options[hit]}» (§26)`
        });
        q.correctAnswer = q.options[hit];
        q.correct = q.correctAnswer;
      }
      // بدائل متطابقة بعد التطبيع ← تُحذف التكرارات (يبقى خيار واحد صحيح)
      const dedup = [];
      const dropped = [];
      const seen = () => dedup.map((x) => normalizeArabic(String(x)));
      q.options.forEach((o) => {
        const k = normalizeArabic(String(o));
        if (k && seen().includes(k)) dropped.push(o);
        else dedup.push(o);
      });
      if (dropped.length) {
        out.push({
          severity: 'warn',
          code: 'OPTIONS_DEDUPE',
          qIndex: i,
          message: `السؤال ${i + 1}: ${dropped.length} بديل(ات) متطابق(ة) بعد التطبيع حُذفت (§91)`
        });
        q.options = dedup;
      }
    }

    // (د) معرّفات الأسئلة: مفقودة أو مكرّرة ← ترقيم حتمي (لا يمسّ اختبارات المحتوى)
    const oldQid = String(q.id ?? '');
    if (!oldQid || seenQ.has(oldQid)) {
      if (!idNotePushed) {
        out.push({ severity: 'warn', code: 'QUESTION_IDS_FIXED', message: 'معرّفات أسئلة مفقودة أو مكرّرة → أُعيد ترقيمها حتميًّا' });
        idNotePushed = true;
      }
      q.id = `q${i + 1}`;
    }
    seenQ.add(String(q.id));
    fixedQuestions.push(q);
  });

  return { questions: fixedQuestions, stimuli: fixedStimuli, notes: out };
}
