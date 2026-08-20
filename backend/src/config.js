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
  payment: {
    defaultProvider: process.env.PAYMENT_PROVIDER || 'DEMO',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    stbMerchantId: process.env.STB_MERCHANT_ID || '',
    stbSecret: process.env.STB_SECRET || '',
    demoWebhookSecret: process.env.DEMO_WEBHOOK_SECRET || '',
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
  }
};
