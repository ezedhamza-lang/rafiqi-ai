// Optional error monitoring via Sentry.
// Strictly opt-in: does nothing unless SENTRY_DSN is set. The SDK is loaded with
// a guarded dynamic import so a missing/failed dependency can never crash boot.
let _sentry = null;
let _attempted = false;

export async function initSentry() {
  if (_attempted) return _sentry;
  _attempted = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1)
    });
    _sentry = Sentry;
    console.log('[sentry] error monitoring enabled');
  } catch (e) {
    console.error('[sentry] init skipped:', e && e.message);
    _sentry = null;
  }
  return _sentry;
}

export function captureError(err, ctx) {
  try {
    if (_sentry && err) _sentry.captureException(err, ctx);
  } catch {
    /* monitoring must never break the request path */
  }
}
