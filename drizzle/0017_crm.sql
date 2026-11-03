-- Eby's Place CRM (2026-11-03). The server also creates these at runtime
-- (server/crm/store.ts); this file mirrors them for the record.
-- RLS on with no policies: only the server (postgres role) can read them.

CREATE TABLE IF NOT EXISTS "crmClientNotes" (
  "clientKey" VARCHAR(340) PRIMARY KEY,
  "body" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "crmClientTags" (
  "clientKey" VARCHAR(340) NOT NULL,
  "tag" VARCHAR(60) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("clientKey", "tag")
);

CREATE TABLE IF NOT EXISTS "crmClientPrefs" (
  "clientKey" VARCHAR(340) NOT NULL,
  "automation" VARCHAR(40) NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("clientKey", "automation")
);

CREATE TABLE IF NOT EXISTS "crmAutomationSettings" (
  "key" VARCHAR(40) PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "crmAutomationSends" (
  "id" SERIAL PRIMARY KEY,
  "automation" VARCHAR(40) NOT NULL,
  "clientKey" VARCHAR(340) NOT NULL,
  "refId" VARCHAR(120) NOT NULL,
  "channel" VARCHAR(20) NOT NULL,
  "sentAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("automation", "refId")
);

ALTER TABLE "crmClientNotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crmClientTags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crmClientPrefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crmAutomationSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crmAutomationSends" ENABLE ROW LEVEL SECURITY;
