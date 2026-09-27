-- توحيد مزوّدي الدفع: السجل البرمجي (provider.js) يدعم 6 مزوّدات
-- (DEMO, STRIPE, STB, PAYPAL, PAYMOB, TAP) بينما enum في قاعدة البيانات
-- كان يسمح بـ3 فقط، فيفشل حفظ أي نيّة دفع عبر PayPal أو Paymob أو Tap.
-- ملاحظة: VALUES جديدة لا تُستعمل في نفس المعاملة، لذا ALTER TYPE منفصل لكل قيمة.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'PAYPAL';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'PAYMOB';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'TAP';
