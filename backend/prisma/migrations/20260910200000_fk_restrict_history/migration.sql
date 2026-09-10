-- R2d: سجلات مالية/أكاديمية لا تُمحى عرضاً — Cascade ⇒ Restrict
-- (لا مسار API يحذف Payment أو Class اليوم؛ القيد يحمي من أي خطأ يدوي/مستقبلي)

-- 1) Invoice.paymentId : Cascade -> Restrict
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_paymentId_fkey') THEN
    ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_paymentId_fkey";
  END IF;
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;

-- 2) AttendanceRecord.classId : Cascade -> Restrict
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_classId_fkey') THEN
    ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_classId_fkey";
  END IF;
  ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;
