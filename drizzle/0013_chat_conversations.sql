-- Website chat conversations with the Eby assistant, with optional visitor
-- contact details so the team can follow up. Safe to re-run.

CREATE TABLE IF NOT EXISTS "chatConversations" (
  "id" serial PRIMARY KEY NOT NULL,
  "conversationKey" varchar(64) NOT NULL UNIQUE,
  "name" varchar(180),
  "email" varchar(320),
  "phone" varchar(80),
  "transcript" json NOT NULL,
  "messageCount" integer DEFAULT 0 NOT NULL,
  "wantsHuman" "true_false_enum" DEFAULT 'false' NOT NULL,
  "status" varchar(20) DEFAULT 'new' NOT NULL,
  "notifiedLevel" integer DEFAULT 0 NOT NULL,
  "pageUrl" varchar(500),
  "city" varchar(120),
  "country" varchar(120),
  "deviceType" varchar(40),
  "browser" varchar(60),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Holds visitor names, emails and phone numbers: block direct access through
-- the public Supabase API. The server connects with the database owner role,
-- which is unaffected by RLS.
ALTER TABLE "chatConversations" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "chatConversations_status_updatedAt_idx" ON "chatConversations" ("status", "updatedAt" DESC);
