import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { actorSchoolId } from '../tenant.js';
import { notify } from '../services/notify.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { parentDocCreateSchema, docReviewSchema, parentDocStatusQuerySchema, parentDocIdParamSchema } from '../validators/parentDocument.js';
import { validateUploadedFiles, discardUploadsOnError } from '../utils/fileSecurity.js';
import { strictExtFilter, safeFilename } from '../utils/uploadSafe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DOC_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads/documents')),
  filename: safeFilename('pdoc')
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: strictExtFilter(DOC_EXT)
});

export const PARENT_DOC_TYPES = [
  'شهادة طبية',
  'وثيقة تسجيل',
  'مطلب استثناء',
  'مطلب انتقال',
  'طلب شهادة مدرسية',
  'ملف منحة',
  'وثيقة أخرى'
];

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/parent/documents:
 *   get:
 *     summary: أرشيف وثائق الولي
 *     tags: [parent-documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الوثائق
 */
router.get('/documents', requireRole('PARENT', 'TEACHER'), asyncHandler(async (req, res) => {
  const docs = await prisma.parentDocument.findMany({
    where: { parentId: req.user.id },
    include: { student: { select: { id: true, firstName: true, lastName: true, level: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(docs);
}));

/**
 * @swagger
 * /api/parent/documents/types:
 *   get:
 *     summary: أنواع الوثائق المتاحة
 *     tags: [parent-documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الأنواع
 */
router.get('/documents/types', requireRole('PARENT', 'TEACHER'), asyncHandler(async (_req, res) => {
  res.json(PARENT_DOC_TYPES);
}));

/**
 * @swagger
 * /api/parent/documents:
 *   post:
 *     summary: تقديم وثيقة من الولي
 *     tags: [parent-documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [docType, file]
 *             properties:
 *               studentId: { type: integer }
 *               docType: { type: string }
 *               title: { type: string }
 *               note: { type: string }
 *               file: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: تم إنشاء الوثيقة
 *       400:
 *         description: فشل التحقق من البيانات
 *       404:
 *         description: التلميذ غير موجود
 */
router.post('/documents', requireRole('PARENT', 'TEACHER'), upload.single('file'), discardUploadsOnError, validateBody(parentDocCreateSchema), asyncHandler(async (req, res) => {
  const { studentId, docType, title, note } = req.body;
  if (!req.file) throw new ApiError(400, 'يرجى إرفاق ملف الوثيقة (PDF أو صورة)');
  const badFiles = validateUploadedFiles([req.file], ['pdf', 'jpeg', 'png', 'zip']);
  if (badFiles.length) throw new ApiError(400, 'نوع الملف غير مدعوم — يُقبل PDF أو صورة أو مستند Word فقط');

  if (studentId) {
    const student = await prisma.student.findFirst({
      where: { id: Number(studentId), userId: req.user.id }
    });
    if (!student) throw new ApiError(404, 'التلميذ غير موجود في حساباتك');
  }

  const doc = await prisma.parentDocument.create({
    data: {
      parentId: req.user.id,
      studentId: studentId ? Number(studentId) : null,
      docType: String(docType).trim(),
      title: title ? String(title).trim().slice(0, 200) : null,
      note: note ? String(note).trim().slice(0, 2000) : null,
      fileName: req.file.originalname,
      fileUrl: `/uploads/documents/${req.file.filename}`
    },
    include: { student: { select: { id: true, firstName: true, lastName: true, level: true } } }
  });

  // إشعار مستهدف: مديرو مدرسة الولي فقط (+ إدارة المنصة) — لا بث لكل مديري المنصة
  const directorWhere = req.user.schoolId != null
    ? { OR: [{ role: 'ADMIN' }, { role: 'SCHOOL_DIRECTOR', schoolId: req.user.schoolId }] }
    : { role: { in: ['ADMIN', 'SCHOOL_DIRECTOR'] } };
  await prisma.notification.createMany({
    data: (
      await prisma.user.findMany({ where: directorWhere, select: { id: true } })
    ).map((u) => ({
      userId: u.id,
      type: 'PARENT_DOCUMENT',
      title: 'وثيقة جديدة من ولي',
      body: `${req.user.firstName} ${req.user.lastName} أرسل وثيقة: ${doc.docType}`,
      link: '/director/documents'
    }))
  });

  res.status(201).json(doc);
}));

/**
 * @swagger
 * /api/director/documents/all:
 *   get:
 *     summary: صندوق وثائق الأولياء (المدير/الإدارة)
 *     tags: [parent-documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الوثائق
 */
router.get('/documents/all', requireRole('SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'), validateQuery(parentDocStatusQuerySchema), asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;
  // عزل مدارس: مدير مدرسة يرى وثائق أولياء مدرسته فقط (المشرف العام يرى الكل)
  const sid = actorSchoolId(req);
  if (sid != null) where.parent = { schoolId: sid };
  const docs = await prisma.parentDocument.findMany({
    where,
    include: {
      parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      student: { select: { id: true, firstName: true, lastName: true, level: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(docs);
}));

/**
 * @swagger
 * /api/parent/documents/{id}:
 *   get:
 *     summary: تفاصيل وثيقة معينة (الولي)
 *     tags: [parent-documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: الوثيقة
 *       404:
 *         description: الوثيقة غير موجودة
 */
router.get('/documents/:id', requireRole('PARENT', 'TEACHER'), validateParams(parentDocIdParamSchema), asyncHandler(async (req, res) => {
  const doc = await prisma.parentDocument.findFirst({
    where: { id: Number(req.params.id), parentId: req.user.id },
    include: { student: { select: { id: true, firstName: true, lastName: true, level: true } } }
  });
  if (!doc) throw new ApiError(404, 'الوثيقة غير موجودة');
  res.json(doc);
}));

/**
 * @swagger
 * /api/director/documents/{id}/review:
 *   put:
 *     summary: مراجعة وثيقة (الموافقة أو الرفض)
 *     tags: [parent-documents]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               directorReply: { type: string }
 *     responses:
 *       200:
 *         description: تمت المراجعة
 *       400:
 *         description: حالة غير صالحة أو تمت المراجعة مسبقا
 *       404:
 *         description: الوثيقة غير موجودة
 */
router.put('/documents/:id/review', requireRole('SCHOOL_DIRECTOR', 'ADMIN'), validateParams(parentDocIdParamSchema), validateBody(docReviewSchema), asyncHandler(async (req, res) => {
  const { status, directorReply } = req.body;
  // عزل مدارس: لا يراجع مديرٌ وثيقة ولي من مدرسة أخرى
  const sid = actorSchoolId(req);
  const doc = await prisma.parentDocument.findFirst({
    where: { id: Number(req.params.id), ...(sid != null ? { parent: { schoolId: sid } } : {}) }
  });
  if (!doc) throw new ApiError(404, 'الوثيقة غير موجودة');
  if (doc.status !== 'PENDING' && doc.status !== 'UNDER_REVIEW') {
    throw new ApiError(400, 'تمت مراجعة هذه الوثيقة مسبقا');
  }

  const updated = await prisma.parentDocument.update({
    where: { id: doc.id },
    data: {
      status,
      directorReply: directorReply ? String(directorReply).trim().slice(0, 2000) : null,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    }
  });

  await notify([doc.parentId], {
    type: status === 'APPROVED' ? 'DOC_APPROVED' : 'DOC_REJECTED',
    title: status === 'APPROVED' ? 'تمت الموافقة على وثيقتك' : 'تم رفض وثيقتك',
    body: status === 'APPROVED'
      ? `تمت الموافقة على وثيقة «${doc.docType}»: ${updated.directorReply || 'تم استلام الوثيقة بنجاح'}`
      : `تم رفض وثيقة «${doc.docType}»: ${updated.directorReply || 'لا يوجد سبب مذكور'}`,
    link: '/parent/documents'
  });

  res.json(updated);
}));

export default router;
