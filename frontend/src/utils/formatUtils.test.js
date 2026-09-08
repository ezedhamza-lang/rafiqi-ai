import { describe, it, expect } from 'vitest';
import {
  getLocale,
  isRTL,
  formatDate,
  formatNumber,
  formatPercent,
  formatCurrency,
  getCurrencySymbol,
  getLevelName,
  formatPeriod
} from './formatUtils.js';

describe('formatUtils — locale و RTL', () => {
  it('getLocale يربط اللغة بالموضع الصحيح', () => {
    expect(getLocale('ar')).toBe('ar-TN');
    expect(getLocale('en')).toBe('en-GB');
    expect(getLocale()).toBe('ar-TN');
  });
  it('isRTL يميّز العربية', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('en')).toBe(false);
  });
});

describe('formatUtils — التاريخ', () => {
  it('يعيد شرطة للقيمة الفارغة', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });
  it('يعيد النص الخام عند تاريخ غير صالح', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
  it('ينسّق تاريخاً صالحاً', () => {
    expect(formatDate('2026-09-15', 'en')).toContain('2026');
  });
});

describe('formatUtils — الأرقام والنسب', () => {
  it('formatNumber يفصل الآلاف بالإنجليزية', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
  });
  it('formatNumber يعالج القيمة غير الرقمية', () => {
    expect(formatNumber('abc', 'en')).toBe('0');
  });
  it('formatPercent يضيف علامة النسبة', () => {
    expect(formatPercent(85, 'en')).toBe('85%');
    expect(formatPercent(85.67, 'en', 1)).toBe('85.7%');
  });
});

describe('formatUtils — العملة', () => {
  it('getCurrencySymbol حسب اللغة', () => {
    expect(getCurrencySymbol('TND', 'ar')).toBe('د.ت');
    expect(getCurrencySymbol('USD', 'en')).toBe('$');
  });
  it('TND يستخدم 3 خانات عشرية والرمز بعد الرقم بالعربية', () => {
    const out = formatCurrency(150, { lang: 'ar', currency: 'TND' });
    expect(out).toContain('150');
    expect(out.trim().endsWith('د.ت')).toBe(true);
  });
  it('USD يضع الرمز قبل الرقم بالإنجليزية', () => {
    const out = formatCurrency(150, { lang: 'en', currency: 'USD' });
    expect(out).toContain('$');
    expect(out).toContain('150');
  });
});

describe('formatUtils — المستويات والفترات', () => {
  it('getLevelName يعيد الاسم حسب اللغة والفهرس', () => {
    expect(getLevelName(0, 'ar')).toBe('السنة الأولى ابتدائي');
    expect(getLevelName(0, 'en')).toBe('Primary 1');
    expect(getLevelName(99, 'en')).toBe('Level 100');
  });
  it('formatPeriod يجمع طرفي الفترة', () => {
    expect(formatPeriod('2026-01-01', '2026-12-31', 'en')).toContain('—');
  });
});
