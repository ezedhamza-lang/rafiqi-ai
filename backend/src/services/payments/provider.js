/**
 * Payment Provider Registry - Batch 5 Enhanced
 * 
 * Central registry for all payment providers with market-aware selection.
 * Supports automatic provider selection based on currency/market.
 */

import { demoProvider } from './demoProvider.js';
import { stripeProvider } from './stripeProvider.js';
import { stbProvider } from './stbProvider.js';
import { paypalProvider } from './paypalProvider.js';
import { paymobProvider } from './paymobProvider.js';
import { tapProvider } from './tapProvider.js';
import { ApiError } from '../../middleware/errorHandler.js';

// All available providers
const providers = {
  DEMO: demoProvider,
  STRIPE: stripeProvider,
  STB: stbProvider,
  PAYPAL: paypalProvider,
  PAYMOB: paymobProvider,
  TAP: tapProvider
};

// Market-to-provider mapping (can be overridden by config)
const MARKET_PROVIDERS = {
  // Tunisia - Local providers
  TN: ['STB', 'STRIPE', 'DEMO'],
  
  // International markets
  US: ['STRIPE', 'PAYPAL', 'DEMO'],
  GB: ['STRIPE', 'PAYPAL', 'DEMO'],
  EU: ['STRIPE', 'PAYPAL', 'DEMO'],
  
  // MENA markets
  EG: ['PAYMOB', 'PAYPAL', 'DEMO'],      // Egypt
  SA: ['TAP', 'STRIPE', 'DEMO'],          // Saudi Arabia
  AE: ['TAP', 'PAYPAL', 'DEMO'],          // UAE
  KW: ['TAP', 'PAYPAL', 'DEMO'],          // Kuwait
  BH: ['TAP', 'PAYPAL', 'DEMO'],          // Bahrain
  QA: ['TAP', 'PAYPAL', 'DEMO'],          // Qatar
  OM: ['TAP', 'PAYPAL', 'DEMO'],          // Oman
  
  // Default fallback
  DEFAULT: ['STRIPE', 'DEMO']
};

// Currency-to-market mapping
const CURRENCY_MARKETS = {
  TND: 'TN',
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  EGP: 'EG',
  SAR: 'SA',
  AED: 'AE',
  KWD: 'KW',
  BHD: 'BH',
  QAR: 'QA',
  OMR: 'OM'
};

/**
 * Get a specific provider by name
 */
export function getProvider(name) {
  const provider = providers[(name || '').toUpperCase()];
  if (!provider) {
    const available = Object.keys(providers).join(', ');
    throw new ApiError(400, `مزود دفع غير معروف — المتاح: ${available}`);
  }
  return provider;
}

/**
 * List all available providers with their info
 */
export function listProviders() {
  return Object.values(providers).map((p) => p.info());
}

/**
 * Normalize provider name to uppercase
 */
export function normalizeProviderName(name) {
  return (name || '').toUpperCase();
}

/**
 * Get the best provider for a given market/currency
 * 
 * @param {Object} options - Selection criteria
 * @param {string} [options.market] - Country code (TN, US, EG, SA, etc.)
 * @param {string} [options.currency] - Currency code (TND, USD, SAR, etc.)
 * @param {string} [options.preferred] - Preferred provider name (optional)
 * @returns {Object} Provider instance
 */
export function getProviderForMarket({ market, currency, preferred }) {
  // If user explicitly chose a provider, use it (if configured)
  if (preferred) {
    const prefProvider = providers[preferred.toUpperCase()];
    if (prefProvider && prefProvider.info().configured) {
      return prefProvider;
    }
    // If not configured but requested, still return it (will error on usage)
    if (prefProvider) {
      return prefProvider;
    }
  }

  // Determine market from currency if not specified
  const targetMarket = market || CURRENCY_MARKETS[(currency || '').toUpperCase()] || 'DEFAULT';
  
  // Get ordered list of providers for this market
  const providerOrder = MARKET_PROVIDERS[targetMarket] || MARKET_PROVIDERS.DEFAULT;
  
  // Find first configured provider
  for (const providerName of providerOrder) {
    const provider = providers[providerName];
    if (provider && provider.info().configured) {
      return provider;
    }
  }
  
  // Fallback to DEMO (always available)
  return demoProvider;
}

/**
 * Get available providers for a market
 * 
 * @param {string} [market] - Country code
 * @returns {Array} Array of provider info objects
 */
export function getAvailableProvidersForMarket(market) {
  const targetMarket = market || 'DEFAULT';
  const providerOrder = MARKET_PROVIDERS[targetMarket] || Object.keys(providers);
  
  return providerOrder
    .map(name => providers[name])
    .filter(p => p)
    .map(p => p.info());
}

/**
 * Check if a provider is configured and ready
 * 
 * @param {string} name - Provider name
 * @returns {boolean}
 */
export function isProviderConfigured(name) {
  const provider = providers[name?.toUpperCase()];
  return provider ? provider.info().configured : false;
}

/**
 * Get default provider for a currency
 * 
 * @param {string} currency - Currency code
 * @returns {Object} Provider instance
 */
export function getProviderForCurrency(currency) {
  return getProviderForMarket({ currency });
}

// Export raw providers map for advanced usage
export { providers, MARKET_PROVIDERS, CURRENCY_MARKETS };
