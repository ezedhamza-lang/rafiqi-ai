/**
 * Market Detection Utilities - Batch 5 Enhancement
 * 
 * Provides utilities for detecting user market/country to automatically
 * select the appropriate payment provider, currency, and locale.
 * 
 * @module marketDetector
 */

import { getProviderForMarket, CURRENCY_MARKETS, MARKET_PROVIDERS } from '../services/payments/provider.js';
import { getLocaleInfo } from './localeFormatter.js';
import { logger } from './logger.js';

// ============================================================
// COUNTRY CODE MAPPINGS
// ============================================================

/**
 * Comprehensive country code mappings
 * ISO 3166-1 alpha-2 codes
 */
export const COUNTRIES = {
  // North Africa
  TN: { name: 'تونس', nameEn: 'Tunisia', currency: 'TND', lang: 'ar', region: 'MENA' },
  DZ: { name: 'الجزائر', nameEn: 'Algeria', currency: 'DZD', lang: 'ar', region: 'MENA' },
  MA: { name: 'المغرب', nameEn: 'Morocco', currency: 'MAD', lang: 'ar', region: 'MENA' },
  LY: { name: 'ليبيا', nameEn: 'Libya', currency: 'LYD', lang: 'ar', region: 'MENA' },
  EG: { name: 'مصر', nameEn: 'Egypt', currency: 'EGP', lang: 'ar', region: 'MENA' },
  
  // Gulf Cooperation Council (GCC)
  SA: { name: 'السعودية', nameEn: 'Saudi Arabia', currency: 'SAR', lang: 'ar', region: 'GCC' },
  AE: { name: 'الإمارات', nameEn: 'UAE', currency: 'AED', lang: 'ar', region: 'GCC' },
  KW: { name: 'الكويت', nameEn: 'Kuwait', currency: 'KWD', lang: 'ar', region: 'GCC' },
  QA: { name: 'قطر', nameEn: 'Qatar', currency: 'QAR', lang: 'ar', region: 'GCC' },
  BH: { name: 'البحرين', nameEn: 'Bahrain', currency: 'BHD', lang: 'ar', region: 'GCC' },
  OM: { name: 'عُمان', nameEn: 'Oman', currency: 'OMR', lang: 'ar', region: 'GCC' },
  
  // Levant
  JO: { name: 'الأردن', nameEn: 'Jordan', currency: 'JOD', lang: 'ar', region: 'MENA' },
  LB: { name: 'لبنان', nameEn: 'Lebanon', currency: 'LBP', lang: 'ar', region: 'MENA' },
  SY: { name: 'سوريا', nameEn: 'Syria', currency: 'SYP', lang: 'ar', region: 'MENA' },
  IQ: { name: 'العراق', nameEn: 'Iraq', currency: 'IQD', lang: 'ar', region: 'MENA' },
  PS: { name: 'فلسطين', nameEn: 'Palestine', currency: 'ILS', lang: 'ar', region: 'MENA' },
  
  // Europe & North America
  US: { name: 'الولايات المتحدة', nameEn: 'United States', currency: 'USD', lang: 'en', region: 'NAMERICA' },
  GB: { name: 'بريطانيا', nameEn: 'United Kingdom', currency: 'GBP', lang: 'en', region: 'EUROPE' },
  FR: { name: 'فرنسا', nameEn: 'France', currency: 'EUR', lang: 'fr', region: 'EUROPE' },
  DE: { name: 'ألمانيا', nameEn: 'Germany', currency: 'EUR', lang: 'de', region: 'EUROPE' },
  CA: { name: 'كندا', nameEn: 'Canada', currency: 'CAD', lang: 'en', region: 'NAMERICA' },
  AU: { name: 'أستراليا', nameEn: 'Australia', currency: 'AUD', lang: 'en', region: 'OCEANIA' },
};

// ============================================================
// MARKET DETECTION METHODS
// ============================================================

/**
 * Detect market from IP address (GeoIP)
 * This is a placeholder - in production, use a GeoIP service like:
 * - MaxMind GeoIP2
 * - ip-api.com
 * - Cloudflare CF-IPCountry header
 * 
 * @param {string} ipAddress - User's IP address
 * @returns {Promise<string>} Country code (e.g., 'TN', 'US')
 */
export async function detectMarketFromIP(ipAddress) {
  if (!ipAddress) return null;
  
  // Check for Cloudflare country header (if behind CF)
  // This would be available as req.headers['cf-ipcountry']
  
  // Placeholder implementation - in production, integrate with GeoIP service
  logger.debug({ ipAddress }, '[MarketDetector] GeoIP lookup');
  
  // For development/testing, you can mock this:
  // if (process.env.NODE_ENV === 'development') {
  //   return process.env.MOCK_COUNTRY || 'TN';
  // }
  
  return null; // Unknown - will use fallback
}

