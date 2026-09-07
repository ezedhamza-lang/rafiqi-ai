import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import prisma from './db.js';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import studentProfileRoutes from './routes/student.js';
import registrationRoutes from './routes/registrations.js';
import publicRoutes from './routes/public.js';
import helpRequestRoutes from './routes/helpRequests.js';
import adminRoutes from './routes/admin.js';
import teacherRoutes from './routes/teacher.js';
import teacherContentRoutes from './routes/teacherContent.js';
import teacherPlanRoutes from './routes/teacherPlans.js';
import aiRoutes from './routes/ai.js';
import messageRoutes from './routes/messages.js';
import directorRoutes from './routes/director.js';
import superAdminRoutes from './routes/superadmin.js';
import parentRoutes from './routes/parent.js';
import curriculumRoutes from './routes/curriculum.js';
import subscriptionRequestRoutes from './routes/subscriptionRequests.js';
import financeRoutes from './routes/finance.js';
import financialDashboardRoutes from './routes/financialDashboard.js';
import classSubjectRoutes from './routes/classSubjects.js';
import playZoneRoutes from './routes/playZone.js';
import submittedExamRoutes from './routes/submittedExams.js';
import parentDocumentRoutes from './routes/parentDocuments.js';
import attendanceRoutes from './routes/attendance.js';
import calendarRoutes from './routes/calendar.js';
import healthRoutes from './routes/health.js';
import assignmentRoutes from './routes/assignments.js';
import parentAssignmentRoutes from './routes/parentAssignments.js';
import analyticsRoutes from './routes/analytics.js';
import parentAnalyticsRoutes from './routes/parentAnalytics.js';
import parentInsightsRoutes from './routes/parentInsights.js';
import paymentRoutes from './routes/payments.js';
import liveSessionRoutes, { liveConfigRouter } from './routes/liveSessions.js';
import notificationRoutes from './routes/notifications.js';
import announcementRoutes from './routes/announcements.js';
import adaptiveRoutes from './routes/adaptive.js';
import progressRoutes from './routes/progress.js';
import studentExtrasRoutes from './routes/studentExtras.js';
import teacherExtrasRoutes from './routes/teacherExtras.js';
import { parentRouter, teacherRouter } from './routes/parentExtras.js';
import adminAiKeyRoutes from './routes/adminAiKey.js';
import adminInsightsRoutes from './routes/adminInsights.js';
import memoRoutes from './routes/memos.js';
import { setupWs } from './ws.js';
import { startRenewalScheduler, runRenewalSweep } from './services/subscriptionRenewalService.js';
import { startParentInsightScheduler, runParentInsightSweep } from './services/parentInsightNotifyService.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initSentry } from './sentry.js';
import { localeMiddleware } from './middleware/locale.js';
import { swaggerSpec } from './swagger.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const dir of ['uploads', 'uploads/documents', 'uploads/exams', 'uploads/images', 'uploads/media', 'uploads/assets/books', 'uploads/recordings']) {
  fs.mkdirSync(path.join(__dirname, '..', dir), { recursive: true });
}

const app = express();
const PORT = config.port;

// Render يعمل خلف وكيل (proxy) يضیف رأس X-Forwarded-For. بدون ھذا الإعداد
// يفشل express-rate-limit برمي ValidationError غير ملتقط على أول طلب،
// فتسقط العملية قبل أن ينجح فحص الصحة (فشل النشر + رجوع تلقائي).
app.set('trust proxy', 1);

app.use(helmet({
  // معطَّل: هذا التطبيق يخدم صوراً/فيديوهات/تسجيلات عبر نطاقات متعددة
  // (uploads, assets) وسيُصعّب COEP/CORP التحميل المتقاطع بلا فائدة أمنية
  // كبيرة هنا. باقي رؤوس Helmet (XSS، nosniff، HSTS، إلخ) مفعّلة بإعداداتها
  // الافتراضية الآمنة.
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// إصلاح أمني: كان `cors()` بلا معامل يسمح لأي موقع في العالم بقراءة
// استجابات الـAPI (مع Access-Control-Allow-Origin: *). الآن تُقيَّد
// المصادر المسموحة بالقائمة في `config.allowedOrigins` (انظر config.js).
// الطلبات بلا رأس Origin (curl، تطبيقات موبايل، خادم-لخادم) تبقى مسموحة
// دوماً لأنها ليست الهجوم الذي تحميه CORS منه أصلاً.
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`المصدر غير مسموح به عبر CORS: ${origin}`));
  },
  credentials: true
}));

