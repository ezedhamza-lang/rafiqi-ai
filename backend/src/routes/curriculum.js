import { Router } from 'express';
import {
  listBooks,
  getBook,
  getLessonPages,
  getBookExercises,
  getSubjectsForLevel,
  listStorySeries,
  getStorySeries,
  getTemplates,
  getQuestionBank,
  getPlans,
  listCountries
} from '../services/curriculumService.js';
import { listBankExams, getBankExam, listBankSubjects, listBankLevels, sanitizeBankExamForStudent } from '../services/officialExamService.js';
import { listVideos, getVideo } from '../services/videoCatalogService.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/**
 * @swagger
 * /api/public/curriculum/books:
 *   get:
 *     summary: قائمة الكتب
 *     tags: [curriculum]
 *     parameters:
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *         description: رمز السوق (افتراضياً TN) — الدفعة 3
 *     responses:
 *       200:
 *         description: قائمة الكتب
 */
router.get('/curriculum/books', asyncHandler(async (req, res) => {
  res.json(listBooks(req.query.country));
}));

/**
 * @swagger
 * /api/public/curriculum/countries:
 *   get:
 *     summary: الأسواق (الدول) المتاحة في محرّك المنهج (الدفعة 3)
 *     tags: [curriculum]
 *     responses:
 *       200:
 *         description: قائمة الأسواق
 */
router.get('/curriculum/countries', asyncHandler(async (_req, res) => {
  res.json(listCountries());
}));

/**
 * @swagger
 * /api/public/curriculum/books/{gradeId}/{subjectId}:
 *   get:
 *     summary: كتاب حسب السنة والمادة
 *     tags: [curriculum]
 *     parameters:
 *       - in: path
 *         name: gradeId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: الكتاب
 *       404:
 *         description: الكتاب غير موجود
 */
router.get('/curriculum/books/:gradeId/:subjectId', asyncHandler(async (req, res) => {
  const book = getBook(req.params.gradeId, req.params.subjectId, req.query.country);
  if (!book) throw new ApiError(404, 'الكتاب غير موجود');
  res.json(book);
}));

/**
 * @swagger
 * /api/public/curriculum/books/{gradeId}/{subjectId}/lessons:
 *   get:
 *     summary: دروس كتاب
 *     tags: [curriculum]
 *     parameters:
 *       - in: path
 *         name: gradeId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الدروس
 *       404:
 *         description: الكتاب غير موجود
 */
router.get('/curriculum/books/:gradeId/:subjectId/lessons', asyncHandler(async (req, res) => {
  const country = req.query.country;
  const book = getBook(req.params.gradeId, req.params.subjectId, country);
  if (!book) throw new ApiError(404, 'الكتاب غير موجود');
  const pages = getLessonPages(req.params.subjectId, book.grade, req.params.gradeId, country);
  res.json(pages);
}));

/**
 * @swagger
 * /api/public/curriculum/books/{gradeId}/{subjectId}/exercises:
 *   get:
 *     summary: تمارين تفاعلية لكتاب
 *     tags: [curriculum]
 *     parameters:
 *       - in: path
 *         name: gradeId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة التمارين التفاعلية
 *       404:
 *         description: الكتاب غير موجود
 */
router.get('/curriculum/books/:gradeId/:subjectId/exercises', asyncHandler(async (req, res) => {
  const country = req.query.country;
  const book = getBook(req.params.gradeId, req.params.subjectId, country);
  if (!book) throw new ApiError(404, 'الكتاب غير موجود');
  res.json(getBookExercises(req.params.subjectId, book.grade, req.params.gradeId, country));
}));

/**
 * @swagger
 * /api/public/curriculum/books/{gradeId}/{subjectId}/videos:
 *   get:
 *     summary: فيديوهات قصيرة لكتاب (المرحلة 6.4)
 *     tags: [curriculum]
 *     parameters:
 *       - in: path
 *         name: gradeId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الفيديوهات القصيرة للكتاب
 *       404:
 *         description: الكتاب غير موجود
 */
router.get('/curriculum/books/:gradeId/:subjectId/videos', asyncHandler(async (req, res) => {
  const book = getBook(req.params.gradeId, req.params.subjectId);
  if (!book) throw new ApiError(404, 'الكتاب غير موجود');
  res.json(listVideos({ gradeId: req.params.gradeId, subjectId: req.params.subjectId }));
}));

/**
 * @swagger
 * /api/public/curriculum/subjects:
 *   get:
 *     summary: المواد حسب المستوى
 *     tags: [curriculum]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: string }
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *         description: رمز السوق (افتراضياً TN) — الدفعة 3
 *     responses:
 *       200:
 *         description: قائمة المواد
 */
router.get('/curriculum/subjects', asyncHandler(async (req, res) => {
  const level = req.query.level || '';
  res.json(getSubjectsForLevel(level, req.query.country));
}));

