/**
 * Locale Middleware - Batch 4
 *
 * Express middleware to extract and validate locale from requests.
 * Sets req.locale with full locale configuration for downstream use.
 *
 * Usage:
 *   app.use(localeMiddleware);  // Global
 *   router.get('/route', localeMiddleware, handler);  // Per-route
 */

import { validateLang } from '../utils/i18nHelper.js';
import { getLocaleInfo, getDirection, isRTL } from '../utils/localeFormatter.js';

/**
 * Locale middleware for Express
 * Extracts language from:
 * 1. Query parameter: ?lang=en|ar
 * 2. Accept-Language header (future enhancement)
 * 3. Defaults to 'ar' (Arabic)
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Next middleware function
 */
export function localeMiddleware(req, res, next) {
  try {
    // Priority 1: Query parameter (explicit user choice)
    let lang = req.query.lang;

    // Priority 2: Header (browser/system preference) - can be enabled later
    if (!lang && req.headers['accept-language']) {
      const acceptLang = parseAcceptLanguage(req.headers['accept-language']);
      lang = acceptLang;
    }

    // Validate and normalize
    lang = validateLang(lang);

    // Attach locale info to request
    req.locale = {
      lang,
      direction: getDirection(lang),
      isRTL: isRTL(lang),
      config: getLocaleInfo(lang)
    };

    // Helper method to set locale in response headers
    res.setLocale = function (targetLang) {
      const newLang = validateLang(targetLang);
      this.setHeader('Content-Language', newLang);
      this.setHeader('X-Locale-Dir', getDirection(newLang));
      return newLang;
    };

    // Set default headers
    res.setHeader('Content-Language', lang);
    res.setHeader('X-Locale-Dir', getDirection(lang));

    next();
  } catch {
    // Don't block the request on locale errors, just default to Arabic
    req.locale = {
      lang: 'ar',
      direction: 'rtl',
      isRTL: true,
      config: getLocaleInfo('ar')
    };
    next();
  }
}

/**
 * Parse Accept-Language header to extract preferred language
 * Supports quality values (q=0.8)
 *
 * @param {string} header - Accept-Language header value
 * @returns {string} Best matching supported language
 */
function parseAcceptLanguage(header) {
  if (!header || typeof header !== 'string') return null;

  // Parse the header into languages with quality values
  const languages = header
    .split(',')
    .map((part) => {
      const [locale, ...qParts] = part.trim().split(';');
      const qStr = qParts.find((p) => p.trim().startsWith('q='));
      const q = qStr ? parseFloat(qStr.split('=')[1]) : 1;
      return { locale: locale.trim().toLowerCase(), q: isNaN(q) ? 1 : q };
    })
    .filter((item) => item.locale)
    .sort((a, b) => b.q - a.q); // Sort by quality (highest first)

  // Find first supported language
  const supportedLangs = ['ar', 'en'];

  for (const { locale } of languages) {
    // Check exact match
    if (supportedLangs.includes(locale)) {
      return locale;
    }

    // Check language-only match (e.g., 'en-us' -> 'en')
    const langOnly = locale.split('-')[0];
    if (supportedLangs.includes(langOnly)) {
      return langOnly;
    }
  }

  return null; // No match found
}

/**
 * Optional: Strict locale middleware that rejects unsupported locales
 * Use for API endpoints that require explicit locale support
 */
export function strictLocaleMiddleware(req, res, next) {
  const lang = req.query.lang;

  if (!lang) {
    return res.status(400).json({
      error: 'Language parameter required',
      message: 'Please specify ?lang=ar|en',
      supportedLanguages: ['ar', 'en']
    });
  }

  const validated = validateLang(lang);

  if (validated !== lang.toLowerCase()) {
    return res.status(400).json({
      error: 'Unsupported language',
      message: `Language '${lang}' is not supported`,
      supportedLanguages: ['ar', 'en']
    });
  }

  // Continue to regular locale middleware
  localeMiddleware(req, res, next);
}

/**
 * Helper to get localized response wrapper
 * Adds locale metadata to API responses
 *
 * @param {Object} data - Response data
 * @param {Object} locale - Locale object from req.locale
 * @returns {Object} Wrapped response with locale metadata
 */
export function localizeResponse(data, locale) {
  return {
    data,
    _meta: {
      locale: locale.lang,
      direction: locale.direction,
      isRTL: locale.isRTL,
      timestamp: new Date().toISOString()
    }
  };
}

export default localeMiddleware;
