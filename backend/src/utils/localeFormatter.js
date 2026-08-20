/**
 * Locale Formatter Utilities - Batch 4
 * 
 * Provides locale-aware date/number/currency formatting and RTL/LTR detection.
 * Supports Arabic (Tunisia) and English (International) locales.
 * 
 * @module localeFormatter
 */

// ============================================================
// LOCALE CONFIGURATIONS
// ============================================================

/**
 * Supported locale configurations
 * Each locale defines formatting rules for dates, numbers, and text direction
 */
export const LOCALES = {
  ar: {
    code: 'ar',
    name: 'العربية',
    nameEn: 'Arabic',
    dir: 'rtl',                    // Right-to-Left
    calendar: 'gregory',           // Use Gregorian (can be 'islamic-umalqura' for Hijri)
    timeZone: 'Africa/Tunis',      // Tunisia timezone
    // Date format patterns
    dateFormat: {
      short: 'dd/MM/yyyy',        // 15/01/2024
      medium: 'dd MMMM yyyy',     // 15 جانفي 2024
      long: 'EEEE، dd MMMM yyyy', // الاثنين، 15 جانفي 2024
      timeShort: 'HH:mm',         // 14:30
      timeLong: 'HH:mm:ss',       // 14:30:45
      datetime: 'dd/MM/yyyy HH:mm' // 15/01/2024 14:30
    },
    // Number format
    numberFormat: {
      decimal: ',',                // Arabic uses comma for decimals
      thousands: '.',              // Arabic uses dot for thousands (or space)
      currency: 'TND',            // Default currency
      currencySymbol: 'د.ت.',     // Tunisian Dinar symbol
      currencyPosition: 'after'    // Currency after amount: 100 د.ت.
    },
    // First day of week (0 = Sunday, 1 = Monday, etc.)
    firstDayOfWeek: 1,             // Monday in Arab world
    // Weekend days
    weekend: [5, 6],               // Friday, Saturday (varies by country)
    // Language family for font selection
    script: 'arab'
  },
  en: {
    code: 'en',
    name: 'English',
    nameEn: 'English',
    dir: 'ltr',                    // Left-to-Right
    calendar: 'gregory',
    timeZone: 'UTC',               // Default to UTC for international
    dateFormat: {
      short: 'MM/dd/yyyy',        // 01/15/2024 (US) or 15/01/2024 (UK)
      medium: 'MMM dd, yyyy',     // Jan 15, 2024
      long: 'EEEE, MMMM dd, yyyy', // Monday, January 15, 2024
      timeShort: 'h:mm a',        // 2:30 PM
      timeLong: 'h:mm:ss a',      // 2:30:45 PM
      datetime: 'MMM dd, yyyy h:mm a' // Jan 15, 2024 2:30 PM
    },
    numberFormat: {
      decimal: '.',                // English uses dot for decimals
      thousands: ',',              // English uses comma for thousands
      currency: 'USD',            // Default currency for international
      currencySymbol: '$',        // Dollar symbol
      currencyPosition: 'before'   // Currency before amount: $100
    },
    firstDayOfWeek: 0,             // Sunday in US/UK
    weekend: [0, 6],               // Saturday, Sunday
    script: 'latn'
  }
};

// ============================================================
// DIRECTION DETECTION (RTL/LTR)
// ============================================================

/**
 * Get text direction for a given locale
 * @param {string} lang - Language code ('ar', 'en', etc.)
 * @returns {string} 'rtl' or 'ltr'
 */
export function getDirection(lang = 'ar') {
  const locale = LOCALES[lang] || LOCALES.ar;
  return locale.dir;
}

/**
 * Check if a locale is RTL (Right-to-Left)
 * @param {string} lang - Language code
 * @returns {boolean}
 */
export function isRTL(lang = 'ar') {
  return getDirection(lang) === 'rtl';
}

/**
 * Check if a locale is LTR (Left-to-Right)
 * @param {string} lang - Language code
 * @returns {boolean}
 */
export function isLTR(lang = 'ar') {
  return getDirection(lang) === 'ltr';
}

/**
 * Get HTML attributes for a given locale (for <html> tag)
 * @param {string} lang - Language code
 * @returns {{lang: string, dir: string}} Object with lang and dir attributes
 */
export function getHtmlAttrs(lang = 'ar') {
  const locale = LOCALES[lang] || LOCALES.ar;
  return {
    lang: locale.code,
    dir: locale.dir
  };
}

