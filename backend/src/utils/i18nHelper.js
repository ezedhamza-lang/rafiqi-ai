/**
 * i18n Helper Utilities for Batch 3.2 - API Content Translation
 * 
 * Provides safe localization with fallback for database content fields.
 * Pattern: If English field exists and is non-empty, return it; otherwise fallback to Arabic.
 */

/**
 * Get localized field value with safe fallback
 * @param {Object} record - Database record containing both ar and en fields
 * @param {string} fieldAr - Arabic field name (e.g., 'title')
 * @param {string} fieldEn - English field name (e.g., 'titleEn')
 * @param {string} lang - Language code ('ar' or 'en')
 * @returns {string} Localized field value
 */
export function getLocalizedField(record, fieldAr, fieldEn, lang = 'ar') {
  if (lang === 'en' && record[fieldEn] && record[fieldEn].trim() !== '') {
    return record[fieldEn];
  }
  // Fallback to Arabic (default)
  return record[fieldAr] || '';
}

/**
 * Transform a single record to include localized fields
 * @param {Object} record - Database record
 * @param {Array<{ar: string, en: string}>} fields - Field mappings to localize
 * @param {string} lang - Language code
 * @returns {Object} Record with localized values (title, description, etc.)
 */
export function localizeRecord(record, fields, lang = 'ar') {
  const localized = { ...record };
  
  for (const { ar: fieldAr, en: fieldEn } of fields) {
    // Replace the main field with localized value
    if (lang === 'en' && localized[fieldEn] && localized[fieldEn].trim() !== '') {
      localized[fieldAr] = localized[fieldEn];
    }
  }
  
  // Remove EN fields from response (cleaner API)
  const enFields = fields.map(f => f.en);
  for (const field of enFields) {
    delete localized[field];
  }
  
  return localized;
}

/**
 * Transform an array of records to include localized fields
 * @param {Array<Object>} records - Array of database records
 * @param {Array<{ar: string, en: string}>} fields - Field mappings
 * @param {string} lang - Language code
 * @returns {Array<Object>} Localized records
 */
export function localizeRecords(records, fields, lang = 'ar') {
  return records.map(record => localizeRecord(record, fields, lang));
}

// Field mappings for each content type
export const ANNOUNCEMENT_FIELDS = [
  { ar: 'title', en: 'titleEn' },
  { ar: 'description', en: 'descriptionEn' }
];

export const ARTICLE_FIELDS = [
  { ar: 'title', en: 'titleEn' },
  { ar: 'description', en: 'descriptionEn' }
];

export const FAQ_FIELDS = [
  { ar: 'question', en: 'questionEn' },
  { ar: 'answer', en: 'answerEn' }
];

/**
 * Extract and validate language from query parameter
 * @param {string|undefined} langParam - Raw language parameter from query
 * @returns {string} Validated language ('ar' or 'en', defaults to 'ar')
 */
export function validateLang(langParam) {
  const validLangs = ['ar', 'en'];
  const lang = String(langParam || 'ar').toLowerCase().trim();
  return validLangs.includes(lang) ? lang : 'ar';
}
