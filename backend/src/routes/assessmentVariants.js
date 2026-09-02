// نقاط نهاية التقويم — المرحلة 3: توليد نسخ الاختبارات + مكتبة الامتحانات الحقيقية
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware } from '../auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import { generateExamVariants } from '../services/assessmentVariantService.js';
import { generateOfflineQuiz } from '../services/offlineQuizGeneratorService.js';
import { generateStandardsExam, CRITERIA_PRESETS } from '../services/standardsExamService.js';
import { assembleOfficialExam, renderOfficialHtml } from '../services/officialExamTemplateService.js';
import { buildOfficialDocx } from '../services/officialDocxService.js';

const router = Router();

/**
 * @swagger
 * /api/teacher/exams/generate-official:
 *   post:
 *     summary: امتحان رسمي بقالب الوزارة التونسية (ترويسة + سناد + تعليمات موسومة بالمعايير + عتبات + جدول إسناد الأعداد) — يعيد HTML جاهزاً للطباعة
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gradeId: { type: string, example: year1 }
 *               subject: { type: string, enum: [math, science, reading, production, handwriting] }
 *               trimester: { type: integer, enum: [1, 2, 3] }
 *               seed: { type: string }
 *               schoolName: { type: string }
 *               format: { type: string, enum: [html, json], default: html }
 *     responses:
 *       200:
 *         description: الامتحان الرسمي
 */
