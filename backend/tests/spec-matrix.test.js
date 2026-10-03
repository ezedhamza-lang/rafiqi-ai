// اختبارات مصفوفة المواصفات والتقرير التحليلي (spec-matrix.js) — §D8,§A4,§C4,§B2.
// حقل criterion إجباري لكل سؤال من مخطّط المعايير القابل للتهيئة:
//   الرياضيات ← الرموز الرسمية M1..M4/D (مصدر S1) · الباقي ← شبكة مع1..
//   معيار التمييز لا يُسند أبدًا (§A5) · التقرير: معيار←مؤشر←نقاط←عتبات←تشخيص.

import { describe, it, expect } from 'vitest';
import { assignCriterion, criterionValid, buildSpecMatrix, analyticalReport } from '../src/exams/spec-matrix.js';
import { criteriaGrid } from '../src/exams/criteria-grids.js';
import { criteriaDisplay } from '../src/exams/criterion-map.js';

describe('criterionValid + assignCriterion: الإسناد الحتمي (§D8)', () => {
  const mathGrid = criteriaGrid('math');
  const arabicGrid = criteriaGrid('arabic');

  it('رياضيات: كل سؤال يأخذ رمزًا رسميًّا من {M1..M4, D}', () => {
    const qs = [
      { type: 'MCQ', prompt: 'فسّري: كيف استطاعت أن تشتري بـ 2450 مليمًا ؟' },
      { type: 'FILL_BLANK', prompt: 'أنجزي العملية عموديًّا: 2450 − 930 = …. مليمًا.' },
      { type: 'OPEN', prompt: 'ارسمي على الشبكة مسارًا من 6 عقدٍ.' },
      { type: 'FILL_BLANK', prompt: 'حوّل طول الممرّ: 25 م = …. سم.' },
      { type: 'MCQ', prompt: 'ما مجموع 15 + 8 ؟' },
      { type: 'EXTRACT', prompt: 'استخرج مبلغ الادخار.' }
    ];
    qs.forEach((q) => {
      const c = assignCriterion(q, { subject: 'math', grid: mathGrid });
      expect(['M1', 'M2', 'M3', 'M4', 'D']).toContain(c);
      expect(criterionValid('math', c, mathGrid)).toBe(true);
    });
  });

  it('القيمة الصريحة الصحيحة تبقى، والباطلة تُشتقّ من الشبكة', () => {
    expect(assignCriterion({ type: 'MCQ', prompt: 'س؟', criterion: 'M2' }, { subject: 'math', grid: mathGrid })).toBe('M2');
    expect(assignCriterion({ type: 'MCQ', prompt: 'س؟', criterion: 'مع2' }, { subject: 'arabic', grid: arabicGrid })).toBe('مع2');
    expect(assignCriterion({ type: 'MCQ', prompt: 'اختر من النصّ.', criterion: 'مع9' }, { subject: 'arabic', grid: arabicGrid })).not.toBe('مع9');
    expect(criterionValid('arabic', 'مع9', arabicGrid)).toBe(false);
    expect(criterionValid('math', 'HC', mathGrid)).toBe(true);
    expect(criterionValid('math', 'مع1', mathGrid)).toBe(false); // رمز شبكة ليس كودًا رسميًّا
  });

  it('غير الرياضيات: معيار التمييز (excellence) لا يُسند أبدًا — للأقصى فقط (§A5)', () => {
    const prompts = [
      { type: 'MCQ', prompt: 'مع من ذهبت إلى المكتبة ؟' },
      { type: 'TRUE_FALSE', prompt: 'الحديقة نظيفة.' },
      { type: 'FILL_BLANK', prompt: 'يسقي المربي … كل صباح.' },
      { type: 'EXTRACT', prompt: 'اكتب من النصّ قرينةً.' },
      { type: 'OPEN', prompt: 'اكتب جملتين تصف فيهما الحديقة.' },
      { type: 'OPEN', prompt: 'هل توافق؟ علّل رأيك.' },
      { type: 'ORDER', prompt: 'رتّب الأحداث.' },
      { type: 'MCQ', prompt: 'علّل اختيارك.' }
    ];
    prompts.forEach((q) => {
      const c = assignCriterion(q, { subject: 'arabic', grid: arabicGrid });
      expect(c, `سؤال: ${q.prompt}`).toBeTruthy();
      expect(c).not.toBe('مع3'); // مع3 = التصرف وإبداء الرأي وله excellence في شبكة العربية
    });
  });

  it('بلا شبكة معايير → null (يصير CRITERION_MISSING في المخطّط)', () => {
    expect(assignCriterion({ type: 'MCQ', prompt: 'س؟' }, { subject: 'x', grid: [] })).toBeNull();
    expect(criterionValid('x', '', [])).toBe(false);
  });
});

