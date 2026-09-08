-- تحويل الأعمدة المالية من Float (double precision) إلى Decimal(12,3) لدقّة مالية صحيحة.
-- الهجرة idempotent: لا تُنفّذ أي تحويل إذا كان العمود decimal أصلاً، ولا تحذف أي جدول.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Subscription' AND column_name='amount' AND data_type='double precision') THEN
    ALTER TABLE "Subscription" ALTER COLUMN "amount" TYPE DECIMAL(12,3) USING ROUND("amount"::numeric, 3);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Payment' AND column_name='amount' AND data_type='double precision') THEN
    ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE DECIMAL(12,3) USING ROUND("amount"::numeric, 3);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PaymentIntent' AND column_name='amount' AND data_type='double precision') THEN
    ALTER TABLE "PaymentIntent" ALTER COLUMN "amount" TYPE DECIMAL(12,3) USING ROUND("amount"::numeric, 3);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Refund' AND column_name='amount' AND data_type='double precision') THEN
    ALTER TABLE "Refund" ALTER COLUMN "amount" TYPE DECIMAL(12,3) USING ROUND("amount"::numeric, 3);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Invoice' AND column_name='amount' AND data_type='double precision') THEN
    ALTER TABLE "Invoice" ALTER COLUMN "amount" TYPE DECIMAL(12,3) USING ROUND("amount"::numeric, 3);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Invoice' AND column_name='discountAmount' AND data_type='double precision') THEN
    ALTER TABLE "Invoice" ALTER COLUMN "discountAmount" TYPE DECIMAL(12,3) USING ROUND("discountAmount"::numeric, 3);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Invoice' AND column_name='taxAmount' AND data_type='double precision') THEN
    ALTER TABLE "Invoice" ALTER COLUMN "taxAmount" TYPE DECIMAL(12,3) USING ROUND("taxAmount"::numeric, 3);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Invoice' AND column_name='total' AND data_type='double precision') THEN
    ALTER TABLE "Invoice" ALTER COLUMN "total" TYPE DECIMAL(12,3) USING ROUND("total"::numeric, 3);
  END IF;
END $$;

-- إعادة ضبط القيم الافتراضية للفواتير بعد تغيير النوع (آمنة للتكرار).
ALTER TABLE "Invoice" ALTER COLUMN "discountAmount" SET DEFAULT 0;
ALTER TABLE "Invoice" ALTER COLUMN "taxAmount" SET DEFAULT 0;
