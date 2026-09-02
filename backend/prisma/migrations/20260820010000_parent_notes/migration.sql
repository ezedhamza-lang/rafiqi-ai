-- ParentNote: ملاحظات الأولياء لأساتذة أبنائهم (قناة تواصل مباشرة)
CREATE TABLE "ParentNote" (
  "id" SERIAL NOT NULL,
  "parentId" INTEGER NOT NULL,
  "studentId" INTEGER NOT NULL,
  "teacherId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "reply" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParentNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentNote_teacherId_readAt_idx" ON "ParentNote"("teacherId", "readAt");
CREATE INDEX "ParentNote_studentId_idx" ON "ParentNote"("studentId");

ALTER TABLE "ParentNote" ADD CONSTRAINT "ParentNote_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentNote" ADD CONSTRAINT "ParentNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentNote" ADD CONSTRAINT "ParentNote_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;