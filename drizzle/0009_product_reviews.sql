-- Add productReviews table so customers can leave reviews on individual shop products.
-- Safe to run in the Supabase SQL editor or any compatible PostgreSQL environment.

CREATE TABLE IF NOT EXISTS "productReviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "productId" integer NOT NULL,
  "customerName" varchar(180) NOT NULL,
  "rating" integer NOT NULL,
  "reviewText" text NOT NULL,
  "status" "review_status_enum" DEFAULT 'pending' NOT NULL,
  "source" varchar(80) DEFAULT 'website' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
