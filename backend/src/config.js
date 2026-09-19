const required = (name) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 500),
  // إصلاح أمني: مصادر CORS المسموحة. القيمة الافتراضية تغطي أدوات التطوير
  // المحلية فقط (Vite على 5173 يمرّر كل الطلبات عبر بروكسي، فلا يحتاج
  // المتصفح مصدراً آخر). في الإنتاج، عرّف ALLOWED_ORIGINS في .env بقائمة
  // مفصولة بفواصل تضم دومين الواجهة الفعلي (مثلاً:
  // "https://rafiqi-app.tn,https://www.rafiqi-app.tn").
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  bodyLimit: process.env.BODY_LIMIT || '5mb',
  // Base URL publique du frontend (dev : http://localhost:5173).
  // En production le frontend est servi par le backend (même origine) :
  // on utilise alors une redirection relative, pas cette valeur.
  appUrl: (process.env.APP_URL || '').replace(/\/$/, ''),
  // حسابات تجريبية ترى محتوى كل السنوات (لا تُتتبّع بها المنصة).
  exploreAllGradesEmails: (process.env.EXPLORE_ALL_GRADES_EMAILS || 'student@test.tn')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  payment: {
    defaultProvider: process.env.PAYMENT_PROVIDER || 'DEMO',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    stbMerchantId: process.env.STB_MERCHANT_ID || '',
    stbSecret: process.env.STB_SECRET || '',
    demoWebhookSecret: process.env.DEMO_WEBHOOK_SECRET || '',
    // PayPal (دولي). webhookId إلزامي للتحقق الحقيقي من توقيع الأحداث عبر
    // /v1/notifications/verify-webhook-signature — بدونه تُرفض كل الأحداث.
    paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
    paypalSecret: process.env.PAYPAL_SECRET || '',
    paypalMode: process.env.PAYPAL_MODE || 'sandbox',
    paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || '',
    // المزود التجريبي DEMO مسموح في التطوير/الاختبار فقط. في الإنتاج يجب
    // إما ضبط مزود حقيقي أو تعيين ALLOW_DEMO_PAYMENTS=true صراحةً (للعروض).
    allowDemoPayments: process.env.ALLOW_DEMO_PAYMENTS === 'true',
    currency: process.env.PAYMENT_CURRENCY || 'TND',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
    captchaTtlMs: Number(process.env.CAPTCHA_TTL_MS || 10 * 60 * 1000),
    revealCaptchaAnswer: process.env.CAPTCHA_REVEAL_ANSWER === 'true'
  },
  video: {
    provider: (process.env.VIDEO_PROVIDER || 'LOCAL').toUpperCase(),
    livekitUrl: process.env.LIVEKIT_URL || '',
    livekitApiKey: process.env.LIVEKIT_API_KEY || '',
    livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
    recordingDir: process.env.RECORDING_DIR || 'uploads/recordings'
  },
  // Google OAuth sign-in (bouton « Continuer avec Google »).
  // Vide = désactivé (le frontend masque le bouton, l'API répond 501).
  googleClientId: process.env.GOOGLE_CLIENT_ID || ''
};
