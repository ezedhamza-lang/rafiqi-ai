import { Router } from 'express';
import { authMiddleware, teacherMiddleware } from '../auth.js';
import { generateMemo, rebuildMemo, MemoBuildError } from '../services/lessonMemoService.js';
import { listMethodologies } from '../services/methodologyResolver.js';
import * as lessonMemos from '../repositories/lessonMemos.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  memoGenerateSchema,
  memosListQuerySchema,
  memoIdParamSchema
} from '../validators/memos.js';

const router = Router();
router.use(authMiddleware);

function toApiError(e) {
  if (e instanceof MemoBuildError) {
    const status = e.code === 'LESSON_NOT_FOUND' ? 404 : 400;
    return new ApiError(status, e.message);
  }
  return e;
}

/**
 * @swagger
 * /api/memos/methodologies:
 *   get:
 *     summary: بروفايلات المنهجية المتوفّرة (سنة × مادة × نوع درس)
 *     tags: [memos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة بروفايلات المنهجية
 */
router.get('/methodologies', asyncHandler(async (req, res) => {
  res.json(listMethodologies());
}));

/**
 * @swagger
 * /api/memos/generate:
 *   post:
 *     summary: توليد مذكرة درس وفق بروفايل المنهجية (من BookContent محليًا، بلا AI)
 *     tags: [memos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, lessonTitle]
 *             properties:
 *               subject: { type: string, description: 'المادة (مثال: رياضيات، قراءة)' }
 *               level: { type: string, description: 'المستوى (مثال: السنة الأولى أساسي)' }
 *               lessonTitle: { type: string }
 *               lessonType: { type: string, description: 'نوع الدرس عند الغموض (اختياري)' }
 *               unit: { type: string }
 *     responses:
 *       200:
 *         description: المذكرة (cached=false عند البناء، true عند الاسترجاع من الذاكرة)
 *       400:
 *         description: لا منهجية/لا كتاب/درس غير موجود
 */
router.post('/generate', teacherMiddleware, validateBody(memoGenerateSchema), asyncHandler(async (req, res) => {
  const { subject, level, lessonTitle, lessonType, unit } = req.body;
  try {
    const result = await generateMemo({
      teacherId: req.user.id,
      subject,
      level,
      lessonTitle,
      lessonType,
      unit
    });
    res.json(result);
  } catch (e) {
    throw toApiError(e);
  }
}));

/**
 * @swagger
 * /api/memos/rebuild:
 *   post:
 *     summary: حذف النسخة المحفوظة للمذكرة وإعادة بنائها من جديد
 *     tags: [memos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, lessonTitle]
 *             properties:
 *               subject: { type: string }
 *               level: { type: string }
 *               lessonTitle: { type: string }
 *               lessonType: { type: string }
 *               unit: { type: string }
 *     responses:
 *       200:
 *         description: المذكرة المعاد بناؤها
 *       400:
 *         description: فشل إعادة البناء
 */
router.post('/rebuild', teacherMiddleware, validateBody(memoGenerateSchema), asyncHandler(async (req, res) => {
  const { subject, level, lessonTitle, lessonType, unit } = req.body;
  try {
    const result = await rebuildMemo({
      teacherId: req.user.id,
      subject,
      level,
      lessonTitle,
      lessonType,
      unit
    });
    res.json(result);
  } catch (e) {
    throw toApiError(e);
  }
}));

/**
 * @swagger
 * /api/memos:
 *   get:
 *     summary: أحدث المذكرات المولَّدة عبر LessonMemoService
 *     tags: [memos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: قائمة المذكرات
 */
router.get('/', teacherMiddleware, validateQuery(memosListQuerySchema), asyncHandler(async (req, res) => {
  const memos = await lessonMemos.listForTeacher(req.user.id, req.query.limit);
  res.json(memos);
}));

/**
 * @swagger
 * /api/memos/{id}:
 *   delete:
 *     summary: حذف مذكرة محفوظة
 *     tags: [memos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: تم الحذف
 */
/**
 * @swagger
 * /api/memos/{id}/pdf:
 *   get:
 *     summary: تنزيل المذكرة الرسمية PDF (محفوظة باسم المعلّم)
 *     tags: [memos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ملف PDF
 *       404:
 *         description: المذكرة غير موجودة
 */
router.get('/:id/pdf', teacherMiddleware, validateParams(memoIdParamSchema), asyncHandler(async (req, res) => {
  const memo = await lessonMemos.findByIdForTeacher(req.params.id, req.user.id);
  if (!memo) throw new ApiError(404, 'المذكرة غير موجودة');
  const { buildMemoDocx } = await import('../services/memoDocxService.js');
  const raw = await buildMemoDocx(memo);
  const buf = Buffer.from([...new Uint8Array(raw)]);
  const safeTitle = (memo.lessonTitle || 'memo').replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
  const filename = encodeURIComponent(safeTitle) + '.docx';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
  res.setHeader('Content-Length', String(buf.length));
  res.send(buf);
}));

router.delete('/:id', teacherMiddleware, validateParams(memoIdParamSchema), asyncHandler(async (req, res) => {
  await lessonMemos.deleteById(req.params.id, req.user.id);
  res.json({ ok: true });
}));

export default router;
