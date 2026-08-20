import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { authMiddleware } from '../auth.js';
import { validateBody } from '../middleware/validate.js';
import { helpRequestCreateSchema, contactMessageSchema } from '../validators/helpRequest.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-\u0600-\u06FF]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png|doc|docx/;
    const ok = allowed.test(file.mimetype) || allowed.test(file.originalname);
    cb(null, ok);
  }
});

const router = Router();

/**
 * @swagger
 * /api/help-requests/types:
 *   get:
 *     summary: أنواع طلبات المساعدة
 *     tags: [help-requests]
 *     responses:
 *       200:
 *         description: قائمة الأنواع
 */
router.get('/types', asyncHandler(async (_req, res) => {
  res.json([
    'طلب مساعدة',
    'طلب الحصول على شهادة مدرسية',
    'طلب إنشاء مؤسسة تعليمية خاصة',
    'طلب معادلة',
    'مطلب إدماج تلاميذ',
    'إشكال في إنشاء الحساب',
    'إشكال في التسجيل',
    'سؤال آخر'
  ]);
}));

/**
 * @swagger
 * /api/help-requests:
 *   post:
 *     summary: تقديم طلب مساعدة
 *     tags: [help-requests]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, requestType]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               requestType: { type: string }
 *               delegation: { type: string }
 *               description: { type: string }
 *               attachment: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post(
  '/',
  upload.single('attachment'),
  validateBody(helpRequestCreateSchema),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, email, requestType, delegation, description, userId } = req.body;
    const data = {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      phone: phone || null,
      email: email || null,
      requestType: String(requestType),
      delegation: delegation || null,
      description: description || null,
      attachment: req.file ? `/uploads/${req.file.filename}` : null
    };
    if (userId) {
      const parsed = Number(userId);
      if (!Number.isNaN(parsed)) data.userId = parsed;
    }
    const request = await prisma.helpRequest.create({ data });
    res.status(201).json(request);
  })
);

/**
 * @swagger
 * /api/help-requests/contact:
 *   post:
 *     summary: إرسال رسالة اتصال عامة
 *     tags: [help-requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, message]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: تم إرسال الرسالة
 *       400:
 *         description: فشل التحقق من البيانات
 */
router.post(
  '/contact',
  validateBody(contactMessageSchema),
  asyncHandler(async (req, res) => {
    const { name, email, phone, subject, message } = req.body;
    const msg = await prisma.contactMessage.create({
      data: {
        name: String(name).trim(),
        email: String(email).trim(),
        phone: phone || null,
        subject: subject || 'رسالة عامة',
        message: String(message).trim()
      }
    });
    res.status(201).json(msg);
  })
);

/**
 * @swagger
 * /api/help-requests/mine:
 *   get:
 *     summary: طلبات المساعدة الخاصة بالمستخدم
 *     tags: [help-requests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 */
router.get('/mine', authMiddleware, asyncHandler(async (req, res) => {
  const items = await prisma.helpRequest.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(items);
}));

export default router;
