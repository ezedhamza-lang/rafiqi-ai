-- R2c: سياسة استرجاع واحد لكل فاتورة على مستوى قاعدة البيانات
-- (كان القيد برمجياً فقط؛ أي مسار مستقبلي كان يستطيع تكرار الاسترجاع)

-- 1) تنظيف أي تكرار قائم (نُبقي الأقدم لكل فاتورة)
DELETE FROM "Refund" r
 WHERE EXISTS (
   SELECT 1 FROM "Refund" r2
    WHERE r2."invoiceId" = r."invoiceId"
      AND (r2."refundedAt" < r."refundedAt" OR (r2."refundedAt" = r."refundedAt" AND r2."id" < r."id"))
 );

-- 2) الفهرس العادي ⇒ فريد (اسم Prisma لـ @@unique([invoiceId]))
DROP INDEX IF EXISTS "Refund_invoiceId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_invoiceId_key" ON "Refund"("invoiceId");
