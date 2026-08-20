/**
 * Locale Context - Batch 6
 * 
 * Provides locale configuration from the Backend API to the Frontend.
 * Syncs with /api/public/locale endpoint for consistent formatting.
 * 
 * Features:
 * - Fetches locale config on app startup
 * - Caches in memory and localStorage
 * - Provides formatting helpers (date, currency, number)
 * - Auto-syncs when language changes
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';

const LocaleContext = createContext(null);

// Cache key for localStorage
const LOCALE_CACHE_KEY = 'rafiqi-locale-config';
const CACHE_DURATION = 3600000; // 1 hour

/**
 * Validate and clean locale data from API
 */
function sanitizeLocaleConfig(data) {
  if (!data || typeof data !== 'object') return null;
  
  return {
    code: typeof data.code === 'string' ? data.code : 'ar',
    name: typeof data.name === 'string' ? data.name : '',
    dir: data.dir === 'ltr' ? 'ltr' : 'rtl', // Default to RTL
    isRTL: data.dir !== 'ltr',
    currency: typeof data.currency === 'string' ? data.currency : 'TND',
    currencySymbol: typeof data.currencySymbol === 'string' ? data.currencySymbol : 'د.ت.',
    currencyPosition: data.currencyPosition || (data.dir === 'rtl' ? 'after' : 'before'),
    firstDayOfWeek: typeof data.firstDayOfWeek === 'number' ? data.firstDayOfWeek : 1,
    weekend: Array.isArray(data.weekend) ? data.weekend : [5, 6],
    timeZone: typeof data.timeZone === 'string' ? data.timeZone : 'Africa/Tunis',
    dateFormat: {
      short: data.dateFormat?.short || 'dd/MM/yyyy',
      medium: data.dateFormat?.medium || 'dd MMMM yyyy',
      long: data.dateFormat?.long || 'EEEE، dd MMMM yyyy'
    },
    htmlAttrs: {
      lang: data.htmlAttrs?.lang || 'ar',
      dir: data.htmlAttrs?.dir || 'rtl'
    },
    messages: {
      direction: data.messages?.direction || 'rtl',
      alignStart: data.messages?.alignStart || 'right',
      alignEnd: data.messages?.alignEnd || 'left'
    }
  };
}

/**
 * Load cached locale config from localStorage
 */
function loadCachedLocale() {
  try {
    const cached = localStorage.getItem(LOCALE_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Check if cache is still valid
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(LOCALE_CACHE_KEY);
      return null;
    }
    
    return sanitizeLocaleConfig(data);
  } catch (e) {
    console.warn('Failed to load cached locale:', e);
    return null;
  }
}

/**
 * Save locale config to cache
 */
