import { Router } from 'express';
import prisma from '../db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validateLang,
  localizeRecords,
  ANNOUNCEMENT_FIELDS,
  ARTICLE_FIELDS,
  FAQ_FIELDS
} from '../utils/i18nHelper.js';
import {
  formatDate,
  formatRelativeTime,
  getLocaleInfo,
  getHtmlAttrs
} from '../utils/localeFormatter.js';

const router = Router();

/**
 * @swagger
 * /api/public/announcements:
 *   get:
 *     summary: الإعلانات
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [ar, en]
 *         description: Language for content (defaults to 'ar')
 *     tags: [public]
 *     responses:
 *       200:
 *         description: قائمة الإعلانات
 */
router.get('/announcements', asyncHandler(async (req, res) => {
  const lang = validateLang(req.query.lang);
  const items = await prisma.announcement.findMany({ orderBy: { date: 'desc' } });
  
  // Localize content and format dates
  const localized = localizeRecords(items, ANNOUNCEMENT_FIELDS, lang);
  const formatted = localized.map(item => ({
    ...item,
    dateFormatted: formatDate(item.date, lang),
    dateRelative: formatRelativeTime(item.date, lang)
  }));
  
  res.json(formatted);
}));

/**
 * @swagger
 * /api/public/articles:
 *   get:
 *     summary: المقالات
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [ar, en]
 *         description: Language for content (defaults to 'ar')
 *     tags: [public]
 *     responses:
 *       200:
 *         description: قائمة المقالات
 */
router.get('/articles', asyncHandler(async (req, res) => {
  const lang = validateLang(req.query.lang);
  const items = await prisma.article.findMany({ orderBy: { date: 'desc' } });
  
  // Localize content and format dates
  const localized = localizeRecords(items, ARTICLE_FIELDS, lang);
  const formatted = localized.map(item => ({
    ...item,
    dateFormatted: formatDate(item.date, lang),
    dateRelative: formatRelativeTime(item.date, lang)
  }));
  
  res.json(formatted);
}));

/**
 * @swagger
 * /api/public/faqs:
 *   get:
 *     summary: الأسئلة الشائعة
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [ar, en]
 *         description: Language for content (defaults to 'ar')
 *     tags: [public]
 *     responses:
 *       200:
 *         description: قائمة الأسئلة
 */
router.get('/faqs', asyncHandler(async (req, res) => {
  const lang = validateLang(req.query.lang);
  const items = await prisma.faq.findMany({ orderBy: { sort: 'asc' } });
  res.json(localizeRecords(items, FAQ_FIELDS, lang));
}));

/**
 * @swagger
 * /api/public/delegations:
 *   get:
 *     summary: قائمة المعتمديات
 *     tags: [public]
 *     responses:
 *       200:
 *         description: قائمة الأسماء
 */
router.get('/delegations', asyncHandler(async (_req, res) => {
  const items = await prisma.delegation.findMany({ orderBy: { name: 'asc' } });
  res.json(items.map((d) => d.name));
}));

/**
 * @swagger
 * /api/public/lessons:
 *   get:
 *     summary: الدروس
 *     tags: [public]
 *     responses:
 *       200:
 *         description: قائمة الدروس
 */
router.get('/lessons', asyncHandler(async (_req, res) => {
  const items = await prisma.lesson.findMany({ orderBy: [{ subject: 'asc' }, { order: 'asc' }] });
  res.json(items);
}));

/**
 * @swagger
 * /api/public/story-map:
 *   get:
 *     summary: خريطة القصص (ربط كل قصة بسنة ومادة وسلسلة)
 *     tags: [public]
 *     responses:
 *       200:
 *         description: خريطة القصص
 */
router.get('/story-map', asyncHandler(async (_req, res) => {
  const path = await import('path');
  const fs = await import('fs');
  const file = path.default.join(process.cwd(), 'content', 'stories', 'story-map.json');
  if (!fs.default.existsSync(file)) return res.status(404).json({ error: 'خريطة القصص غير متوفرة' });
  res.json(JSON.parse(fs.default.readFileSync(file, 'utf8')));
}));

/**
 * @swagger
 * /api/public/levels:
 *   get:
 *     summary: المستويات الدراسية
 *     tags: [public]
 *     responses:
 *       200:
 *         description: قائمة المستويات
 */
router.get('/levels', asyncHandler(async (_req, res) => {
  res.json([
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
  ]);
}));

/**
 * @swagger
 * /api/public/locale:
 *   get:
 *     summary: Get locale configuration for frontend
 *     parameters:
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [ar, en]
 *         description: Language code (defaults to 'ar')
 *     tags: [public]
 *     responses:
 *       200:
 *         description: Locale configuration object
 */
/**
 * @swagger
 * /api/public/calendar:
 *   get:
 *     summary: الأجندة المدرسية العامة (بلا تسجيل دخول)
 *     tags: [public]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: string, description: "YYYY — يرجع أحداث السنة كاملة" }
 *       - in: query
 *         name: month
 *         schema: { type: string, description: "1-12 — يضيّق على شهر ضمن السنة" }
 *     responses:
 *       200:
 *         description: قائمة الأحداث
 */
router.get('/calendar', asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const where = {};
  const y = year ? parseInt(year, 10) : NaN;
  if (Number.isFinite(y)) {
    if (month) {
      const m = parseInt(month, 10);
      if (Number.isFinite(m) && m >= 1 && m <= 12) {
        where.date = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) };
      } else {
        where.date = { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59) };
      }
    } else {
      where.date = { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59) };
    }
  }
  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { date: 'asc' }
  });
  res.json(events);
}));

router.get('/locale', asyncHandler(async (req, res) => {
  const lang = validateLang(req.query.lang);
  const localeInfo = getLocaleInfo(lang);
  const htmlAttrs = getHtmlAttrs(lang);
  
  res.json({
    ...localeInfo,
    htmlAttrs,
    // Helper strings for frontend i18n setup
    messages: {
      direction: localeInfo.dir === 'rtl' ? 'rtl' : 'ltr',
      alignStart: localeInfo.dir === 'rtl' ? 'right' : 'left',
      alignEnd: localeInfo.dir === 'rtl' ? 'left' : 'right'
    }
  });
}));

export default router;
