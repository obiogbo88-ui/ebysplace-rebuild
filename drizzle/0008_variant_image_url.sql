-- Add imageUrl column to productVariants so each colour option can have its own product image.
-- Safe to run in the Supabase SQL editor or any compatible PostgreSQL environment.

ALTER TABLE "productVariants" ADD COLUMN IF NOT EXISTS "imageUrl" varchar(800);
