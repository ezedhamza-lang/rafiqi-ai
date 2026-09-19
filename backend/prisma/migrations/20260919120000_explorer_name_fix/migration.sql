-- شفاء اسم حساب الاستكشاف المكسور الترميز (أحرف ? فقط) — يجري مرة واحدة عبر ledger.
-- جراحي: لا يمسّ أسماء صحيحة ولا معدّلة عمداً.
UPDATE "User"
SET "firstName" = 'مستكشف', "lastName" = 'المنصة'
WHERE "email" = 'explorer@test.tn'
  AND ("firstName" LIKE '%?%' OR "lastName" LIKE '%?%');
