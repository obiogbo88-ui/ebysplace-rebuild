-- Add tryOnAccounts table for AI Try-On free-trial tracking and paid credit balances.
-- Safe to run in the Supabase SQL editor or any compatible PostgreSQL environment.

CREATE TABLE IF NOT EXISTS "tryOnAccounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(320) NOT NULL,
  "phone" varchar(80),
  "freeTrialUsed" "true_false_enum" DEFAULT 'false' NOT NULL,
  "creditsRemaining" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