describe('buildSpecMatrix: الصفوف والنقاط والعتبات (§D8,§A4)', () => {
  const mathGrid = criteriaGrid('math');

  const mathQuestions = [
    { type: 'MCQ', points: 3, prompt: 'فسّري: كيف اشترت كراسًا وهي تملك 2450 مليمًا ؟' },
    { type: 'FILL_BLANK', points: 4, prompt: 'أنجزي العملية عموديًّا: 2450 − 930 = …. مليمًا.' },
    { type: 'FILL_BLANK', points: 3, prompt: 'حوّل طول الممرّ: 25 م = …. سم.' },
    { type: 'OPEN', points: 3, prompt: 'ارسمي على الشبكة مسار رحاب: 6 عقدٍ يمينًا.' },
    { type: 'MCQ', points: 2, prompt: 'ما مجموع طول الممرّ وعرضه ؟' },
    { type: 'TRUE_FALSE', points: 2, prompt: 'هل يكفي مبلغ رحاب الأصليّ للشراء ؟' },
    { type: 'EXTRACT', points: 3, prompt: 'استخرج من السندّ مبلغ الادخار.' }
  ].map((q) => ({ ...q, criterion: assignCriterion(q, { subject: 'math', grid: mathGrid }) }));

  it('رياضيات 20ن: 5 صفوف، Σنقاط = 20، Σ عتبات القصوى = الهدف (§7)', () => {
    const m = buildSpecMatrix({ questions: mathQuestions, grid: mathGrid, subject: 'math', targetPoints: 20 });
    expect(m.rows).toHaveLength(5);
    expect(m.sum).toBe(20);
    expect(m.rows.reduce((s, r) => s + r.points, 0)).toBe(20);
    expect(m.rows.reduce((s, r) => s + r.mastery.max, 0)).toBe(20);
    expect(m.unmatched).toEqual([]);
    expect(m.component).toEqual([]); // لا أسئلة HC في هذه الورقة
    // كل صفّ حامل لرمز رسمي + مصدر + مؤشر (§B2,§C4)
    expect(m.rows.every((r) => r.officialCode && r.source.includes('رسمي'))).toBe(true);
    expect(m.rows.every((r) => r.indicator && r.expectedErrors)).toBe(true);
  });

  it('صفّ بلا أسئلة → تشخيص صادق لا تجميل («لا أسئلة تقيس هذا المعيار»)', () => {
    const m = buildSpecMatrix({ questions: mathQuestions, grid: mathGrid, subject: 'math', targetPoints: 20 });
    const empty = m.rows.find((r) => !r.questionNos.length);
    if (empty) {
      expect(empty.diagnosis).toMatch(/لا أسئلة|تمييز/);
      expect(empty.points).toBe(0);
    }
    // معيار التمييز مع5: إن كان بلا أسئلة فتشخيصه بصيغة التمييز §A5
    const dist = m.rows.find((r) => r.criterion === 'مع5' && !r.questionNos.length);
    if (dist) expect(dist.diagnosis).toContain('تمييز');
  });

  it('هدف 10 نقاط → العتبات تُحجَّم مع الشبكة (Σ max = 10)', () => {
    const m = buildSpecMatrix({ questions: [], grid: mathGrid, subject: 'math', targetPoints: 10 });
    expect(m.rows.reduce((s, r) => s + r.mastery.max, 0)).toBe(10);
    expect(m.covered).toBe(0);
    expect(m.standards).toBe(4); // غير التمييز
  });

  it('سؤال بمعيار غير موجود في الشبكة → unmatched مُعلَن في التقرير', () => {
    const m = buildSpecMatrix({
      questions: [{ type: 'MCQ', points: 2, prompt: 'س؟', criterion: 'M9' }],
      grid: mathGrid, subject: 'math', targetPoints: 20
    });
    expect(m.unmatched).toEqual([1]);
    expect(analyticalReport(m).join('\n')).toContain('خارج المصفوفة');
  });
});

describe('analyticalReport: تقرير المعلّم التحليلي (§C4)', () => {
  it('يحمل الأعمدة السبعة: معيار/مؤشر/صيغ/نقاط/مستويات وعتبات/أخطاء متوقعة/تشخيص', () => {
    const grid = criteriaGrid('arabic');
    const qs = [
      { type: 'MCQ', points: 3, prompt: 'مع من ذهبت مريم إلى المكتبة ؟' },
      { type: 'EXTRACT', points: 4, prompt: 'اكتب من النصّ قرينةً تدلّ على الهدوء.' },
      { type: 'OPEN', points: 5, prompt: 'اشرح بأسلوبك كيف تحافظ على النظافة.' },
      { type: 'FILL_BLANK', points: 4, prompt: 'استعارت نور كتابًا عن … من المكتبة.' },
      { type: 'TRUE_FALSE', points: 4, prompt: 'كتبت مريم اسمها على الورقة.' }
    ].map((q) => ({ ...q, criterion: assignCriterion(q, { subject: 'arabic', grid }) }));
    const m = buildSpecMatrix({ questions: qs, grid, subject: 'arabic', targetPoints: 20 });
    const lines = analyticalReport(m);
    expect(lines[0]).toContain('التقرير التحليلي');
    const body = lines.join('\n');
    expect(body).toContain('مؤشر');
    expect(body).toContain('أسئلة');
    expect(body).toContain('المستويات');
    expect(body).toContain('أخطاء متوقعة');
    expect(body).toContain('التغطية:');
    // لا رمز رسمي M لغير الرياضيات
    expect(m.rows.every((r) => r.officialCode === null)).toBe(true);
    expect(m.rows.every((r) => r.source.includes('داخلي'))).toBe(true);
  });

  it('مصفوفة فارغة → لا سطور (لا تقرير كاذب)', () => {
    expect(analyticalReport({})).toEqual([]);
  });
});

describe('criteriaDisplay: الرموز الرسمية للرياضيات فقط', () => {
  it('رياضيات → M1..D مع المصدر، وقراءة/عربية → null', () => {
    expect(criteriaDisplay('مع1', 'math')).toEqual({ officialCode: 'M1', source: 'رسمي – S1' });
    expect(criteriaDisplay('مع5', 'الرياضيات')?.officialCode).toBe('D');
    expect(criteriaDisplay('مع1', 'reading')).toBeNull();
    expect(criteriaDisplay('مع1', 'اللغة العربية')).toBeNull();
    expect(criteriaDisplay('مع1', 'science')).toBeNull();
    expect(criteriaDisplay('مع1')).toBeTruthy(); // بلا subject: توافق قديم للمسارات القائمة
  });
});