/**
 * Detect direction from text content (heuristic-based)
 * Useful when you have mixed content and need to determine dominant direction
 * 
 * @param {string} text - Text to analyze
 * @returns {string} 'rtl', 'ltr', or 'neutral'
 */
export function detectTextDirection(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return 'neutral';
  }
  
  // Count RTL vs LTR characters
  let rtlCount = 0;
  let ltrCount = 0;
  
  // Arabic range: U+0600 to U+06FF, Hebrew: U+0590 to U+05FF
  const rtlRanges = [
    [0x0600, 0x06FF],   // Arabic
    [0x0750, 0x077F],   // Arabic Supplement
    [0x08A0, 0x08FF],   // Arabic Extended-A
    [0xFB50, 0xFDFF],   // Arabic Presentation Forms-A
    [0xFE70, 0xFEFF],   // Arabic Presentation Forms-B
    [0x0590, 0x05FF],   // Hebrew
    [0x07C0, 0x07FF],   // N'Ko (RTL)
  ];
  
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    
    // Check if RTL character
    const isRTLChar = rtlRanges.some(([start, end]) => 
      codePoint >= start && codePoint <= end
    );
    
    if (isRTLChar) {
      rtlCount++;
    } else if (codePoint >= 0x0041 && codePoint <= 0x007A || // Basic Latin
               codePoint >= 0x00C0 && codePoint <= 0x024F || // Latin Extended
               codePoint >= 0x1E00 && codePoint <= 0x1EFF) {  // Latin Extended Additional
      ltrCount++;
    }
  }
  
  // Determine dominant direction
  const total = rtlCount + ltrCount;
  if (total === 0) return 'neutral';
  
  const rtlRatio = rtlCount / total;
  
  if (rtlRatio > 0.3) return 'rtl';    // More than 30% RTL chars → RTL
  if (rtlRatio < 0.1) return 'ltr';    // Less than 10% RTL chars → LTR
  return 'neutral';                     // Mixed content
}

/**
 * Get CSS properties for text alignment based on direction
 * @param {string} lang - Language code
 * @returns {{textAlign: string, marginLeft: string, marginRight: string}}
 */
export function getTextAlignment(lang = 'ar') {
  const dir = getDirection(lang);
  
  if (dir === 'rtl') {
    return {
      textAlign: 'right',
      marginLeft: 'auto',
      marginRight: '0'
    };
  }
  
  return {
    textAlign: 'left',
    marginLeft: '0',
    marginRight: 'auto'
  };
}

// ============================================================
// DATE FORMATTING
// ============================================================

/**
 * Format a date according to locale rules
 * Uses Intl.DateTimeFormat for proper localization
 * 
 * @param {Date|string|number} date - Date to format
 * @param {string} lang - Language code
 * @param {Object} options - Formatting options
 * @param {string} [options.format='medium'] - Predefined format ('short', 'medium', 'long')
 * @param {boolean} [options.includeTime=false] - Include time component
 * @param {string} [options.timeFormat='short'] - Time format ('short', 'long')
 * @returns {string} Formatted date string
 */
export function formatDate(date, lang = 'ar', options = {}) {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const locale = LOCALES[lang] || LOCALES.ar;
  const format = options.format || 'medium';
  
  // Map our format names to Intl.DateTimeFormat options
  const intlOptions = {
    timeZone: options.timeZone || locale.timeZone,
    calendar: locale.calendar
  };
  
  switch (format) {
    case 'short':
      intlOptions.day = '2-digit';
      intlOptions.month = '2-digit';
      intlOptions.year = 'numeric';
      break;
    case 'long':
      intlOptions.weekday = 'long';
      intlOptions.day = 'numeric';
      intlOptions.month = 'long';
      intlOptions.year = 'numeric';
      break;
    case 'medium':
    default:
      intlOptions.day = 'numeric';
      intlOptions.month = 'short';
      intlOptions.year = 'numeric';
      break;
  }
  
  // Add time if requested
  if (options.includeTime) {
    const timeFormat = options.timeFormat || 'short';
    if (timeFormat === 'long') {
      intlOptions.hour = '2-digit';
      intlOptions.minute = '2-digit';
      intlOptions.second = '2-digit';
    } else {
      intlOptions.hour = '2-digit';
      intlOptions.minute = '2-digit';
    }
    
    // Use 12-hour or 24-hour based on locale
    intlOptions.hour12 = lang === 'en';
  }
  
  try {
    // Use appropriate Intl locale
    const intlLocale = lang === 'ar' ? 'ar-TN' : 'en-US';
    return new Intl.DateTimeFormat(intlLocale, intlOptions).format(dateObj);
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateObj.toISOString();
  }
}