/**
 * @swagger
 * /api/public/stories:
 *   get:
 *     summary: سلسلات القصص
 *     tags: [curriculum]
 *     responses:
 *       200:
 *         description: قائمة السلسلات
 */
router.get('/stories', asyncHandler(async (req, res) => {
  res.json(listStorySeries(req.query.country));
}));

/**
 * @swagger
 * /api/public/stories/{id}:
 *   get:
 *     summary: سلسلة قصة
 *     tags: [curriculum]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: السلسلة
 *       404:
 *         description: السلسلة غير موجودة
 */
router.get('/stories/:id', asyncHandler(async (req, res) => {
  const series = getStorySeries(req.params.id, req.query.country);
  if (!series) throw new ApiError(404, 'السلسلة غير موجودة');
  res.json(series);
}));

/**
 * @swagger
 * /api/public/templates:
 *   get:
 *     summary: القوالب
 *     tags: [curriculum]
 *     responses:
 *       200:
 *         description: القوالب
 */
router.get('/templates', asyncHandler(async (req, res) => {
  res.json(getTemplates(req.query.country));
}));

/**
 * @swagger
 * /api/public/question-bank:
 *   get:
 *     summary: بنك الأسئلة
 *     tags: [curriculum]
 *     responses:
 *       200:
 *         description: بنك الأسئلة
 */
router.get('/question-bank', asyncHandler(async (req, res) => {
  res.json(getQuestionBank(req.query.country));
}));

/**
 * @swagger
 * /api/public/plans:
 *   get:
 *     summary: الخطط
 *     tags: [curriculum]
 *     responses:
 *       200:
 *         description: الخطط
 */
router.get('/plans', asyncHandler(async (req, res) => {
  res.json(getPlans(req.query.country));
}));

/**
 * @swagger
 * /api/public/official-exams-bank:
 *   get:
 *     summary: بنك الاختبارات الرسمية (مرشّح حسب السنة/المادة/الثلاثي)
 *     tags: [curriculum]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: string }
 *       - in: query
 *         name: subject
 *         schema: { type: string }
 *       - in: query
 *         name: trimester
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: قائمة الاختبارات الرسمية
 */
router.get('/official-exams-bank', asyncHandler(async (req, res) => {
  const { level, subject, trimester } = req.query;
  res.json(
    listBankExams({
      level,
      subject,
      trimester: trimester === undefined || trimester === '' ? undefined : Number(trimester)
    }).map(sanitizeBankExamForStudent)
  );
}));

/**
 * @swagger
 * /api/public/official-exams-bank/levels:
 *   get:
 *     summary: السنوات المتوفرة في بنك الاختبارات الرسمية
 *     tags: [curriculum]
 *     responses:
 *       200:
 *         description: قائمة السنوات
 */
router.get('/official-exams-bank/levels', asyncHandler(async (_req, res) => {
  res.json(listBankLevels());
}));

/**
 * @swagger
 * /api/public/official-exams-bank/subjects:
 *   get:
 *     summary: المواد المتوفرة في بنك الاختبارات الرسمية
 *     tags: [curriculum]
 *     responses:
 *       200:
 *         description: قائمة المواد
 */
router.get('/official-exams-bank/subjects', asyncHandler(async (_req, res) => {
  res.json(listBankSubjects());
}));

/**
 * @swagger
 * /api/public/official-exams-bank/{id}:
 *   get:
 *     summary: تفاصيل اختبار رسمي من البنك
 *     tags: [curriculum]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: الاختبار الرسمي
 *       404:
 *         description: الاختبار غير موجود
 */
router.get('/official-exams-bank/:id', asyncHandler(async (req, res) => {
  const exam = getBankExam(req.params.id);
  if (!exam) throw new ApiError(404, 'الاختبار غير موجود');
  res.json(sanitizeBankExamForStudent(exam));
}));

/**
 * @swagger
 * /api/public/videos:
 *   get:
 *     summary: كتالوج الفيديوهات القصيرة (مرشّح حسب السنة/المادة/الوحدة)
 *     tags: [curriculum]
 *     parameters:
 *       - in: query
 *         name: gradeId
 *         schema: { type: string }
 *       - in: query
 *         name: subjectId
 *         schema: { type: string }
 *       - in: query
 *         name: unitId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الفيديوهات القصيرة المتاحة (مصادر خارجية معتمدة)
 */
router.get('/videos', asyncHandler(async (req, res) => {
  const { gradeId, subjectId, unitId } = req.query;
  res.json(listVideos({ gradeId, subjectId, unitId }));
}));

/**
 * @swagger
 * /api/public/videos/{id}:
 *   get:
 *     summary: تفاصيل فيديو قصير من الكتالوج
 *     tags: [curriculum]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: الفيديو
 *       404:
 *         description: الفيديو غير موجود
 */
router.get('/videos/:id', asyncHandler(async (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) throw new ApiError(404, 'الفيديو غير موجود');
  res.json(video);
}));

export default router;
