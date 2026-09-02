process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://school_user:school_pass@localhost:5432/school_platform_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.PORT = '3999';
process.env.CAPTCHA_REVEAL_ANSWER = 'true';
process.env.PAYMENT_PROVIDER = 'DEMO';
process.env.DEMO_WEBHOOK_SECRET = 'demo-webhook-test-secret';