// مسارات الدفع تُركَّب قبل محلل JSON العام حتى تحصل الـ Webhooks على البنية الخام (Raw Body)
// لتوقيعها والتحقق منه (Stripe Signature ...).
app.use('/api/payments', paymentRoutes);

app.use(express.json({ limit: config.bodyLimit }));

// فحص الصحة — تستعمله منصات النشر (Render healthCheckPath) — مع فحص DB خفيف
app.get(['/api/health', '/health'], async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up', uptime: Math.round(process.uptime()), at: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down', uptime: Math.round(process.uptime()), at: new Date().toISOString() });
  }
});

// Batch 4: Global locale middleware - extracts ?lang= from all requests
app.use(localeMiddleware);

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جدا، يرجى المحاولة لاحقا' }
});
// إصلاح أمني: كان تحديد معدّل الطلبات (Rate Limiting) مطبَّقاً فقط على
// /api/auth. الآن يُطبَّق حدّ عام (أوسع) على كل /api لحماية بقية المسارات
// من إغراق الخادم بالطلبات، مع حدّ أضيق وأكثر صرامة يبقى خاصاً بمسارات
// تسجيل الدخول/التسجيل (الأكثر استهدافاً في هجمات محاولة كسر كلمات السر).
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: Math.min(50, config.rateLimitMax),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جدا، يرجى المحاولة لاحقا' }
});
app.use('/api/auth', authLimiter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/student', studentProfileRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/public', curriculumRoutes);
app.use('/api/help-requests', helpRequestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/subscriptions', financeRoutes);
app.use('/api/admin/finance', financialDashboardRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/teacher', teacherContentRoutes);
app.use('/api/teacher', teacherPlanRoutes);
app.use('/api/teacher', classSubjectRoutes);
app.use('/api/teacher', playZoneRoutes);
app.use('/api/teacher', submittedExamRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/director', directorRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/parent', parentDocumentRoutes);
app.use('/api/parent', attendanceRoutes);
app.use('/api/parent', healthRoutes);
app.use('/api/parent', parentRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/director', parentDocumentRoutes);
app.use('/api/director', attendanceRoutes);
app.use('/api/director', healthRoutes);
app.use('/api/teacher', attendanceRoutes);
app.use('/api/teacher', healthRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/subscription-requests', subscriptionRequestRoutes);
app.use('/api/teacher', assignmentRoutes);
app.use('/api/parent', parentAssignmentRoutes);
app.use('/api/teacher', analyticsRoutes);
app.use('/api/student', analyticsRoutes);
app.use('/api/parent', parentAnalyticsRoutes);
app.use('/api/parent', parentInsightsRoutes);
app.use('/api/teacher', liveSessionRoutes);
app.use('/api/student', liveSessionRoutes);
app.use('/api/parent', liveSessionRoutes);
app.use('/api/live', liveConfigRouter);
app.use('/api/notifications', notificationRoutes);
app.use('/api/director/announcements', announcementRoutes);
app.use('/api/student', adaptiveRoutes);
app.use('/api/student', progressRoutes);
app.use('/api/student', studentExtrasRoutes);
app.use('/api/teacher', teacherExtrasRoutes);
app.use('/api/admin/ai', adminAiKeyRoutes);
app.use('/api/admin/insights', adminInsightsRoutes);
app.use('/api/memos', memoRoutes);

// الملفات الثابتة — مع تخزين مؤقت طويل للأصول المجزأة (hashed)
const staticOpts = { maxAge: '7d', etag: true };
const immutableOpts = {
  maxAge: '1y',
  immutable: true,
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
};
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), staticOpts));
app.use('/assets', express.static(path.join(__dirname, '../uploads/assets'), immutableOpts));
app.use('/images', express.static(path.join(__dirname, '../uploads/images'), staticOpts));
app.use('/media', express.static(path.join(__dirname, '../uploads/media'), staticOpts));
app.use('/svg', express.static(path.join(__dirname, '../uploads/svg'), staticOpts));
app.use('/islamic', express.static(path.join(__dirname, '../uploads/islamic'), staticOpts));
app.use('/tech', express.static(path.join(__dirname, '../uploads/tech'), staticOpts));
app.use('/science', express.static(path.join(__dirname, '../uploads/science'), staticOpts));
app.use('/intaj', express.static(path.join(__dirname, '../uploads/intaj'), staticOpts));
app.use('/plans', express.static(path.join(__dirname, '../content/plans'), staticOpts));

// ===== الإنتاج: تقديم الواجهة المبنية من نفس الخادم — رابط واحد للمنصة =====
const DIST = path.join(__dirname, '../../frontend/dist');
if (config.nodeEnv === 'production' && fs.existsSync(DIST)) {
  app.use(express.static(DIST, {
    maxAge: '1y',
    immutable: true,
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.includes('.')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
setupWs(server);

async function start() {
  // Error monitoring is opt-in (no-op unless SENTRY_DSN is set) and can never
  // block or crash startup.
  await initSentry();
  // STEP 1 — open the port FIRST so the hosting platform detects
  // the service immediately, even if the database is slow to wake up.
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`API server listening on http://0.0.0.0:${PORT}`);
      console.log(`Swagger docs available on http://0.0.0.0:${PORT}/api-docs`);
      resolve();
    });
  });
  // STEP 2 — database work runs AFTER the port is open.
  // Any failure here is only logged and can never crash or block startup.
  prisma.$connect()
    .then(() => prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "SubjectDistribution" (
      "id" SERIAL PRIMARY KEY,
      "classId" INTEGER NOT NULL UNIQUE,
      "grade" INTEGER NOT NULL,
      "subjects" JSONB NOT NULL,
      "timetable" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE
    )`)    .then(() => prisma.$executeRaw`ALTER TABLE "SubjectDistribution" ADD COLUMN IF NOT EXISTS "timetable" JSONB`).catch((err) => {
      console.error('SubjectDistribution table check failed:', err.message);
    })
    // LessonSubmission table (interactive lesson answers) — same pattern:
    // idempotent ensure, never crashes startup. Needed on hosts that run
    // the image without `prisma migrate deploy` (e.g. Render Dockerfile).
    .then(() => prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "LessonSubmission" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "lessonId" TEXT NOT NULL,
      "lessonTitle" TEXT,
      "answers" JSONB NOT NULL,
      "files" JSONB,
      "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
      "grade" INTEGER,
      "feedback" TEXT,
      "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "gradedAt" TIMESTAMP(3),
      "gradedBy" INTEGER,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )`).then(() => prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "LessonSubmission_userId_lessonId_idx" ON "LessonSubmission"("userId", "lessonId")`).then(() => prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "LessonSubmission_userId_status_idx" ON "LessonSubmission"("userId", "status")`).then(() => prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "LessonSubmission_status_idx" ON "LessonSubmission"("status")`).catch((err) => {
      console.error('LessonSubmission table check failed:', err.message);
    })
    .then(() => runRenewalSweep().catch((err) => {
      console.error('initial renewal sweep failed:', err.message);
    }))
    .then(() => runParentInsightSweep().catch((err) => {
      console.error('initial parent insight sweep failed:', err.message);
    }))
    .then(() => {
      startRenewalScheduler();
      startParentInsightScheduler();
    })
    .catch((err) => {
      console.error('background startup tasks failed:', err.message);
    });
}

if (config.nodeEnv !== 'test') {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app, server, start };
