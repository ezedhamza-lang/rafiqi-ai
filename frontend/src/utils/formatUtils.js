/**
 * Format Utilities - Batch 4: Unified Date/Number/Currency Formatting
 * 
 * Centralized utilities to replace all duplicated formatDate(), timeAgo(),
 * and number formatting across the application.
 */

// ==================== LOCALE CONFIG ====================

/**
 * Get locale string for given language code
 * @param {string} lang - 'ar' or 'en'
 * @returns {string} Locale string (e.g., 'ar-TN', 'en-GB')
 */
export function getLocale(lang = 'ar') {
  return lang === 'ar' ? 'ar-TN' : 'en-GB';
}

/**
 * Check if language is RTL
 * @param {string} lang - Language code
 * @returns {boolean}
 */
export function isRTL(lang = 'ar') {
  return lang === 'ar';
}

// ==================== DATE FORMATTING ====================

/** 
 * Standard date formatting options for Arabic
 */
const AR_DATE_OPTIONS = { 
  day: 'numeric', 
  month: 'short', 
  year: 'numeric' 
};

/**
 * Standard date formatting options for English
 */
const EN_DATE_OPTIONS = { 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric' 
};

/**
 * Format a date string/Date object to localized date
 * @param {string|Date} iso - ISO date string or Date object
 * @param {string} lang - Language code ('ar' or 'en')
 * @returns {string} Formatted date or '—' if invalid
 */
export function formatDate(iso, lang = 'ar') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  
  return d.toLocaleDateString(
    getLocale(lang), 
    lang === 'ar' ? AR_DATE_OPTIONS : EN_DATE_OPTIONS
  );
}

/**
 * Format date with time (datetime)
 * @param {string|Date} iso - ISO date string or Date object
 * @param {string} lang - Language code
 * @returns {string} Formatted datetime
 */
