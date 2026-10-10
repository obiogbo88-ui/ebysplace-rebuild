-- Adds the Crochet service category (Blonde Goddess Crochet).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'service_category_enum' AND e.enumlabel = 'Crochet'
  ) THEN
    ALTER TYPE "service_category_enum" ADD VALUE 'Crochet' BEFORE 'Kids Styles';
  END IF;
END $$;
