-- ============================================================================
--  Rafiqi · طلبات الصداقة بين التلاميذ  (Friendship requests)
--  The `Friendship` model existed in schema.prisma but no migration ever
--  created the table, so every friendship endpoint failed (P0 / ISS-001).
--  Generated from `prisma migrate diff --to-schema-datamodel` and made
--  idempotent, so re-running on every boot is safe (same pattern as the
--  knowledge_garden migration).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Friendship" (
  "id"          TEXT        NOT NULL,
  "requesterId" INTEGER     NOT NULL,
  "addresseeId" INTEGER     NOT NULL,
  "status"      TEXT        NOT NULL DEFAULT 'PENDING',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id"),
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

CREATE INDEX IF NOT EXISTS "Friendship_addresseeId_idx" ON "Friendship"("addresseeId");
