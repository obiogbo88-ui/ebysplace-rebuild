-- Eby's Place automatic Instagram + Facebook posting (server/social/*).
-- The app also creates these at runtime (server/social/store.ts requireDb).
CREATE TABLE IF NOT EXISTS "socialPosts" (
  "id" SERIAL PRIMARY KEY,
  "slotDate" VARCHAR(10) NOT NULL,
  "slot" VARCHAR(2) NOT NULL CHECK ("slot" IN ('am','pm')),
  "kind" VARCHAR(20) NOT NULL CHECK ("kind" IN ('motivation','style','inspiration','article')),
  "sourceRef" VARCHAR(160),
  "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "slides" JSONB NOT NULL,
  "caption" TEXT NOT NULL,
  "imageUrls" JSONB NOT NULL,
  "storyUrl" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ready',
  "igMediaId" VARCHAR(64),
  "igStoryId" VARCHAR(64),
  "fbPostId" VARCHAR(96),
  "fbStoryId" VARCHAR(96),
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "postedAt" TIMESTAMPTZ,
  UNIQUE ("slotDate", "slot")
);
CREATE TABLE IF NOT EXISTS "socialTokens" (
  "platform" VARCHAR(40) PRIMARY KEY,
  "token" TEXT NOT NULL,
  "refreshedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ
);
ALTER TABLE "socialPosts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "socialTokens" ENABLE ROW LEVEL SECURITY;