router.post(
  '/exams/generate-official',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    try {
      console.log('[DEBUG generate-official] req.body:', req.body);
      const { gradeId, subject, trimester, seed, schoolName, format } = req.body || {};
      console.log('[DEBUG generate-official] parsed:', { gradeId, subject, trimester, seed, schoolName, format });
      const paper = generateStandardsExam({
        gradeId: gradeId || 'year1',
        subject: subject || 'math',
        seed: seed ?? null
      });
      console.log('[DEBUG generate-official] paper:', paper.error ? 'ERROR' : 'OK', paper.totalScore);
      if (paper.error) return res.status(400).json({ error: paper.error });

      const exam = assembleOfficialExam(paper, {
        gradeId: gradeId || 'year1',
        trimester: Number(trimester) || 3
      });
      if (schoolName) exam.header.schoolLine = `مدرسة : ${schoolName}`;

      if ((format || 'html') === 'json') return res.json(exam);
      if (format === 'docx') {
        console.log('[DEBUG generate-official] Building DOCX...');
        const docxBuffer = await buildOfficialDocx(paper, { gradeId: gradeId || 'year1', subject: subject || 'math', trimester: Number(trimester) || 3, schoolName, teacherName: '' });
        console.log('[DEBUG generate-official] DOCX built, length:', docxBuffer.length);
        const filename = `exam_${subject}_${gradeId}_T${trimester}_${Date.now()}.docx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(docxBuffer);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderOfficialHtml(exam));
    } catch (e) {
      console.error('[ERROR generate-official]:', e.message, e.stack);
      return res.status(500).json({ error: e.message });
    }
  })
);

/**
 * @swagger
 * /api/teacher/exams/generate-standards:
 *   post:
 *     summary: بناء امتحان رسمي كامل حسب المعايير الرسمية (جدول معايير 20 نقطة + أسئلة مولّدة إجرائياً طازجة موسومة بمعاييرها)
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gradeId: { type: string, example: year1 }
 *               subject: { type: string, enum: [math, science, reading, production, handwriting], example: math }
 *               seed: { type: string, description: اختياري — نفس القيمة تعيد نفس الامتحان }
 *               save: { type: boolean }
 *               classId: { type: integer }
 *               title: { type: string }
 *     responses:
 *       200:
 *         description: ورقة الامتحان الرسمي
 */
router.post(
  '/exams/generate-standards',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const { gradeId, subject, seed, save, classId, title } = req.body || {};
    const paper = generateStandardsExam({
      gradeId: gradeId || 'year1',
      subject: subject || 'math',
      seed: seed ?? null
    });
    if (paper.error) return res.status(400).json({ error: paper.error });

    if (save && classId) {
      const quiz = await prisma.quiz.create({
        data: {
          teacherId: req.user.id,
          classId: Number(classId),
          title: title || `امتحان معايير — ${subject}`,
          subject: subject || 'math',
          questions: paper.questions
        }
      });
      return res.status(201).json({ ...paper, savedQuizId: quiz.id });
    }

    res.json(paper);
  })
);

/**
 * @swagger
 * /api/teacher/exams/standards-presets:
 *   get:
 *     summary: جداول المعايير الرسمية المتاحة لكل سنة ومادة
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الجداول
 */
router.get(
  '/exams/standards-presets',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (_req, res) => {
    res.json(CRITERIA_PRESETS);
  })
);

/**
 * @swagger
 * /api/teacher/quizzes/generate-offline:
 *   post:
 *     summary: توليد اختبار من البنك المحلي المدمج — يعمل بلا إنترنت نهائياً
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gradeId: { type: string, example: year1 }
 *               subject: { type: string, enum: [math, anisi, production], example: math }
 *               count: { type: integer, minimum: 1, maximum: 30 }
 *               seed: { type: string, description: اختياري — نفس القيمة تعيد نفس الاختبار }
 *               save: { type: boolean, description: حفظ كاختبار رسمي في قسم محدد }
 *               classId: { type: integer }
 *               title: { type: string }
 *     responses:
 *       200:
 *         description: ورقة الأسئلة المولدة (أو الاختبار المحفوظ)
 */
router.post(
  '/quizzes/generate-offline',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const { gradeId, subject, count, seed, save, classId, title } = req.body || {};
    const paper = generateOfflineQuiz({
      gradeId: gradeId || 'year1',
      subject: subject || 'math',
      count: Number(count) || 10,
      seed: seed ?? null
    });
    if (!paper.count) return res.status(400).json({ error: paper.note });

    if (save && classId) {
      const quiz = await prisma.quiz.create({
        data: {
          teacherId: req.user.id,
          classId: Number(classId),
          title: title || `اختبار مولّد — ${subject}`,
          subject: subject || 'math',
          questions: paper.questions
        }
      });
      return res.status(201).json({ ...paper, savedQuizId: quiz.id });
    }

    res.json(paper);
  })
);

/**
 * @swagger
 * /api/teacher/exams-library:
 *   get:
 *     summary: مكتبة الامتحانات التونسية الحقيقية (من مجموعة الأستاذ) مصنفة بالثلاثي والمادة
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: trimester
 *         schema: { type: integer }
 *       - in: query
 *         name: subject
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الامتحانات
 */
router.get(
  '/exams-library',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const manifestPath = path.join(process.cwd(), 'curriculum', 'year1', 'exams-library.json');
    if (!fs.existsSync(manifestPath)) return res.json({ count: 0, items: [] });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    let items = manifest.items || [];
    if (req.query.trimester) items = items.filter((i) => i.trimester === Number(req.query.trimester));
    if (req.query.subject) items = items.filter((i) => i.subject.id === String(req.query.subject));
    res.json({ count: items.length, items });
  })
);

/**
 * @swagger
 * /api/teacher/quizzes/{id}/variants:
 *   post:
 *     summary: توليد نسخ متعددة من الاختبار بنفس الـBlueprint والصعوبة (ترتيب أسئلة وخيارات مختلف لكل نسخة)
 *     tags: [teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count: { type: integer, minimum: 1, maximum: 8, description: عدد النسخ المطلوبة }
 *     responses:
 *       200:
 *         description: النسخ المولدة (حتمية — نفس الطلب يعيد نفس النسخ)
 *       404:
 *         description: الاختبار غير موجود
 */
router.post(
  '/quizzes/:id/variants',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const quiz = await prisma.quiz.findUnique({ where: { id: Number(req.params.id) } });
    if (!quiz) throw new ApiError(404, 'الاختبار غير موجود');
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (!questions.length) throw new ApiError(400, 'الاختبار بلا أسئلة.');

    const variants = generateExamVariants(questions, req.body?.count || 2, `quiz-${quiz.id}`);
    res.json({
      quizId: quiz.id,
      title: quiz.title,
      subject: quiz.subject,
      blueprintNote: 'كل النسخ تحمل نفس الأسئلة والأنواع والنقاط والصعوبة — تختلف في ترتيب الأسئلة ومواضع الخيارات فقط. التوليد حتمي: إعادة الطلب تعيد نفس النسخ.',
      variants
    });
  })
);

// ===== بنك الأسئلة - توليد اوفلاين =====
router.post(
  '/exams/generate-from-bank',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const { gradeId = 'year1', subject = 'math', trimester: rawTrimester = 3, count = 10 } = req.body;
    const teacherId = req.user.id;

    // تطبيع الثلاثي: يقبل 3 أو '3' أو 't3' → يخزنه كـ 't3' للبنك
    const trimesterNum = Number(String(rawTrimester).replace('t', ''));
    const trimesterKey = `t${trimesterNum}`;

    const { getUnusedQuestions, markQuestionsAsUsed } = await import('../services/questionBankService.js');
    const { buildOfficialDocx } = await import('../services/officialDocxService.js');

    const questions = getUnusedQuestions(subject, gradeId, trimesterKey, teacherId, count);
    if (!questions.length) {
      throw new ApiError(404, 'لا توجد أسئلة متاحة في البنك لهذه المادة والسنة والثلاثي');
    }

    // تحديد الأسئلة كمستخدمة
    markQuestionsAsUsed(teacherId, questions.map(q => q.id));

    const exam = {
      gradeId,
      subject,
      trimester: trimesterNum,
      criteria: groupQuestionsByCriteria(questions),
      questions,
      totalScore: 20,
      source: 'bank',
      generatedAt: new Date().toISOString()
    };

    const format = req.body.format || 'docx';
    if (format === 'docx') {
      const buffer = await buildOfficialDocx(exam, {
        gradeId,
        subject,
        trimester: Number(trimester.replace('t', '')),
        schoolName: req.body.schoolName || ''
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="اختبار_${subject}_${gradeId}_${trimester}.docx"`);
      res.send(Buffer.from(buffer));
    } else {
      res.json(exam);
    }
  })
);

