import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { authMiddleware, teacherMiddleware, studentMiddleware } from '../auth.js';
import { notify } from '../services/notify.js';
import { mergeImagesToPdf, ensureUploadDir, MAX_SCAN_PAGES } from '../services/scanService.js';
import { validateUploadedFiles, discardUploadsOnError } from '../utils/fileSecurity.js';
import { SUBJECTS } from './classSubjects.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import {
  submittedExamCreateSchema,
  submittedExamUpdateSchema,
  submittedExamStatusQuerySchema,
  submittedExamIdParamSchema
} from '../validators/submittedExam.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.join(__dirname, '../../uploads/exams/source');

const SUBJECT_LABELS = Object.fromEntries(SUBJECTS.map((s) => [s.code, s.label]));

if (!fs.existsSync(SOURCE_DIR)) {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
}
ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SOURCE_DIR),
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.(jpg|jpeg|png)$/i) || [])[1] || 'jpg';
    cb(null, `scan-src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(jpeg|png|jpg)/.test(file.mimetype) || /\.(jpg|jpeg|png)$/i.test(file.originalname);
    cb(null, ok);
  }
});

const router = Router();
router.use(authMiddleware);

function sanitizePart(s) {
  return String(s ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF.\-_ ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);
}

function statusLabel(status) {
  switch (status) {
    case 'SENT':
      return 'مرسل';
    case 'IN_REVIEW':
      return 'قيد التصحيح';
    case 'CORRECTED':
      return 'مصحح';
    default:
      return status;
  }
}

/**
 * @swagger
 * /api/teacher/student/submitted-exams:
 *   post:
 *     summary: مسح وإرسال ورقة اختبار (التلميذ)
 *     tags: [submitted-exams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [subject, examTitle, images]
 *             properties:
 *               subject: { type: string, enum: [MATH, READING, SCIENCE, STORIES] }
 *               examTitle: { type: string }
 *               images: { type: array, items: { type: string, format: binary } }
 *     responses:
 *       201:
 *         description: تم الإرسال
 *       400:
 *         description: فشل التحقق من البيانات أو المادة غير صالحة
 *       403:
 *         description: هذا الفضاء مخصص للتلميذ
 *       404:
 *         description: التلميذ غير موجود
 */
router.post('/student/submitted-exams', studentMiddleware, upload.array('images', MAX_SCAN_PAGES), discardUploadsOnError, validateBody(submittedExamCreateSchema), asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') throw new ApiError(403, 'هذا الفضاء مخصص للتلميذ');
  const { subject, examTitle } = req.body;

  if (!req.files || req.files.length === 0) throw new ApiError(400, 'يرجى مسح أو رفع صفحة واحدة على الأقل');
  if (req.files.length > MAX_SCAN_PAGES) {
    throw new ApiError(400, `الحد الأقصى هو ${MAX_SCAN_PAGES} صفحات`);
  }
  const badFiles = validateUploadedFiles(req.files, ['jpeg', 'png']);
  if (badFiles.length) throw new ApiError(400, 'بعض الملفات ليست صور JPEG/PNG صالحة');

  const studentRecord = await prisma.student.findFirst({
    where: { accountUserId: req.user.id },
    include: { class: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } } }
  });
  if (!studentRecord) throw new ApiError(404, 'التلميذ غير موجود');

  const classSubject = await prisma.classSubject.findFirst({
    where: { classId: studentRecord.classId, subject }
  });
  const teacherId = classSubject?.teacherId || studentRecord.class?.teacherId || null;

  try {
    const pdf = await mergeImagesToPdf(req.files.map((f) => f.path));

    const datePart = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizePart(studentRecord.firstName)}_${sanitizePart(studentRecord.lastName)}_${sanitizePart(SUBJECT_LABELS[subject] || subject)}_${sanitizePart(examTitle)}_${datePart}.pdf`;

    const record = await prisma.submittedExam.create({
      data: {
        studentId: req.user.id,
        teacherId,
        classId: studentRecord.classId,
        subject,
        examTitle: String(examTitle).trim(),
        fileName,
        fileUrl: pdf.url,
        imageUrls: req.files.map((f) => `/uploads/exams/source/${f.filename}`),
        status: 'SENT'
      }
    });

    if (teacherId) {
      await notify([teacherId], {
        type: 'EXAM_SUBMITTED',
        title: 'ورقة اختبار جديدة في صندوق التصحيح',
        body: `${studentRecord.firstName} ${studentRecord.lastName} أرسل ورقة: ${examTitle} (${SUBJECT_LABELS[subject] || subject})`,
        link: '/teacher/correction'
      });
    }

    res.status(201).json({
      ...record,
      subjectLabel: SUBJECT_LABELS[record.subject] || record.subject,
      statusLabel: statusLabel(record.status)
    });
  } catch (e) {
    console.error('submit exam failed:', e);
    throw new ApiError(500, 'تعذّر إنشاء ملف PDF، يرجى المحاولة مجددا');
  }
}));

