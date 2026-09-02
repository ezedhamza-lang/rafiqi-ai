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
    .filter(Boolean)
    // في الإنتاج تُقدَّم الواجهة والـAPI من نفس النطاق (Render)، لذا نسمح
    // برابط المنصة تلقائياً حتى لا تُرفض طلبات نفس الأصل عبر CORS.
    .concat(process.env.NODE_ENV === 'production' ? ['https://rafiqi-platform.onrender.com', 'https://www.rafiqi-platform.onrender.com'] : []),
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
    revealCaptchaAnswer: process.env.CAPTCHA_REVEAL_ANSWER === 'true',
    // إصلاح (27-08-2026): مفاتيح PayPal/Paymob/Tap كانت مستعملة فعلاً في
    // مزوّدات الدفع الثلاثة (services/payments/{paypal,paymob,tap}Provider.js)
    // لكن لم تكن مربوطة هنا بمتغيرات البيئة إطلاقاً — أي أن هذه البوابات
    // الثلاث كانت تبقى "غير مضبوطة" (isConfigured() = false) مهما وضع
    // المستخدم القيم في .env. راجع PENDING_FIXES.md لتفاصيل الإصلاح.
    paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
    paypalSecret: process.env.PAYPAL_SECRET || '',
    paypalMode: process.env.PAYPAL_MODE || 'sandbox',
    paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || '',
    paymobApiKey: process.env.PAYMOB_API_KEY || '',
    paymobIntegrationId: process.env.PAYMOB_INTEGRATION_ID || '',
    paymobKioskIntegrationId: process.env.PAYMOB_KIOSK_INTEGRATION_ID || '',
    paymobWalletIntegrationId: process.env.PAYMOB_WALLET_INTEGRATION_ID || '',
    paymobVodafoneId: process.env.PAYMOB_VODAFONE_ID || '',
    paymobEtisalatId: process.env.PAYMOB_ETISALAT_ID || '',
    paymobOrangeId: process.env.PAYMOB_ORANGE_ID || '',
    paymobWeId: process.env.PAYMOB_WE_ID || '',
    paymobHmacSecret: process.env.PAYMOB_HMAC_SECRET || '',
    paymobMode: process.env.PAYMOB_MODE || 'test',
    paymobUseIframe: process.env.PAYMOB_USE_IFRAME !== 'false',
    tapSecretKey: process.env.TAP_SECRET_KEY || '',
    tapPublicKey: process.env.TAP_PUBLIC_KEY || '',
    tapWebhookSecret: process.env.TAP_WEBHOOK_SECRET || '',
    tapMode: process.env.TAP_MODE || 'test',
    tapUseInvoice: process.env.TAP_USE_INVOICE !== 'false'
  },
  video: {
    provider: (process.env.VIDEO_PROVIDER || 'LOCAL').toUpperCase(),
    // تسجيل الحصص معطَّل بقرار المستخدم — لا تُخزَّن صوتيات في المنصة.
    // لإعادة التفعيل مستقبلاً: RECORDING_ENABLED=true في .env
    recordingEnabled: process.env.RECORDING_ENABLED === 'true',
    livekitUrl: process.env.LIVEKIT_URL || '',
    livekitApiKey: process.env.LIVEKIT_API_KEY || '',
    livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
    recordingDir: process.env.RECORDING_DIR || 'uploads/recordings'
  },
  // البريد الإلكتروني — بلا SMTP تعمل الميزات في وضع السجل المحلي (tmp-mail.log)
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'رفيقي <no-reply@rafiqi.tn>'
  }
};
