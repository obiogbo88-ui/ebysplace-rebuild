CREATE TABLE IF NOT EXISTS "activityLogs" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "userName" VARCHAR(180),
  "userEmail" VARCHAR(320),
  "sessionId" VARCHAR(128),
  "activityType" VARCHAR(120) NOT NULL,
  "activityCategory" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "pageUrl" VARCHAR(800),
  "metadata" JSON,
  "status" VARCHAR(30) NOT NULL DEFAULT 'info',
  "ipAddress" VARCHAR(80),
  "country" VARCHAR(120),
  "city" VARCHAR(120),
  "region" VARCHAR(120),
  "deviceType" VARCHAR(40),
  "browser" VARCHAR(80),
  "userAgent" VARCHAR(500),
  "relatedEntityType" VARCHAR(80),
  "relatedEntityId" VARCHAR(120),
  "sourceApp" VARCHAR(80) NOT NULL DEFAULT 'ebysplace',
  "isRead" TEXT NOT NULL DEFAULT 'false',
  "createdAtMs" BIGINT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "activityLogs_createdAt_idx" ON "activityLogs" ("createdAt");
CREATE INDEX IF NOT EXISTS "activityLogs_category_idx" ON "activityLogs" ("activityCategory");
CREATE INDEX IF NOT EXISTS "activityLogs_type_idx" ON "activityLogs" ("activityType");
CREATE INDEX IF NOT EXISTS "activityLogs_status_idx" ON "activityLogs" ("status");
CREATE INDEX IF NOT EXISTS "activityLogs_read_idx" ON "activityLogs" ("isRead");
CREATE INDEX IF NOT EXISTS "activityLogs_source_idx" ON "activityLogs" ("sourceApp");
