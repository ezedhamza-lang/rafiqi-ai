// حارس طبقة التسمية — المرحلة A.
// 1) اختبارات دوال التسمية (سلوكها مع كل الصيغ، بلا 'undefined' ولا أكواد مسرّبة).
// 2) تشغيل حارس العرض (AST) الذي يمنع تمرير الأكواد الخام إلى المستخدم.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { subjectLabel, statusLabel, kindLabel, STATUS_CODES, KIND_CODES } from '../../frontend/src/utils/labels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(here, '../../frontend');

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

  it('حارس العرض (AST): لا أكواد خام في JSX', () => {
    const script = path.join(FRONTEND, 'scripts', 'check-raw-codes.mjs');
    expect(fs.existsSync(script)).toBe(true);
    let out = '';
    let failed = false;
    try {
      out = execFileSync(process.execPath, [script], { cwd: FRONTEND, encoding: 'utf8' });
    } catch (e) {
      failed = true;
      out = `${e.stdout || ''}${e.stderr || ''}`;
    }
    expect(failed, `مواضع تسرّب:\n${out}`).toBe(false);
    expect(out).toContain('✓');
  });
});