/**
 * Format a time value (hours, minutes)
 * @param {Date|string|number} date - Date/time to format
 * @param {string} lang - Language code
 * @param {Object} options - Options
 * @param {boolean} [options.includeSeconds=false] - Show seconds
 * @returns {string} Formatted time string
 */
export function formatTime(date, lang = 'ar', options = {}) {
  return formatDate(date, lang, {
    ...options,
    format: undefined,
    includeTime: true,
    timeFormat: options.includeSeconds ? 'long' : 'short'
  });
}

/**
 * Format a date as relative time (e.g., "منذ 3 أيام", "3 days ago")
 * @param {Date|string|number} date - Date to compare
 * @param {string} lang - Language code
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date, lang = 'ar') {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  // Relative time strings for each locale
  const strings = {
    ar: {
      now: 'الآن',
      seconds: 'منذ ثوانٍ',
      minute: 'منذ دقيقة',
      minutes: 'منذ {count} دقائق',
      hour: 'منذ ساعة',
      hours: 'منذ {count} ساعات',
      day: 'منذ يوم',
      days: 'منذ {count} أيام',
      week: 'منذ أسبوع',
      weeks: 'منذ {count} أسابيع',
      month: 'منذ شهر',
      months: 'منذ {count} أشهر',
      year: 'منذ سنة',
      years: 'منذ {count} سنوات',
      future: 'خلال {text}',
      past: '{text}'
    },
    en: {
      now: 'just now',
      seconds: 'seconds ago',
      minute: 'a minute ago',
      minutes: '{count} minutes ago',
      hour: 'an hour ago',
      hours: '{count} hours ago',
      day: 'a day ago',
      days: '{count} days ago',
      week: 'a week ago',
      weeks: '{count} weeks ago',
      month: 'a month ago',
      months: '{count} months ago',
      year: 'a year ago',
      years: '{count} years ago',
      future: 'in {text}',
      past: '{text}'
    }
  };
  
  const t = strings[lang] || strings.ar;
  let result;
  const absDiff = Math.abs(diffMs);
  
  if (absDiff < 60000) {
    result = diffSeconds <= 10 ? t.now : t.seconds;
  } else if (absDiff < 3600000) {
    result = diffMinutes === 1 ? t.minute : t.minutes.replace('{count}', diffMinutes);
  } else if (absDiff < 86400000) {
    result = diffHours === 1 ? t.hour : t.hours.replace('{count}', diffHours);
  } else if (absDiff < 604800000) {
    result = diffDays === 1 ? t.day : t.days.replace('{count}', diffDays);
  } else if (absDiff < 2592000000) {
    result = diffWeeks === 1 ? t.week : t.weeks.replace('{count}', diffWeeks);
  } else if (absDiff < 31536000000) {
    result = diffMonths === 1 ? t.month : t.months.replace('{count}', diffMonths);
  } else {
    result = diffYears === 1 ? t.year : t.years.replace('{count}', diffYears);
  }
  
  // Handle future dates
  if (diffMs < 0) {
    return t.future.replace('{text}', result);
  }
  
  return result;
}

/**
 * Format a date range (e.g., "15 - 20 جانفي 2024")
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} lang - Language code
 * @returns {string} Formatted date range
 */
export function formatDateRange(startDate, endDate, lang = 'ar') {
  const startFormatted = formatDate(startDate, lang, { format: 'medium' });
  const endFormatted = formatDate(endDate, lang, { format: 'medium' });
  
  if (lang === 'ar') {
    return `${startFormatted} — ${endFormatted}`;
  }
  return `${startFormatted} – ${endFormatted}`;
}

// ============================================================
// NUMBER FORMATTING
// ============================================================

/**
 * Format a number according to locale rules
 * Handles decimal separators, thousand separators, etc.
 * 
 * @param {number} num - Number to format
 * @param {string} lang - Language code
 * @param {Object} options - Formatting options
 * @param {number} [options.decimals=2] - Number of decimal places
 * @param {boolean} [options.useGrouping=true] - Use thousand separators
 * @returns {string} Formatted number string
 */
export function formatNumber(num, lang = 'ar', options = {}) {
  if (num === null || num === undefined || isNaN(num)) {
    return lang === 'ar' ? '—' : '—';
  }
  
  const locale = LOCALES[lang] || LOCALES.ar;
  const decimals = options.decimals !== undefined ? options.decimals : 2;
  const useGrouping = options.useGrouping !== false;
  
  try {
    const intlLocale = lang === 'ar' ? 'ar-TN' : 'en-US';
    return new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: useGrouping
    }).format(num);
  } catch (error) {
    console.error('Number formatting error:', error);
    return String(num);
  }
}

