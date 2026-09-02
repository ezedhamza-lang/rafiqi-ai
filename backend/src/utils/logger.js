// وحدة تسجيل موحّدة — ترقية (28-08-2026)
//
// قبل هذا الملف كانت المنصة تستعمل console.log/console.error متفرقة عبر
// 13 ملفاً + morgan لتسجيل HTTP بصيغة نصية بسيطة. المشكلة: لا يوجد شكل
// موحّد (JSON) يمكن ربطه لاحقاً بخدمة مراقبة (Sentry/Grafana/Loki)، ولا
// تمييز لمستوى الخطورة (info/warn/error) بشكل قابل للفلترة برمجياً.
//
// الحل: pino — مكتبة تسجيل خفيفة وسريعة جداً (لا تُبطئ الطلبات)، تُخرج
// JSON منظّم في الإنتاج، وسطراً ملوّناً مقروءاً في التطوير المحلي.
import pino from 'pino';
import { config } from '../config.js';

const isDev = (config.nodeEnv || process.env.NODE_ENV || 'development') !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
      }
    : undefined,
  // لا نسجّل أبداً كلمات السر/الرموز حتى بالغلط عبر req.body
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'pin',
      'token',
      'secret',
      '*.password',
      '*.pin',
      '*.token',
      '*.secret'
    ],
    remove: true
  }
});

export default logger;
