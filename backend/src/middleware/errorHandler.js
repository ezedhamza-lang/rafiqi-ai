import { AR } from './messages.js';
import { ValidationError } from './validate.js';
import { logger } from '../utils/logger.js';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function notFoundHandler(_req, _res, next) {
  next(new ApiError(404, AR.NOT_FOUND));
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  if (err instanceof ValidationError) {
    return res.status(err.status || 400).json({
      error: AR.VALIDATION_FAILED,
      errors: err.errors
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'حجم البيانات كبير جدا، يرجى تقليص الملف' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'صيغة البيانات غير صحيحة (JSON)' });
  }

  logger.error({ err }, '[UnhandledError]');
  return res.status(500).json({ error: AR.INTERNAL });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
