// حارس طبقة التسمية — المرحلة A.
// اختبارات دوال التسمية (سلوكها مع كل الصيغ، بلا 'undefined' ولا أكواد مسرّبة).
//
// ⚠️ ملاحظة هامة (07/10/2026): كان هذا الملف يشغّل أيضًا
// `frontend/scripts/check-raw-codes.mjs` عبر execFileSync. ذلك عيب بنيوي:
// السكربت يستورد `@babel/parser` فتُحلّ من `frontend/node_modules`، وهي لا
// توجد داخل وظيفة الخادم في CI (تعمل `npm ci` في `backend/` فقط) ⇒
// ERR_MODULE_NOT_FOUND ⇐ أفشل CI متتابعًا منذ 04/10/2026.
// النقل الصحيح: الفحص البصري يخصّ الواجهة، فأُقيم في وظيفة `frontend`
// بالـCI (خطوة «Check raw codes / i18n / mojibake»). هنا بقيت اختبارات
// منطق التسمية وحدها — بلا اعتماد على حزم الواجهة.
import { describe, it, expect } from 'vitest';

import { subjectLabel, statusLabel, kindLabel, STATUS_CODES, KIND_CODES } from '../../frontend/src/utils/labels.js';

describe('طبقة التسمية الموحّدة (المرحلة A)', () => {
  it('كل حالة/نوع له تسمية عربية وإنجليزية تختلف عن الرمز', () => {
    for (const code of STATUS_CODES) {
      expect(statusLabel(code, 'ar'), `ar ${code}`).not.toBe(code);
      expect(statusLabel(code, 'en'), `en ${code}`).not.toBe(code);
      expect(statusLabel(code, 'ar')).not.toBe('');
    }
    for (const code of KIND_CODES) {
      expect(kindLabel(code, 'ar')).not.toBe(code);
      expect(kindLabel(code, 'en')).not.toBe(code);
    }
  });

  it('المواد: كل الأشكال تُترجَم، والعربية تمرّ كما هي، والتوقيع القديم سليم', () => {
    expect(subjectLabel('MATH')).toBe('الرياضيات');
    expect(subjectLabel('math')).toBe('الرياضيات');
    expect(subjectLabel('MATH', 'en')).toBe('Mathematics');
    expect(subjectLabel('رياضيات')).toBe('رياضيات');
    expect(subjectLabel('')).toBe('');
    expect(subjectLabel('anisi')).toBe('القراءة');
    expect(subjectLabel('arabic')).toBe('اللغة العربية');
    const t = (k) => k;
    expect(subjectLabel(t, 'MATH')).toBe('subjects.MATH'); // صيغة (t, code) التاريخية
  });

  it('القيم الفارغة/غير المعروفة لا تُظهر undefined', () => {
    expect(statusLabel(null)).toBe('—');
    expect(statusLabel('')).toBe('—');
    expect(kindLabel(null)).toBe('—');
    expect(statusLabel('ZZZ_UNKNOWN')).toBe('ZZZ_UNKNOWN'); // نُبقيه مرئيًّا لا نخفيه
  });
});