export function formatDateTime(iso, lang = 'ar') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  
  return d.toLocaleString(getLocale(lang), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format time only (HH:MM)
 * @param {string|Date} iso - ISO date string or Date object
 * @param {string} lang - Language code
 * @returns {string} Formatted time
 */
export function formatTime(iso, lang = 'ar') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  
  return d.toLocaleTimeString(getLocale(lang), {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Relative time formatter ("منذ دقيقة", "2 ساعة", etc.)
 * @param {string|Date} iso - ISO date string or Date object
 * @param {string} lang - Language code
 * @param {Function} t - Translation function from useI18n()
 * @returns {string} Relative time string
 */
export function timeAgo(iso, lang, t) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  
  if (mins < 1) return t('time.now');
  if (mins < 60) return t('time.minutes', { n: mins });
  
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('time.hours', { n: hrs });
  
  const days = Math.floor(hrs / 24);
  if (days < 7) return t('time.daysAgo', { n: days });
  
  // Fallback to formatted date for older dates
  return formatDate(iso, lang);
}

/**
 * Full date format (for display in messages, etc.)
 * @param {string|Date} iso - ISO date string
 * @param {string} lang - Language code
 * @returns {string} Full formatted date
 */
export function fullDate(iso, lang = 'ar') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString(getLocale(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ==================== NUMBER FORMATTING ====================

/**
 * Format number according to locale
 * @param {number|string} value - Number to format
 * @param {string} lang - Language code
 * @param {Object} options - toLocaleString options
 * @returns {string} Formatted number
 */
export function formatNumber(value, lang = 'ar', options = {}) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '0';
  
  // Default options for Arabic (uses Eastern Arabic numerals context)
  const defaultOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options
  };
  
  return num.toLocaleString(getLocale(lang), defaultOptions);
}

/**
 * Format percentage
 * @param {number} value - Value (0-100)
 * @param {string} lang - Language code
 * @param {number} decimals - Decimal places (default: 0)
 * @returns {string} Formatted percentage (e.g., "85%" or "٨٥٪")
 */
export function formatPercent(value, lang = 'ar', decimals = 0) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return `0%`;
  
  const formatted = num.toFixed(decimals);
  // Use locale-aware formatting for the number part
  const numPart = Number(formatted).toLocaleString(getLocale(lang));
  
  return `${numPart}%`;
}

// ==================== CURRENCY FORMATTING ====================

/** Currency symbols by currency code and language */
const CURRENCY_SYMBOLS = {
  TND: { ar: 'د.ت', en: 'TND' },
  USD: { ar: '$', en: '$' },
  EUR: { ar: '€', en: '€' },
  GBP: { ar: '£', en: '£' }
};

/**
 * Format currency amount
 * @param {number|string} value - Amount to format
 * @param {Object} params - Formatting parameters
 * @param {string} [params.lang='ar'] - Language code
 * @param {string} [params.currency='TND'] - Currency code
 * @param {number} [params.decimals=3] - Decimal places for TND
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, { lang = 'ar', currency = 'TND', decimals = null } = {}) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return `0 ${getCurrencySymbol(currency, lang)}`;
  
  // TND traditionally uses 3 decimal places
  const defaultDecimals = decimals !== null ? decimals : (currency === 'TND' ? 3 : 2);
  
  const formattedNum = num.toLocaleString(getLocale(lang), {
    minimumFractionDigits: defaultDecimals,
    maximumFractionDigits: defaultDecimals
  });
  
  const symbol = getCurrencySymbol(currency, lang);
  
  // Arabic: symbol after number (e.g., "150.000 د.ت")
  // English: symbol before number (e.g., "TND 150.00" or "$150.00")
  if (lang === 'ar') {
    return `${formattedNum} ${symbol}`;
  } else {
    // For common Western currencies, put symbol before
    if (['USD', 'EUR', 'GBP'].includes(currency)) {
      return `${symbol}${formattedNum}`;
    }
    return `${formattedNum} ${symbol}`;
  }
}

/**
 * Get currency symbol for language
 * @param {string} currencyCode - Currency code (TND, USD, etc.)
 * @param {string} lang - Language code
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(currencyCode, lang = 'ar') {
  return (CURRENCY_SYMBOLS[currencyCode] || { ar: currencyCode, en: currencyCode })[lang] || currencyCode;
}

// ==================== PERIOD/LABEL FORMATTING ====================

/** Arabic level names */
const AR_LEVELS = [
  'السنة الأولى ابتدائي',
  'السنة الثانية ابتدائي',
  'السنة الثالثة ابتدائي',
  'السنة الرابعة ابتدائي',
  'السنة الخامسة ابتدائي',
  'السنة السادسة ابتدائي',
  'السنة الأولى إعدادي',
  'السنة الثانية إعدادي',
  'السنة الثالثة إعدادي',
  'السنة الأولى ثانوي',
  'السنة الثانية ثانوي',
  'السنة الثالثة ثانوي',
  'السنة الرابعة ثانوي'
];

/** English level names */
const EN_LEVELS = [
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'Middle 1', 'Middle 2', 'Middle 3',
  'Secondary 1', 'Secondary 2', 'Secondary 3', 'Secondary 4'
];

/**
 * Get level name by index (0-based)
 * @param {number} index - Level index (0-12)
 * @param {string} lang - Language code
 * @returns {string} Level name
 */
export function getLevelName(index, lang = 'ar') {
  const levels = lang === 'ar' ? AR_LEVELS : EN_LEVELS;
  return levels[index] || `Level ${index + 1}`;
}

/**
 * Format a period/range label
 * @param {string} start - Start date/label
 * @param {string} end - End date/label
 * @param {string} lang - Language code
 * @param {string} separator - Separator between dates
 * @returns {string} Formatted period
 */
export function formatPeriod(start, end, lang = 'ar', separator = ' — ') {
  const startFormatted = formatDate(start, lang);
  const endFormatted = formatDate(end, lang);
  
  if (start && end) {
    return `${startFormatted}${separator}${endFormatted}`;
  }
  return startFormatted || endFormatted || '';
}

// ==================== EXPORT HOOK ====================

/**
 * Composable hook-like object for format utilities
 * Use with: import { useFormatUtils } from '../utils/formatUtils';
 *        const { formatDate, formatCurrency, ... } = useFormatUtils(lang, t);
 * 
 * @param {string} lang - Current language from useI18n()
 * @param {Function} t - Translation function from useI18n()
 * @returns {Object} All formatting functions bound to current lang/t
 */
export function useFormatUtils(lang, t) {
  return {
    // Bound functions
    formatDate: (iso) => formatDate(iso, lang),
    formatDateTime: (iso) => formatDateTime(iso, lang),
    formatTime: (iso) => formatTime(iso, lang),
    timeAgo: (iso) => timeAgo(iso, lang, t),
    fullDate: (iso) => fullDate(iso, lang),
    formatNumber: (value, opts) => formatNumber(value, lang, opts),
    formatPercent: (value, dec) => formatPercent(value, lang, dec),
    formatCurrency: (value, opts) => formatCurrency(value, { ...opts, lang }),
    
    // Utilities
    getLocale: () => getLocale(lang),
    isRTL: () => isRTL(lang),
    getLevelName: (idx) => getLevelName(idx, lang),
    formatPeriod: (s, e, sep) => formatPeriod(s, e, lang, sep),
    
    // Raw exports for special cases
    _raw: {
      formatDate,
      formatDateTime,
      formatTime,
      timeAgo,
      fullDate,
      formatNumber,
      formatPercent,
      formatCurrency,
      getLocale,
      isRTL,
      getLevelName,
      formatPeriod
    }
  };
}