function saveCachedLocale(config) {
  try {
    const cacheData = {
      data: config,
      timestamp: Date.now()
    };
    localStorage.setItem(LOCALE_CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    // Silently fail if localStorage is not available
  }
}

/**
 * Locale Provider Component
 */
export function LocaleProvider({ children, apiBaseUrl = '' }) {
  const { lang } = useI18n();
  const [localeConfig, setLocaleConfig] = useState(() => loadCachedLocale());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  /**
   * Fetch locale configuration from backend API
   */
  const fetchLocaleConfig = useCallback(async (language) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const targetLang = language || lang;
      const response = await fetch(`${apiBaseUrl}/api/public/locale?lang=${targetLang}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch locale: ${response.status}`);
      }
      
      const data = await response.json();
      const sanitized = sanitizeLocaleConfig(data);
      
      setLocaleConfig(sanitized);
      saveCachedLocale(sanitized);
      
      return sanitized;
    } catch (err) {
      console.error('Locale fetch error:', err);
      setError(err.message);
      
      // Return default fallback config
      const fallback = sanitizeLocaleConfig({
        code: targetLang,
        dir: targetLang === 'ar' ? 'rtl' : 'ltr'
      });
      
      setLocaleConfig(fallback);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, [lang, apiBaseUrl]);
  
  /**
   * Initial fetch on mount or when language changes
   */
  useEffect(() => {
    // Only fetch if we don't have a valid cache or language changed
    if (!localeConfig || localeConfig.code !== lang) {
      fetchLocaleConfig(lang);
    }
  }, [lang, localeConfig?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  
  /**
   * Format date using locale config
   */
  const formatDate = useCallback((date, format = 'medium') => {
    if (!date) return '';
    
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      
      const formatPattern = localeConfig?.dateFormat?.[format] || localeConfig?.dateFormat?.medium;
      const localeStr = lang === 'ar' ? 'ar-TN' : 'en-US';
      
      // Use Intl.DateTimeFormat for proper localization
      const options = {};
      
      switch (format) {
        case 'short':
          options.day = '2-digit';
          options.month = '2-digit';
          options.year = 'numeric';
          break;
        case 'long':
          options.weekday = 'long';
          options.day = 'numeric';
          options.month = 'long';
          options.year = 'numeric';
          break;
        case 'medium':
        default:
          options.day = 'numeric';
          options.month = 'short';
          options.year = 'numeric';
      }
      
      return new Intl.DateTimeFormat(localeStr, options).format(dateObj);
    } catch (e) {
      console.error('Date formatting error:', e);
      return String(date);
    }
  }, [localeConfig, lang]);
  
  /**
   * Format currency amount
   */
  const formatCurrency = useCallback((amount, currency) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '—';
    
    try {
      const targetCurrency = currency || localeConfig?.currency || 'TND';
      const symbol = getCurrencySymbol(targetCurrency);
      const isArabic = lang === 'ar';
      const decimals = targetCurrency === 'TND' ? 3 : 2;
      
      const formatted = Number(amount).toLocaleString(isArabic ? 'ar-TN' : 'en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      
      const position = localeConfig?.currencyPosition || (isArabic ? 'after' : 'before');
      
      if (position === 'after') {
        return `${formatted} ${symbol}`;
      }
      return `${symbol}${formatted}`;
    } catch (e) {
      console.error('Currency formatting error:', e);
      return String(amount);
    }
  }, [localeConfig, lang]);
  
  /**
   * Format number with locale-specific separators
   */
  const formatNumber = useCallback((num, options = {}) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    
    try {
      const isArabic = lang === 'ar';
      return Number(num).toLocaleString(isArabic ? 'ar-TN' : 'en-US', {
        minimumFractionDigits: options.decimals ?? 2,
        maximumFractionDigits: options.decimals ?? 2
      });
    } catch (e) {
      return String(num);
    }
  }, [lang]);
  
  /**
   * Get relative time string (e.g., "3 days ago")
   */
  const formatRelativeTime = useCallback((date) => {
    if (!date) return '';
    
    try {
      const dateObj = new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      const strings = {
        ar: ['الآن', 'منذ ثوانٍ', 'منذ دقيقة', 'منذ {{n}} دقائق', 'منذ ساعة', 'منذ {{n}} ساعات', 'منذ يوم', 'منذ {{n}} أيام'],
        en: ['just now', 'seconds ago', 'a minute ago', '{{n}} minutes ago', 'an hour ago', '{{n}} hours ago', 'a day ago', '{{n}} days ago']
      };
      
      const t = strings[lang] || strings.ar;
      
      if (diffSeconds < 60) return t[0];
      if (diffSeconds < 120) return t[1];
      if (diffMinutes < 2) return t[2];
      if (diffMinutes < 60) return t[3].replace('{{n}}', diffMinutes);
      if (diffHours < 2) return t[4];
      if (diffHours < 24) return t[5].replace('{{n}}', diffHours);
      if (diffDays < 2) return t[6];
      return t[7].replace('{{n}}', diffDays);
    } catch (e) {
      return String(date);
    }
  }, [lang]);
  
  const value = useMemo(() => ({
    config: localeConfig,
    isLoading,
    error,
    refetch: () => fetchLocaleConfig(lang),
    // Formatting helpers
    formatDate,
    formatCurrency,
    formatNumber,
    formatRelativeTime,
    // Quick accessors
    isRTL: localeConfig?.isRTL ?? true,
    direction: localeConfig?.dir ?? 'rtl',
    currency: localeConfig?.currency ?? 'TND',
    currencySymbol: localeConfig?.currencySymbol ?? 'د.ت.',
    firstDayOfWeek: localeConfig?.firstDayOfWeek ?? 1,
    weekend: localeConfig?.weekend ?? [5, 6],
    timeZone: localeConfig?.timeZone ?? 'Africa/Tunis'
  }), [localeConfig, isLoading, error, lang, formatDate, formatCurrency, formatNumber, formatRelativeTime]);
  
  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Hook to use locale context
 */
export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}

/**
 * Helper: Get currency symbol for currency code
 */
function getCurrencySymbol(currency) {
  const symbols = {
    TND: 'د.ت.',
    DZD: 'د.ج',
    MAD: 'د.م',
    EGP: 'ج.م',
    SAR: 'ر.س',
    AED: 'د.إ',
    KWD: 'د.ك',
    BHD: 'د.ب',
    QAR: 'ر.ق',
    OMR: 'ر.ع',
    JOD: 'د.أ',
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$',
    AUD: 'A$'
  };
  
  return symbols[currency] || currency;
}

export default LocaleContext;
