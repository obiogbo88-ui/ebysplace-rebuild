-- Supabase / PostgreSQL production repairs for services checkout compatibility
-- and order item image snapshots. Safe to run manually in the Supabase SQL editor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_category_enum') THEN
    CREATE TYPE "service_category_enum" AS ENUM ('Braids', 'Twists', 'Locs', 'Kids Styles', 'Men Styles', 'Add-ons');
  END IF;
END $$;

DO $$
DECLARE
  enum_value text;
BEGIN
  FOREACH enum_value IN ARRAY ARRAY['Braids', 'Twists', 'Locs', 'Kids Styles', 'Men Styles', 'Add-ons']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'service_category_enum' AND e.enumlabel = enum_value
    ) THEN
      EXECUTE format('ALTER TYPE "service_category_enum" ADD VALUE %L', enum_value);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'true_false_enum') THEN
    CREATE TYPE "true_false_enum" AS ENUM ('true', 'false');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.services') IS NULL THEN
    RAISE EXCEPTION 'Expected table public.services does not exist.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'price_from')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'priceFrom') THEN
    EXECUTE 'ALTER TABLE public.services RENAME COLUMN price_from TO "priceFrom"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'image_url')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'imageUrl') THEN
    EXECUTE 'ALTER TABLE public.services RENAME COLUMN image_url TO "imageUrl"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'is_bookable')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'isBookable') THEN
    EXECUTE 'ALTER TABLE public.services RENAME COLUMN is_bookable TO "isBookable"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'is_featured')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'isFeatured') THEN
    EXECUTE 'ALTER TABLE public.services RENAME COLUMN is_featured TO "isFeatured"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'sort_order')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'sortOrder') THEN
    EXECUTE 'ALTER TABLE public.services RENAME COLUMN sort_order TO "sortOrder"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'createdAt') THEN
    EXECUTE 'ALTER TABLE public.services RENAME COLUMN created_at TO "createdAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'updated_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'updatedAt') THEN
    EXECUTE 'ALTER TABLE public.services RENAME COLUMN updated_at TO "updatedAt"';
  END IF;
END $$;

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "duration" varchar(80);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "priceFrom" numeric(10, 2);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "badge" varchar(80);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "imageUrl" varchar(800);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "isBookable" "true_false_enum" NOT NULL DEFAULT 'true';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "isFeatured" "true_false_enum" NOT NULL DEFAULT 'false';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT now();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();

UPDATE public.services SET "duration" = COALESCE(NULLIF("duration"::text, ''), 'Unknown duration');
UPDATE public.services SET "priceFrom" = COALESCE("priceFrom", 0);
UPDATE public.services SET "isBookable" = COALESCE("isBookable", 'true');
UPDATE public.services SET "isFeatured" = COALESCE("isFeatured", 'false');
UPDATE public.services SET "sortOrder" = COALESCE("sortOrder", 0);

ALTER TABLE public.services
  ALTER COLUMN "duration" TYPE varchar(80) USING "duration"::text,
  ALTER COLUMN "duration" SET NOT NULL,
  ALTER COLUMN "priceFrom" TYPE numeric(10, 2) USING "priceFrom"::numeric,
  ALTER COLUMN "priceFrom" SET NOT NULL,
  ALTER COLUMN "isBookable" TYPE "true_false_enum" USING CASE WHEN "isBookable"::text IN ('true', 'false') THEN "isBookable"::text::"true_false_enum" ELSE 'true'::"true_false_enum" END,
  ALTER COLUMN "isBookable" SET NOT NULL,
  ALTER COLUMN "isBookable" SET DEFAULT 'true',
  ALTER COLUMN "isFeatured" TYPE "true_false_enum" USING CASE WHEN "isFeatured"::text IN ('true', 'false') THEN "isFeatured"::text::"true_false_enum" ELSE 'false'::"true_false_enum" END,
  ALTER COLUMN "isFeatured" SET NOT NULL,
  ALTER COLUMN "isFeatured" SET DEFAULT 'false',
  ALTER COLUMN "sortOrder" TYPE integer USING COALESCE("sortOrder"::integer, 0),
  ALTER COLUMN "sortOrder" SET NOT NULL,
  ALTER COLUMN "sortOrder" SET DEFAULT 0,
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" SET DEFAULT now();

ALTER TABLE public.services
  ALTER COLUMN "category" TYPE varchar(120) USING "category"::text;

CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique ON public.services ("slug");

ALTER TABLE public."orderItems" ADD COLUMN IF NOT EXISTS "imageUrl" varchar(800);