/**
 * @swagger
 * /api/teacher/student/submitted-exams:
 *   get:
 *     summary: أوراق التلميذ المرسلة
 *     tags: [submitted-exams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الأوراق
 *       403:
 *         description: هذا الفضاء مخصص للتلميذ
 */
router.get('/student/submitted-exams', studentMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') throw new ApiError(403, 'هذا الفضاء مخصص للتلميذ');
  const items = await prisma.submittedExam.findMany({
    where: { studentId: req.user.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(
    items.map((i) => ({
      ...i,
      subjectLabel: SUBJECT_LABELS[i.subject] || i.subject,
      statusLabel: statusLabel(i.status)
    }))
  );
}));

/**
 * @swagger
 * /api/teacher/submitted-exams:
 *   get:
 *     summary: صندوق تصحيح الأستاذ
 *     tags: [submitted-exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [SENT, IN_REVIEW, CORRECTED] }
 *     responses:
 *       200:
 *         description: قائمة الأوراق
 */
router.get('/submitted-exams', teacherMiddleware, validateQuery(submittedExamStatusQuerySchema), asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {
    OR: [{ teacherId: req.user.id }, { class: { teacherId: req.user.id } }]
  };
  if (status) where.status = status;

  const items = await prisma.submittedExam.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      class: { select: { id: true, name: true, level: true } }
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
  });
  res.json(
    items.map((i) => ({
      ...i,
      subjectLabel: SUBJECT_LABELS[i.subject] || i.subject,
      statusLabel: statusLabel(i.status)
    }))
  );
}));

/**
 * @swagger
 * /api/teacher/submitted-exams/{id}:
 *   get:
 *     summary: تفاصيل ورقة اختبار
 *     tags: [submitted-exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: الورقة
 *       404:
 *         description: الورقة غير موجودة
 */
router.get('/submitted-exams/:id', teacherMiddleware, validateParams(submittedExamIdParamSchema), asyncHandler(async (req, res) => {
  const item = await prisma.submittedExam.findFirst({
    where: {
      id: Number(req.params.id),
      OR: [{ teacherId: req.user.id }, { class: { teacherId: req.user.id } }]
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      class: { select: { id: true, name: true, level: true } }
    }
  });
  if (!item) throw new ApiError(404, 'الورقة غير موجودة');
  res.json({
    ...item,
    subjectLabel: SUBJECT_LABELS[item.subject] || item.subject,
    statusLabel: statusLabel(item.status)
  });
}));

/**
 * @swagger
 * /api/teacher/submitted-exams/{id}:
 *   put:
 *     summary: تصحيح ورقة اختبار
 *     tags: [submitted-exams]
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
 *               score: { type: number }
 *               feedback: { type: string }
 *               status: { type: string, enum: [SENT, IN_REVIEW, CORRECTED] }
 *     responses:
 *       200:
 *         description: تم التصحيح
 *       400:
 *         description: فشل التحقق من البيانات
 *       404:
 *         description: الورقة غير موجودة
 */
router.put('/submitted-exams/:id', teacherMiddleware, validateParams(submittedExamIdParamSchema), validateBody(submittedExamUpdateSchema), asyncHandler(async (req, res) => {
  const { score, feedback, status } = req.body;
  const item = await prisma.submittedExam.findFirst({
    where: {
      id: Number(req.params.id),
      OR: [{ teacherId: req.user.id }, { class: { teacherId: req.user.id } }]
    },
    include: { student: { select: { id: true, firstName: true, lastName: true } } }
  });
  if (!item) throw new ApiError(404, 'الورقة غير موجودة');

  const data = {};
  if (score !== undefined && score !== '') data.score = Number(score);
  if (feedback !== undefined) data.feedback = String(feedback).trim() || null;
  if (status && ['SENT', 'IN_REVIEW', 'CORRECTED'].includes(status)) data.status = status;

  const updated = await prisma.submittedExam.update({ where: { id: item.id }, data });

  if (data.status === 'CORRECTED') {
    await notify([item.studentId], {
      type: 'EXAM_CORRECTED',
      title: 'تم تصحيح ورقة اختبارك',
      body: `${SUBJECT_LABELS[item.subject] || item.subject}: ${item.examTitle} — النتيجة ${data.score ?? '—'}/20`,
      link: '/student-space/paper-exam'
    });

    const parentOfStudent = await prisma.student.findFirst({
      where: { accountUserId: item.studentId },
      select: { userId: true }
    });
    if (parentOfStudent?.userId && parentOfStudent.userId !== item.studentId) {
      await notify([parentOfStudent.userId], {
        type: 'EXAM_CORRECTED',
        title: 'تم تصحيح ورقة اختبار ابنك',
        body: `${SUBJECT_LABELS[item.subject] || item.subject}: ${item.examTitle} — النتيجة ${data.score ?? '—'}/20`,
        link: '/parent'
      });
    }
  }

  res.json({
    ...updated,
    subjectLabel: SUBJECT_LABELS[updated.subject] || updated.subject,
    statusLabel: statusLabel(updated.status)
  });
}));

