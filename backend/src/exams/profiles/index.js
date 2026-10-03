// حلّال الملفات — Profile Resolver (Spec §29: هرم القرار, §36: Prompt Builder).
//
// `resolveProfiles({subject, grade, assessmentType})` يُخرج الثلاث ملفات جاهزة
// لتركيب البرومبت وللمدقّق: مادة + سنة + وضع. لا قاعدة صارمة داخل الكود — تُقرأ هنا.

import { getSubjectProfile, forbidsArithmetic, EVIDENCE_KINDS } from './subject-profiles.js';
import { getGradeProfile } from './grade-profiles.js';
import { getModeProfile } from './modes.js';

export { getSubjectProfile, getGradeProfile, getModeProfile, forbidsArithmetic, EVIDENCE_KINDS };

/**
 * الملفات الثلاثة لسياق توليد/تدقيق واحد.
 * @returns {{subject:object, grade:object, mode:object, evidenceKind:string, stimulusHint:string}}
 */
const STIMULUS_TYPE_PREFERENCE = ['text', 'situation', 'image', 'table', 'experiment', 'diagram', 'sequence', 'figure', 'image_text', 'audio_text', 'prompt'];

/**
 * النوع الافتراضي المقبول لمثير مادة (§14): يُشتقّ من ملف المادة لا من ذوق النموذج.
 * «نص» إن كان مقبولًا، وإلا «وضعية» إن كانت مقبولة، وإلا أول نوع في الملف.
 */
export function defaultStimulusType(code) {
  const sp = getSubjectProfile(code);
  const allowed = Array.isArray(sp.stimulusTypes) ? sp.stimulusTypes : [];
  return STIMULUS_TYPE_PREFERENCE.find((t) => allowed.includes(t)) || allowed[0] || 'text';
}

export function resolveProfiles({ subject, grade, assessmentType } = {}) {
  const subj = getSubjectProfile(subject);
  const grd = getGradeProfile(grade);
  const mode = getModeProfile(assessmentType);
  return {
    subject: subj,
    grade: grd,
    mode,
    evidenceKind: EVIDENCE_KINDS[subj.evidenceKind] || subj.evidenceKind,
    stimulusHint: subj.stimulusHint
  };
}