/**
 * Detect market from phone number
 * Parses country code from phone number
 * 
 * @param {string} phone - Phone number with or without country code
 * @returns {string|null} Country code
 */
export function detectMarketFromPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  
  const cleaned = phone.replace(/\D/g, '');
  
  // Country code mappings (common ones for our markets)
  const phonePrefixes = {
    '216': 'TN',  // Tunisia
    '213': 'DZ',  // Algeria
    '212': 'MA',  // Morocco
    '218': 'LY',  // Libya
    '20': 'EG',   // Egypt
    '966': 'SA',  // Saudi Arabia
    '971': 'AE',  // UAE
    '965': 'KW',  // Kuwait
    '974': 'QA',  // Qatar
    '973': 'BH',  // Bahrain
    '968': 'OM',  // Oman
    '962': 'JO',  // Jordan
    '961': 'LB',  // Lebanon
    '963': 'SY',  // Syria
    '964': 'IQ',  // Iraq
    '970': 'PS',  // Palestine
    '1': 'US',   // US/Canada (need more specific check)
    '44': 'GB',   // UK
    '33': 'FR',   // France
    '49': 'DE',   // Germany
  };
  
  // Try longest prefix first (to avoid conflicts like 216 vs 21)
  const sortedPrefixes = Object.keys(phonePrefixes).sort((a, b) => b.length - a.length);
  
  for (const prefix of sortedPrefixes) {
    if (cleaned.startsWith(prefix)) {
      return phonePrefixes[prefix];
    }
  }
  
  return null;
}

/**
 * Detect market from user profile data
 * Checks stored country, currency, or phone in user record
 * 
 * @param {Object} user - User object from database
 * @returns {string|null} Detected country code
 */
export function detectMarketFromUser(user) {
  if (!user) return null;
  
  // Priority 1: Explicit country field
  if (user.country && COUNTRIES[user.country.toUpperCase()]) {
    return user.country.toUpperCase();
  }
  
  // Priority 2: Phone number
  if (user.phone) {
    const fromPhone = detectMarketFromPhone(user.phone);
    if (fromPhone) return fromPhone;
  }
  
  // Priority 3: Currency preference
  if (user.currency && CURRENCY_MARKETS[user.currency.toUpperCase()]) {
    return CURRENCY_MARKETS[user.currency.toUpperCase()];
  }
  
  return null;
}

/**
 * Detect market from request (combines all methods)
 * 
 * @param {import('express').Request} req - Express request object
 * @returns {Promise<string>} Detected country code
 */
export async function detectMarket(req) {
  // Method 1: Explicit parameter
  if (req.query.country && COUNTRIES[req.query.country.toUpperCase()]) {
    return req.query.country.toUpperCase();
  }
  
  // Method 2: Authenticated user's profile
  if (req.user) {
    const fromUser = detectMarketFromUser(req.user);
    if (fromUser) return fromUser;
  }
  
  // Method 3: Phone from body (for registration/checkout)
  if (req.body?.phone) {
    const fromPhone = detectMarketFromPhone(req.body.phone);
    if (fromPhone) return fromPhone;
  }
  
  // Method 4: GeoIP from IP address
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim();
  if (ip) {
    const fromIP = await detectMarketFromIP(ip);
    if (fromIP) return fromIP;
  }
  
  // Method 5: Cloudflare header (if available)
  const cfCountry = req.headers['cf-ipcountry'];
  if (cfCountry && COUNTRIES[cfCountry]) {
    return cfCountry;
  }
  
  // Default fallback
  return 'TN'; // Default to Tunisia
}

// ============================================================
// MARKET CONFIGURATION
// ============================================================

/**
 * Get complete market configuration for a country
 * 
 * @param {string} countryCode - ISO 3166-1 alpha-2 code
 * @returns {Object} Market configuration including payment providers, locale, etc.
 */
export function getMarketConfig(countryCode = 'TN') {
  const code = countryCode.toUpperCase();
  const country = COUNTRIES[code] || COUNTRIES.TN;
  
  // Get payment providers for this market
  const providerOrder = MARKET_PROVIDERS[code] || MARKET_PROVIDERS.DEFAULT;
  
  return {
    country: code,
    ...country,
    
    // Payment configuration
    payment: {
      providers: providerOrder,
      defaultProvider: providerOrder[0],
      currency: country.currency,
      // Check which providers are configured (in real app, this would query DB)
      availableProviders: providerOrder.filter(p => p !== 'DEMO') // Simplified
    },
    
    // Locale configuration (linking to our i18n system)
    locale: {
      lang: country.lang,
      direction: country.lang === 'ar' ? 'rtl' : 'ltr',
      config: getLocaleInfo(country.lang)
    },
    
    // Regional info
    region: country.region,
    
    // Is this a "home" market (fully supported)?
    isHomeMarket: ['TN'].includes(code),
    
    // Is this an Arabic market?
    isArabicMarket: country.lang === 'ar'
  };
}

