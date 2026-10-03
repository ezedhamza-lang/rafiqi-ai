// توحيد المستويات (المرحلة B) — السجلّ خلف الواجهة لا يتفرّق.
// 1) مرآة الواجهة (frontend/utils/levels.js) = سجلّ الخلفية حرفًا بحرف.
// 2) التحويل من كل الصيغ إلى العنوان الرسمي متّسق بين الطرفين.
// 3) levelLabel آمن: يرمز الأكواد ويبقي العربية ولا يطبع undefined.
import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_LEVELS as BACKEND_LEVELS,
  canonicalLevel as backendCanonical,
  memoLevel,
  gradeIdFor,
  levelOrdinal
} from '../src/curriculum/levels.js';
import { OFFICIAL_LEVELS as FRONT_LEVELS, canonicalLevel as frontCanonical, levelLabel } from '../../frontend/src/utils/levels.js';

const FORM_SAMPLES = [
  'السنة الثانية ابتدائي',
  'السنة الثانية أساسي',
  'year2',
  'السنة الأولى إعدادي',
  'السنة الثانية إعدادي',
  'السنة الثالثة إعدادي',
  'السنة الثانية ثانوي',
  'السنة الرابعة ثانوي',
  'السنة السادسة ابتدائي'
];

describe('سجلّ المستويات الموحّد (المرحلة B)', () => {
  it('مرآة الواجهة مطابقة تمامًا لسجلّ الخلفية (13 مستوى)', () => {
    expect(BACKEND_LEVELS).toHaveLength(13);
    expect(FRONT_LEVELS).toEqual(BACKEND_LEVELS);
  });

  it('لا invention: الصيغ المجهولة تُرجع null في الطرفين', () => {
    const unknown = ['مستوى ساخر', '', null, 'ABC'];
    for (const u of unknown) {
      expect(backendCanonical(u)).toBeNull();
      expect(frontCanonical(u)).toBeNull();
    }
  });

  it('نفس التحويل في الطرفين لكل الصيغ المعروفة', () => {
    for (const f of FORM_SAMPLES) {
      expect(frontCanonical(f), `frontend ${f}`).toBe(backendCanonical(f));
      expect(backendCanonical(f), `backend ${f}`).not.toBeNull();
    }
  });

  it('«أساسي» وyearN يوحَّدان إلى «ابتدائي» الرسمي', () => {
    expect(backendCanonical('السنة الثانية أساسي')).toBe('السنة الثانية ابتدائي');
    expect(backendCanonical('year2')).toBe('السنة الثانية ابتدائي');
    expect(frontCanonical('السنة الثانية أساسي')).toBe('السنة الثانية ابتدائي');
    expect(frontCanonical('year2')).toBe('السنة الثانية ابتدائي');
  });

  it('memoLevel يحوّل الابتدائي إلى مفتاح المذكرات دون لمس الإعدادي/الثانوي', () => {
    expect(memoLevel('السنة الثانية ابتدائي')).toBe('السنة الثانية أساسي');
    expect(memoLevel('السنة الثانية أساسي')).toBe('السنة الثانية أساسي');
    expect(memoLevel('السنة الثانية إعدادي')).toBe('السنة الثانية إعدادي');
    expect(gradeIdFor('السنة الثانية ابتدائي')).toBe('year2');
    expect(gradeIdFor('السنة الأولى إعدادي')).toBeNull();
    expect(levelOrdinal('السنة السادسة ابتدائي')).toBe(6);
  });

  it('levelLabel يرمز الأكواد ويحفظ العربية ولا يطبع undefined', () => {
    expect(levelLabel('year2')).toBe('السنة الثانية ابتدائي');
    expect(levelLabel('السنة الثانية ابتدائي')).toBe('السنة الثانية ابتدائي');
    expect(levelLabel('نص حر')).toBe('نص حر');
    expect(levelLabel('')).toBe('—');
    expect(levelLabel(null)).toBe('—');
    expect(levelLabel('year3', 'en')).toContain('Grade 3');
  });
});