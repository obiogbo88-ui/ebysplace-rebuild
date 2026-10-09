-- Adds the Weaves service category (Weave Sew-In).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'service_category_enum' AND e.enumlabel = 'Weaves'
  ) THEN
    ALTER TYPE "service_category_enum" ADD VALUE 'Weaves' BEFORE 'Kids Styles';
  END IF;
END $$;