/**
 * Format a number as percentage
 * @param {number} num - Number (0-100 or 0-1)
 * @param {string} lang - Language code
 * @param {Object} options - Options
 * @param {number} [options.decimals=1] - Decimal places
 * @returns {string} Formatted percentage
 */
export function formatPercent(num, lang = 'ar', options = {}) {
  const decimals = options.decimals !== undefined ? options.decimals : 1;
  
  // Normalize to 0-100 range if needed
  const normalized = Math.abs(num) <= 1 ? num * 100 : num;
  
  const formatted = formatNumber(normalized, lang, { decimals });
  
  if (lang === 'ar') {
    return `%${formatted}`;  // Arabic: % before number or after? Usually after
  }
  return `${formatted}%`;
}

/**
 * Format a currency amount
 * 
 * @param {number} amount - Amount to format
 * @param {string} lang - Language code
 * @param {Object} options - Options
 * @param {string} [options.currency] - Currency code (defaults to locale default)
 * @param {string} [options.symbol] - Override currency symbol
 * @param {boolean} [options.showSymbol=true] - Show currency symbol
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, lang = 'ar', options = {}) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return lang === 'ar' ? '—' : '—';
  }
  
  const locale = LOCALES[lang] || LOCALES.ar;
  const currency = options.currency || locale.numberFormat.currency;
  const showSymbol = options.showSymbol !== false;
  
  // Get symbol from options or locale config
  let symbol = options.symbol;
  if (!symbol) {
    // Common currency symbols
    const symbols = {
      TND: 'د.ت.',
      USD: '$',
      EUR: '€',
      GBP: '£',
      EGP: 'ج.م',
      SAR: 'ر.س',
      AED: 'د.إ',
      KWD: 'د.ك',
      BHD: 'د.ب',
      QAR: 'ر.ق',
      OMR: 'ر.ع'
    };
    symbol = symbols[currency] || currency;
  }
  
  // Format the number part
  const formattedAmount = formatNumber(amount, lang, { decimals: 3 }); // 3 decimals for TND
  
  if (!showSymbol) {
    return formattedAmount;
  }
  
  // Position based on locale
  if (locale.numberFormat.currencyPosition === 'after') {
    return `${formattedAmount} ${symbol}`;  // Arabic: 100.000 د.ت.
  }
  return `${symbol}${formattedAmount}`;     // English: $100.00
}

/**
 * Format a file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @param {string} lang - Language code
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes, lang = 'ar') {
  if (bytes === 0) return '0 B';
  
  const units = lang === 'ar' 
   ? ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت', 'تيرابايت']
    : ['B', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  
  return `${formatNumber(size, lang, { decimals: i > 0 ? 1 : 0 })} ${units[i]}`;
}

/**
 * Format a number with ordinal suffix (1st, 2nd, 3rd, أول، ثاني...)
 * @param {number} num - Number to format
 * @param {string} lang - Language code
 * @returns {string} Ordinal string
 */
export function formatOrdinal(num, lang = 'ar') {
  if (lang === 'ar') {
    // Arabic ordinals
    const ordinals = [
      '', 'أول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس', 'سابع', 'ثامن', 'تاسع', 'عاشر'
    ];
    
    if (num <= 10) return ordinals[num] || num.toString();
    
    // For larger numbers, just add the suffix pattern
    const suffixes = ['الحادي عشر', 'الثاني عشر', 'الثالث عشر'];
    if (num <= 13) return suffixes[num - 11] || num.toString();
    
    return `ال${formatNumber(num, lang)}`;
  }
  
  // English ordinals
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) return `${num}st`;
  if (j === 2 && k !== 12) return `${num}nd`;
  if (j === 3 && k !== 13) return `${num}rd`;
  return `${num}th`;
}

// ============================================================
// LIST FORMATTING
// ============================================================

/**
 * Format a list of items with proper conjunctions
 * Arabic: "أ، ب، وج" | English: "A, B, and C"
 * 
 * @param {Array<string>} items - Items to join
 * @param {string} lang - Language code
 * @param {Object} options - Options
 * @param {string} [options.type='and'] - Conjunction type ('and', 'or')
 * @param {number} [options.maxItems] - Max items before truncating
 * @returns {string} Formatted list string
 */
