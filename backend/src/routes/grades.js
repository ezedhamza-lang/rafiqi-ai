import { Router } from 'express';
import prisma from '../db.js';
import { teacherMiddleware } from '../auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { validateParams } from '../middleware/validate.js';

const classIdParam = z.object({ classId: z.coerce.number({ error: 'معرف القسم غير صالح' }).int().positive({ error: 'معرف القسم غير صالح' }) });
import { actorSchoolId } from '../tenant.js';
import { computeClassGrades, buildCertificate, PERIOD_LABELS } from '../services/gradeService.js';

const router = Router();

function validPeriod(p) {
  const v = String(p || '1');
  if (v !== 'annual' && !['1', '2', '3'].includes(v)) throw new ApiError(400, 'ثلاثي غير صالح (1 أو 2 أو 3 أو annual)');
  return v;
}

async function assertClassAccess(req, classId) {
  const sid = actorSchoolId(req);
  const where = req.user.role === 'TEACHER'
    ? { id: classId, teacherId: req.user.id }
    : { id: classId, ...(sid != null ? { schoolId: sid } : {}) };
  const klass = await prisma.class.findFirst({ where });
  if (!klass) throw new ApiError(404, 'القسم غير موجود أو لا تديره');
  return klass;
}

/** قائمة أقسام الأستاذ (للاختيار في صفحة النتائج والشهادات) */
router.get('/classes', teacherMiddleware, asyncHandler(async (req, res) => {
  const sid = actorSchoolId(req);
  const where = req.user.role === 'TEACHER'
    ? { teacherId: req.user.id }
    : (sid != null ? { schoolId: sid } : {});
  const classes = await prisma.class.findMany({
    where,
    select: { id: true, name: true, level: true, schoolYear: true },
    orderBy: [{ schoolYear: 'desc' }, { level: 'asc' }, { name: 'asc' }]
  });
  res.json(classes);
}));

/** جدول الأعداد مع المعدلات والرتب — ثلاثي أو سنوي */
router.get('/classes/:classId', teacherMiddleware, validateParams(classIdParam), asyncHandler(async (req, res) => {
  const klass = await assertClassAccess(req, Number(req.params.classId));
  const period = validPeriod(req.query.period);
  const data = await computeClassGrades(klass.id, period);
  res.json({ ...data, periods: PERIOD_LABELS });
}));

/** دفتر الأعداد PDF (قابل للطباعة A4) */
router.get('/classes/:classId/pdf', teacherMiddleware, validateParams(classIdParam), asyncHandler(async (req, res) => {
  const klass = await assertClassAccess(req, Number(req.params.classId));
  const period = validPeriod(req.query.period);
  const data = await computeClassGrades(klass.id, period);
  const { buildGradesBookPdf } = await import('../services/exportService.js');
  const buffer = await buildGradesBookPdf(data);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="grades-book-${klass.id}-${period}.pdf"`);
  res.send(buffer);
}));

/** شهادة الأعداد (JSON للمعاينة) */
router.get('/students/:studentId/classes/:classId/certificate', teacherMiddleware, asyncHandler(async (req, res) => {
  const klass = await assertClassAccess(req, Number(req.params.classId));
  const period = validPeriod(req.query.period);
  const cert = await buildCertificate(klass.id, Number(req.params.studentId), period);
  if (!cert) throw new ApiError(404, 'لا توجد بيانات لهذا التلميذ في هذا القسم');
  res.json(cert);
}));

/** شهادة الأعداد PDF */
router.get('/students/:studentId/classes/:classId/certificate/pdf', teacherMiddleware, asyncHandler(async (req, res) => {
  const klass = await assertClassAccess(req, Number(req.params.classId));
  const period = validPeriod(req.query.period);
  const cert = await buildCertificate(klass.id, Number(req.params.studentId), period);
  if (!cert) throw new ApiError(404, 'لا توجد بيانات لهذا التلميذ في هذا القسم');
  const { buildCertificatePdf } = await import('../services/exportService.js');
  const buffer = await buildCertificatePdf(cert);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="certificate-${req.params.studentId}-${period}.pdf"`);
  res.send(buffer);
}));

export default router;
