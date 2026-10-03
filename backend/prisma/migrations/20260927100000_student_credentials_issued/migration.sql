-- ============================================================================
--  إصدار بيانات دخول التلاميذ (بطاقات الدخول) — Phase C
--
--  المشكلة: البطاقة المطبوعة (بريد + كلمة سر) تصبح بلا قيمة إن أعاد الإقلاع
--  كتابة كلمة سر تلميذ لم يدخل ever (حارس tenancyBootstrap يعتمد على
--  tempPassword=null و refreshTokens فارغة). فلا يوجد أي أثر يميّز
--  «حساب جديد لم يُصدر له شيء» عن «حساب أصدر له المدير بطاقة».
--
--  الحل: عمود nullable واحد يسمّي issuance صراحةً. الإقلاع يتخطّى كل تلميذ
--  صدرت له بيانات دخول، والبطاقة تبقى صالحة ما لم يغيّرها التلميذ بنفسه.
--  Migration idempotent (نفس نمط knowledge_garden/friendships).
-- ============================================================================

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "credentialsIssuedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Student_credentialsIssuedAt_idx" ON "Student"("credentialsIssuedAt");