export function formatList(items, lang = 'ar', options = {}) {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  
  const maxItems = options.maxItems || items.length;
  const displayItems = items.slice(0, maxItems);
  const type = options.type || 'and';
  
  // Conjunction strings
  const conjunctions = {
    ar: { and: 'و', or: 'أو' },
    en: { and: 'and', or: 'or' }
  };
  
  const conj = conjunctions[lang]?.[type] || conjunctions.ar.and;
  
  if (displayItems.length === 2) {
    if (lang === 'ar') {
      return `${displayItems[0]} ${conj} ${displayItems[1]}`;
    }
    return `${displayItems[0]} ${conj} ${displayItems[1]}`;
  }
  
  // For more than 2 items
  const lastItem = displayItems[displayItems.length - 1];
  const otherItems = displayItems.slice(0, -1);
  
  if (lang === 'ar') {
    // Arabic: أ، ب، وج
    return `${otherItems.join('، ')}${otherItems.length > 0 ? '،' : ''} ${conj} ${lastItem}`;
  }
  
  // English: A, B, and C
  return `${otherItems.join(', ')}, ${conj} ${lastItem}`;
}

// ============================================================
// PHONE NUMBER FORMATTING
// ============================================================

/**
 * Format a phone number according to local conventions
 * @param {string} phone - Phone number
 * @param {string} countryCode - Country code (TN, US, SA, etc.)
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(phone, countryCode = 'TN') {
  if (!phone) return '';
  
  // Clean the phone number
  const cleaned = phone.replace(/\D/g, '');
  
  // Country-specific formats
  const formats = {
    TN: {
      pattern: /^216(\d{2})(\d{3})(\d{3})$/,
      format: '+216 $1 $2 $3',  // +216 XX XXX XXX
      localPattern: /^(\d{2})(\d{3})(\d{3})$/,
      localFormat: '$1 $2 $3'     // XX XXX XXX
    },
    US: {
      pattern: /^1(\d{3})(\d{3})(\d{4})$/,
      format: '+1 ($1) $2-$3',
      localPattern: /^(\d{3})(\d{3})(\d{4})$/,
      localFormat: '($1) $2-$3'
    },
    SA: {
      pattern: /^966(5[0-9])(\d{3})(\d{4})$/,
      format: '+966 $1 $2 $3',
      localPattern: /^(5[0-9])(\d{3})(\d{4})$/,
      localFormat: '$1 $2 $3'
    }
  };
  
  const format = formats[countryCode] || formats.TN;
  
  // Try international format first
  const internationalMatch = cleaned.match(format.pattern);
  if (internationalMatch) {
    return format.format.replace(/\$(\d)/g, (_, index) => internationalMatch[index]);
  }
  
  // Try local format
  const localMatch = cleaned.match(format.localPattern);
  if (localMatch) {
    return format.localFormat.replace(/\$(\d)/g, (_, index) => localMatch[index]);
  }
  
  // Return cleaned number if no match
  return cleaned;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate that a language code is supported
 * @param {string} lang - Language code to validate
 * @returns {string} Valid language code (fallbacks to 'ar')
 */
export function validateLocale(lang) {
  const validLocales = Object.keys(LOCALES);
  const cleanLang = String(lang || 'ar').toLowerCase().trim();
  return validLocales.includes(cleanLang) ? cleanLang : 'ar';
}

/**
 * Get full locale configuration object
 * @param {string} lang - Language code
 * @returns {Object} Locale configuration
 */
export function getLocaleConfig(lang = 'ar') {
  return LOCALES[lang] || LOCALES.ar;
}

/**
 * Get all supported locale codes
 * @returns {string[]} Array of locale codes
 */
export function getSupportedLocales() {
  return Object.keys(LOCALES);
}

/**
 * Get locale info for API responses (useful for frontend)
 * @param {string} lang - Current language
 * @returns {Object} Locale metadata
 */
export function getLocaleInfo(lang = 'ar') {
  const locale = LOCALES[lang] || LOCALES.ar;
  
  return {
    code: locale.code,
    name: locale.name,
    nameEn: locale.nameEn,
    dir: locale.dir,
    isRTL: locale.dir === 'rtl',
    currency: locale.numberFormat.currency,
    currencySymbol: locale.numberFormat.currencySymbol,
    currencyPosition: locale.numberFormat.currencyPosition,
    firstDayOfWeek: locale.firstDayOfWeek,
    weekend: locale.weekend,
    timeZone: locale.timeZone,
    dateFormat: locale.dateFormat,
    supportedLocales: getSupportedLocales()
  };
}
