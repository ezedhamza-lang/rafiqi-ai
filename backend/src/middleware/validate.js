import { ZodError } from 'zod';

export class ValidationError extends Error {
  constructor(errors, status = 400) {
    super('فشل التحقق من البيانات');
    this.name = 'ValidationError';
    this.errors = errors;
    this.status = status;
  }
}

export function formatZodError(error) {
  if (error instanceof ZodError) {
    const issues = error.issues || error.errors || [];
    return issues.map((e) => ({
      field: (e.path || []).join('.'),
      message: e.message
    }));
  }
  return [{ field: 'unknown', message: error.message }];
}

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const data = req[source] ?? {};
    const result = schema.safeParse(data);
    if (!result.success) {
      return next(new ValidationError(formatZodError(result.error)));
    }
    req[source] = result.data;
    next();
  };
}

export const validateBody = (schema) => validate(schema, 'body');
export const validateQuery = (schema) => validate(schema, 'query');
export const validateParams = (schema) => validate(schema, 'params');

export function toInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export function optionalString(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value).trim();
}
