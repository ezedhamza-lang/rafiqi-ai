-- ============================================================================
--  Rafiqi · مغامرة رفيقي – حديقة المعرفة  (Knowledge Garden Adventure)
--  Server-authoritative persistence for the 3D educational adventure game.
--  Every statement is idempotent (safe to re-run on every boot).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "GardenProfile" (
  "id"              SERIAL PRIMARY KEY,
  "userId"          INTEGER NOT NULL,
  "stars"           INTEGER NOT NULL DEFAULT 0,
  "gems"            INTEGER NOT NULL DEFAULT 0,
  "keys"            INTEGER NOT NULL DEFAULT 0,
  "currentWorldId"  TEXT    NOT NULL DEFAULT 'letters-garden',
  "currentLevelId"  TEXT    NOT NULL DEFAULT 'w1-l1',
  "appearance"      JSONB   NOT NULL DEFAULT '{"cap":"graduation","glasses":"round","backpack":"none","book":"none","trail":"none","jump":"puff"}'::jsonb,
  "unlocked"        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  "totalCorrect"    INTEGER NOT NULL DEFAULT 0,
  "totalMistakes"   INTEGER NOT NULL DEFAULT 0,
  "bestScore"       INTEGER NOT NULL DEFAULT 0,
  "dailyStreak"     INTEGER NOT NULL DEFAULT 0,
  "lastDailyDay"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GardenProfile_userId_key" ON "GardenProfile"("userId");

CREATE TABLE IF NOT EXISTS "GardenLevelResult" (
  "id"          SERIAL PRIMARY KEY,
  "userId"      INTEGER     NOT NULL,
  "levelId"     TEXT        NOT NULL,
  "worldId"     TEXT        NOT NULL,
  "isBoss"      BOOLEAN     NOT NULL DEFAULT false,
  "bestScore"   INTEGER     NOT NULL DEFAULT 0,
  "stars"       INTEGER     NOT NULL DEFAULT 0,
  "bestTimeSec" INTEGER     NOT NULL DEFAULT 0,
  "bestAccuracy" FLOAT      NOT NULL DEFAULT 0,
  "attempts"    INTEGER     NOT NULL DEFAULT 0,
  "plays"       INTEGER     NOT NULL DEFAULT 0,
  "mastered"    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GardenLevelResult_userId_levelId_key" ON "GardenLevelResult"("userId", "levelId");
CREATE INDEX IF NOT EXISTS "GardenLevelResult_userId_worldId_idx" ON "GardenLevelResult"("userId", "worldId");

CREATE TABLE IF NOT EXISTS "GardenSkill" (
  "id"            SERIAL PRIMARY KEY,
  "userId"        INTEGER     NOT NULL,
  "skillId"       TEXT        NOT NULL,
  "skillType"     TEXT        NOT NULL,
  "label"         TEXT        NOT NULL,
  "mastery"       INTEGER     NOT NULL DEFAULT 0,
  "attempts"      INTEGER     NOT NULL DEFAULT 0,
  "correct"       INTEGER     NOT NULL DEFAULT 0,
  "streak"        INTEGER     NOT NULL DEFAULT 0,
  "needsPractice" BOOLEAN     NOT NULL DEFAULT true,
  "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GardenSkill_userId_skillId_key" ON "GardenSkill"("userId", "skillId");
CREATE INDEX IF NOT EXISTS "GardenSkill_userId_needsPractice_idx" ON "GardenSkill"("userId", "needsPractice");

CREATE TABLE IF NOT EXISTS "GardenBadge" (
  "id"       SERIAL PRIMARY KEY,
  "userId"   INTEGER     NOT NULL,
  "badgeKey" TEXT        NOT NULL,
  "name"     TEXT        NOT NULL,
  "icon"     TEXT        NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GardenBadge_userId_badgeKey_key" ON "GardenBadge"("userId", "badgeKey");

CREATE TABLE IF NOT EXISTS "GardenDaily" (
  "id"         SERIAL PRIMARY KEY,
  "userId"     INTEGER     NOT NULL,
  "dayKey"     TEXT        NOT NULL,
  "correct"    INTEGER     NOT NULL DEFAULT 0,
  "total"      INTEGER     NOT NULL DEFAULT 0,
  "starsAwarded" INTEGER   NOT NULL DEFAULT 0,
  "gemsAwarded"   INTEGER   NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GardenDaily_userId_dayKey_key" ON "GardenDaily"("userId", "dayKey");

CREATE TABLE IF NOT EXISTS "GardenReward" (
  "id"         SERIAL PRIMARY KEY,
  "userId"     INTEGER     NOT NULL,
  "rewardKey"  TEXT        NOT NULL,
  "kind"       TEXT        NOT NULL,
  "sourceId"   TEXT,
  "claimedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GardenReward_userId_rewardKey_key" ON "GardenReward"("userId", "rewardKey");