/**
 * Get all supported markets
 * 
 * @returns {Array<Object>} Array of market configurations
 */
export function getSupportedMarkets() {
  return Object.keys(COUNTRIES).map(code => ({
    code,
    ...COUNTRIES[code],
    hasPaymentSupport: Boolean(MARKET_PROVIDERS[code])
  }));
}

/**
 * Get markets grouped by region
 * 
 * @returns {Object} Markets organized by region
 */
export function getMarketsByRegion() {
  const regions = {};
  
  for (const [code, country] of Object.entries(COUNTRIES)) {
    const region = country.region;
    if (!regions[region]) {
      regions[region] = [];
    }
    regions[region].push({
      code,
      ...country,
      hasPaymentSupport: Boolean(MARKET_PROVIDERS[code])
    });
  }
  
  return regions;
}

// ============================================================
// PAYMENT MARKET HELPERS
// ============================================================

/**
 * Get the best payment provider for a given context
 * Combines market detection with provider selection
 * 
 * @param {Object} options - Selection context
 * @param {string} [options.market] - Known market code
 * @param {string} [options.currency] - Known currency
 * @param {string} [options.phone] - User's phone number
 * @param {Object} [options.user] - User object
 * @param {import('express').Request} [options.req] - Express request
 * @returns {Promise<{provider: Object, market: string, config: Object}>}
 */
export async function resolvePaymentContext(options = {}) {
  let market = options.market;
  
  // If no explicit market, try to detect it
  if (!market) {
    if (options.currency && CURRENCY_MARKETS[options.currency]) {
      market = CURRENCY_MARKETS[options.currency];
    } else if (options.phone) {
      market = detectMarketFromPhone(options.phone);
    } else if (options.user) {
      market = detectMarketFromUser(options.user);
    } else if (options.req) {
      market = await detectMarket(options.req);
    }
  }
  
  // Fallback to default
  market = market || 'TN';
  
  // Get provider for this market
  const provider = getProviderForMarket({ market });
  const config = getMarketConfig(market);
  
  return {
    provider,
    market,
    config
  };
}

/**
 * Validate that a payment method is available for a market
 * 
 * @param {string} providerName - Provider to validate
 * @param {string} market - Target market
 * @returns {{available: boolean, reason?: string}}
 */
export function validateProviderForMarket(providerName, market = 'TN') {
  const marketProviders = MARKET_PROVIDERS[market.toUpperCase()];
  
  if (!marketProviders) {
    return {
      available: false,
      reason: `Market ${market} is not supported`
    };
  }
  
  const normalized = providerName?.toUpperCase();
  const isAvailable = marketProviders.includes(normalized);
  
  if (!isAvailable) {
    return {
      available: false,
      reason: `Provider ${providerName} is not available in ${market}. Available: ${marketProviders.join(', ')}`
    };
  }
  
  return { available: true };
}

// ============================================================
// CURRENCY HELPERS
// ============================================================

/**
 * Get currency symbol for a country/market
 * @param {string} countryCode - Country code
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(countryCode = 'TN') {
  const country = COUNTRIES[countryCode.toUpperCase()];
  if (!country) return 'TND'; // Fallback
  
  const symbols = {
    TND: 'د.ت.',
    DZD: 'د.ج',
    MAD: 'د.م',
    LYD: 'ل.ل',
    EGP: 'ج.م',
    SAR: 'ر.س',
    AED: 'د.إ',
    KWD: 'د.ك',
    BHD: 'د.ب',
    QAR: 'ر.ق',
    OMR: 'ر.ع',
    JOD: 'د.أ',
    LBP: 'ل.ل',
    SYP: 'ل.س',
    IQD: 'د.ع',
    ILS: '₪',
    USD: '$',
    GBP: '£',
    EUR: '€',
    CAD: 'C$',
    AUD: 'A$'
  };
  
  return symbols[country.currency] || country.currency;
}

/**
 * Format price for display in a specific market
 * @param {number} amount - Price amount
 * @param {string} countryCode - Country code
 * @returns {string} Formatted price string
 */
export function formatPriceForMarket(amount, countryCode = 'TN') {
  const country = COUNTRIES[countryCode.toUpperCase()] || COUNTRIES.TN;
  const symbol = getCurrencySymbol(countryCode);
  const isArabic = country.lang === 'ar';
  
  // Format number based on locale
  const formatted = amount.toLocaleString(isArabic ? 'ar-TN' : 'en-US', {
    minimumFractionDigits: country.currency === 'TND' ? 3 : 2,
    maximumFractionDigits: country.currency === 'TND' ? 3 : 2
  });
  
  // Position symbol based on Arabic/English convention
  if (isArabic) {
    return `${formatted} ${symbol}`; // Arabic: 100.000 د.ت.
  }
  return `${symbol}${formatted}`;   // English: $100.00
}

export { CURRENCY_MARKETS, MARKET_PROVIDERS };