// ===== توليد بالذكاء الاصطناعي =====
router.post(
  '/exams/generate-with-ai',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const { apiKey, gradeId = 'year1', subject = 'math', trimester = 't3', customPrompt } = req.body;

    if (!apiKey) {
      throw new ApiError(400, 'مفتاح API مطلوب');
    }

    const { generateWithAI, generateWithAIGeneral } = await import('../services/aiExamGenerator.js');
    const { buildOfficialDocx } = await import('../services/officialDocxService.js');
    const { addQuestionsToBank } = await import('../services/questionBankService.js');

    const trimesterKey = `t${Number(trimester)}`;

    let exam;
    try {
      // محاولة القالب أولاً
      exam = await generateWithAI(apiKey, subject, gradeId, trimesterKey);
    } catch (e) {
      // إذا لم يكن هناك قالب، استخدم التوليد العام
      exam = await generateWithAIGeneral(apiKey, subject, gradeId, trimesterKey, customPrompt);
    }

    // حفظ الأسئلة في البنك تلقائياً لاستخدامها لاحقاً
    let savedCount = 0;
    if (exam.questions && exam.questions.length > 0) {
      savedCount = addQuestionsToBank(subject, gradeId, trimesterKey, exam.questions);
    }

    const format = req.body.format || 'docx';
    if (format === 'docx') {
      const docxExam = {
        ...exam,
        criteria: groupQuestionsByCriteria(exam.questions),
        totalScore: 20
      };
      const buffer = await buildOfficialDocx(docxExam, {
        gradeId,
        subject,
        trimester: Number(trimester),
        schoolName: req.body.schoolName || ''
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="اختبار_${subject}_${gradeId}_T${trimester}.docx"`);
      res.send(Buffer.from(buffer));
    } else {
      res.json({ ...exam, savedToBank: savedCount });
    }
  })
);

// ===== فحص مفتاح API =====
router.post(
  '/exams/validate-api-key',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) throw new ApiError(400, 'مفتاح API مطلوب');

    const { validateAPIKey } = await import('../services/aiExamGenerator.js');
    const result = await validateAPIKey(apiKey);
    res.json(result);
  })
);

// ===== إحصائيات بنك الأسئلة =====
router.get(
  '/exams/bank-stats',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const { getAvailableCombinations, getBankStats, getSavedStats } = await import('../services/questionBankService.js');
    const combinations = getAvailableCombinations();
    const savedStats = getSavedStats();
    res.json({ combinations, savedStats });
  })
);

// ===== إعادة ضبط بنك الأسئلة =====
router.post(
  '/exams/reset-bank',
  authMiddleware,
  teacherMiddleware,
  asyncHandler(async (req, res) => {
    const { resetUsage } = await import('../services/questionBankService.js');
    resetUsage(req.user.id, req.body.subject);
    res.json({ message: 'تم إعادة ضبط البنك بنجاح' });
  })
);

// Helper: تجميع الأسئلة حسب المعايير
function groupQuestionsByCriteria(questions) {
  const groups = {};
  for (const q of questions) {
    const code = q.criteria || 'مع1';
    if (!groups[code]) {
      groups[code] = { code, label: code, max: 0, subCriteria: [] };
    }
    groups[code].max += q.points || 0;
    if (q.subCriterion) {
      const sub = groups[code].subCriteria.find(s => s.code === q.subCriterion);
      if (sub) {
        sub.max += q.points || 0;
      } else {
        groups[code].subCriteria.push({
          code: q.subCriterion,
          label: q.subCriterion,
          max: q.points || 0
        });
      }
    }
  }
  return Object.values(groups);
}

export default router;