/**
 * @swagger
 * /api/teacher/lesson-submissions:
 *   get:
 *     summary: قائمة إرسالات الدروس التفاعلية للتصحيح
 *     tags: [submitted-exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [SUBMITTED, IN_REVIEW, GRADED, RETURNED] }
 *     responses:
 *       200:
 *         description: قائمة الإرسالات
 */
router.get('/lesson-submissions', teacherMiddleware, asyncHandler(async (req, res) => {
  const { status } = req.query;
  // Teacher sees submissions from students enrolled in their own classes.
  const myClasses = await prisma.class.findMany({
    where: { teacherId: req.user.id },
    select: { id: true }
  });
  const myStudents = await prisma.student.findMany({
    where: { classId: { in: myClasses.map((c) => c.id) }, NOT: { accountUserId: null } },
    select: { accountUserId: true, firstName: true, lastName: true, classId: true }
  });
  const byAccount = new Map(myStudents.map((s) => [s.accountUserId, s]));
  const where = { userId: { in: [...byAccount.keys()] } };
  if (status) where.status = status;

  const items = await prisma.lessonSubmission.findMany({
    where,
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }]
  });
  res.json(
    items.map((i) => ({
      ...i,
      student: i.user,
      classId: byAccount.get(i.userId)?.classId ?? null,
      statusLabel: i.status
    }))
  );
}));

/**
 * @swagger
 * /api/teacher/lesson-submissions/{id}:
 *   put:
 *     summary: تصحيح إرسال درس تفاعلي
 *     tags: [submitted-exams]
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
 *               score: { type: number }
 *               feedback: { type: string }
 *               status: { type: string, enum: [SUBMITTED, IN_REVIEW, GRADED, RETURNED] }
 *     responses:
 *       200:
 *         description: تم التصحيح
 *       400:
 *         description: فشل التحقق من البيانات
 *       404:
 *         description: الإرسال غير موجود
 */
router.put('/lesson-submissions/:id', teacherMiddleware, asyncHandler(async (req, res) => {
  const { score, feedback, status } = req.body;
  const item = await prisma.lessonSubmission.findFirst({
    where: { id: Number(req.params.id) }
  });
  if (!item) throw new ApiError(404, 'الإرسال غير موجود');
  // Ownership: the submitting user must be a student in one of my classes.
  const ownerStudent = await prisma.student.findFirst({
    where: { accountUserId: item.userId, class: { teacherId: req.user.id } },
    select: { id: true }
  });
  if (!ownerStudent) throw new ApiError(404, 'الإرسال غير موجود');

  const data = {};
  if (score !== undefined && score !== '') data.grade = Number(score);
  if (feedback !== undefined) data.feedback = String(feedback).trim() || null;
  if (status && ['SUBMITTED', 'IN_REVIEW', 'GRADED', 'RETURNED'].includes(status)) data.status = status;

  const updated = await prisma.lessonSubmission.update({ where: { id: item.id }, data });

  if (data.status === 'GRADED') {
    await notify([item.userId], {
      type: 'LESSON_GRADED',
      title: 'تم تصحيح واجبك التفاعلي',
      body: `${item.lessonTitle || 'الدرس'} — النتيجة ${data.grade ?? '—'}/20`,
      link: '/student-space/lessons'
    });

    const parentOfStudent = await prisma.student.findFirst({
      where: { accountUserId: item.userId },
      select: { userId: true }
    });
    if (parentOfStudent?.userId && parentOfStudent.userId !== item.userId) {
      await notify([parentOfStudent.userId], {
        type: 'LESSON_GRADED',
        title: 'تم تصحيح واجب ابنك التفاعلي',
        body: `${item.lessonTitle || 'الدرس'} — النتيجة ${data.grade ?? '—'}/20`,
        link: '/parent'
      });
    }
  }

  res.json({
    ...updated
  });
}));

export default router;
