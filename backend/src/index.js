import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import pinoHttp from 'pino-http';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import prisma from './db.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
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
import teacherCopilotRoutes from './routes/teacherCopilot.js';
import learningIntelligenceRoutes from './routes/learningIntelligence.js';
import assessmentVariantsRoutes from './routes/assessmentVariants.js';
import digitalTwinRoutes from './routes/digitalTwin.js';
import { setupWs } from './ws.js';
import { startRenewalScheduler, runRenewalSweep } from './services/subscriptionRenewalService.js';
import { startParentInsightScheduler, runParentInsightSweep } from './services/parentInsightNotifyService.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { localeMiddleware } from './middleware/locale.js';
import { swaggerSpec } from './swagger.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const dir of ['uploads', 'uploads/documents', 'uploads/exams', 'uploads/images', 'uploads/media', 'uploads/assets/books', 'uploads/recordings']) {
  fs.mkdirSync(path.join(__dirname, '..', dir), { recursive: true });
}

const app = express();
const PORT = config.port;

app.use(helmet({
  // معطَّل: هذا التطبيق يخدم صوراً/فيديوهات/تسجيلات عبر نطاقات متعددة
  // (uploads, assets) وسيُصعّب COEP/CORP التحميل المتقاطع بلا فائدة أمنية
  // كبيرة هنا. باقي رؤوس Helmet (XSS، nosniff، HSTS، إلخ) مفعّلة بإعداداتها
  // الافتراضية الآمنة.
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // الواجهة تستخدم سكربتات وأنماط مضمَّنة (تهيئة الثيم/اللغة، إخفاء شاشة
  // التحميل، إلخ) بالإضافة إلى خطوط Google. نسمح بها صراحةً حتى لا تُحظر
  // شاشة التحميل وتبقى عالقة.
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://*.onrender.com", "https://fonts.googleapis.com", "wss:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://www.google.com"],
      mediaSrc: ["'self'", "blob:", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));

// حل جذري لـCORS: تطبيق أحادي النطاق (الواجهة + الـAPI معاً).
// نسمح تلقائياً بأي طلب من نفس النطاق (مهما كان الدومين) إضافةً للقائمة
// الصريحة في config.allowedOrigins. هذا يمنع انكسار CORS عند تغيير النطاق
// أو رفع المنصة لمستضيف جديد دون تعديل الإعدادات.
function configureCors() {
  const allowed = config.allowedOrigins;
  return (req, res, next) => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    let allow = false;
    if (!origin) {
      allow = true; // طلبات بلا Origin (curl، موبايل، خادم-لخادم)
    } else if (allowed.includes(origin)) {
      allow = true;
    } else if (host) {
      try { if (new URL(origin).host === host) allow = true; } catch { /* تجاهل */ }
    }
    if (allow && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      return res.status(204).end();
    }
    next();
  };
}
app.use(configureCors());

// مسارات الدفع تُركَّب قبل محلل JSON العام حتى تحصل الـ Webhooks على البنية الخام (Raw Body)
// لتوقيعها والتحقق منه (Stripe Signature ...).
app.use('/api/payments', paymentRoutes);

// ضغط الاستجابات (gzip/brotli) — قبل JSON والـ static لتقليل حجم كل الاستجابات
app.use(compression());

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

// سجل طلبات HTTP — JSON منظّم عبر pino-http (كان morgan بصيغة نصية بسيطة)
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health' || req.url === '/health'
  },
  customProps: (req) => ({ userEmail: req.user?.email })
}));

// Batch 4: Global locale middleware - extracts ?lang= from all requests
app.use(localeMiddleware);

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جدا، يرجى المحاولة لاحقا' },
  // لا نحسب مسارات المصادقة مرتين — لها حد منفصل أضيق أدناه
  skip: (req) => req.path.startsWith('/auth/')
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

// Swagger — في الإنتاج محمي بـ basicAuth (SWAGGER_USER/PASS)، في التطوير مفتوح
function swaggerBasicAuth(req, res, next) {
  if (config.nodeEnv !== 'production') return next();
  const user = process.env.SWAGGER_USER;
  const pass = process.env.SWAGGER_PASS;
  if (!user || !pass) return res.status(404).send('معطّل في الإنتاج — عرّف SWAGGER_USER/PASS');
  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme === 'Basic' && encoded) {
    try {
      const [u, p] = Buffer.from(encoded, 'base64').toString().split(':');
      if (u === user && p === pass) return next();
    } catch {}
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="API Docs"');
  return res.status(401).send('مصادقة مطلوبة');
}
app.use('/api-docs', swaggerBasicAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
// المسارات المشتركة (attendance/health/parentDocuments) تُركَّب لكل دور يحتاجها — سلوك مقصود لتمكين نفس الخدمة لأدوار متعددة
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
app.use('/api/teacher', teacherCopilotRoutes);
app.use('/api/student', learningIntelligenceRoutes);
app.use('/api/teacher', learningIntelligenceRoutes);
app.use('/api/teacher', assessmentVariantsRoutes);
app.use('/api', digitalTwinRoutes);

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
const DIST = path.join(__dirname, '../frontend/dist');
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
  await prisma.$connect();
  await runRenewalSweep().catch((err) => {
    logger.error({ err }, 'initial renewal sweep failed');
  });
  await runParentInsightSweep().catch((err) => {
    logger.error({ err }, 'initial parent insight sweep failed');
  });
  startRenewalScheduler();
  startParentInsightScheduler();
  server.listen(PORT, () => {
    logger.info(`API server listening on http://localhost:${PORT}`);
    logger.info(`Swagger docs available on http://localhost:${PORT}/api-docs`);
  });
}

if (config.nodeEnv !== 'test') {
  start().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  });
}

export { app, server, start };
