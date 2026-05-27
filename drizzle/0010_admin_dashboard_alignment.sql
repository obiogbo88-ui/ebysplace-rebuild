-- PostgreSQL / Supabase admin dashboard alignment repairs.
-- Safe to run in Supabase SQL editor before deploying admin dashboard fixes.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS "serviceLocation" text NOT NULL DEFAULT 'studio';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS "addressLine2" varchar(255);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS "homeServiceSurcharge" numeric(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS "checkoutSurchargeCharged" numeric(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS "checkoutTotalCharged" numeric(10,2);

DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    CREATE TABLE public.orders (
      "id" SERIAL PRIMARY KEY,
      "customerName" varchar(180) NOT NULL,
      "customerEmail" varchar(320) NOT NULL,
      "customerPhone" varchar(80),
      "serviceLocation" text NOT NULL DEFAULT 'studio',
      "addressLine1" varchar(255),
      "addressLine2" varchar(255),
      "city" varchar(120),
      "county" varchar(120),
      "postcode" varchar(40),
      "deliveryNote" text,
      "status" text NOT NULL DEFAULT 'draft',
      "checkoutTotalCharged" numeric(10,2),
      "stripeCheckoutSessionId" varchar(255),
      "stripePaymentIntentId" varchar(255),
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_name')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customerName') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN customer_name TO "customerName"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_email')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customerEmail') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN customer_email TO "customerEmail"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_phone')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customerPhone') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN customer_phone TO "customerPhone"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'service_location')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'serviceLocation') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN service_location TO "serviceLocation"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'address_line1')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'addressLine1') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN address_line1 TO "addressLine1"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'address_line2')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'addressLine2') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN address_line2 TO "addressLine2"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_note')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'deliveryNote') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN delivery_note TO "deliveryNote"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'checkout_total_charged')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'checkoutTotalCharged') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN checkout_total_charged TO "checkoutTotalCharged"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'stripe_checkout_session_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'stripeCheckoutSessionId') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN stripe_checkout_session_id TO "stripeCheckoutSessionId"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'stripe_payment_intent_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'stripePaymentIntentId') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN stripe_payment_intent_id TO "stripePaymentIntentId"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'createdAt') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN created_at TO "createdAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'updated_at')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'updatedAt') THEN
    EXECUTE 'ALTER TABLE public.orders RENAME COLUMN updated_at TO "updatedAt"';
  END IF;
END $$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "customerPhone" varchar(80);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "serviceLocation" text NOT NULL DEFAULT 'studio';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "addressLine1" varchar(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "addressLine2" varchar(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "city" varchar(120);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "county" varchar(120);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "postcode" varchar(40);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "deliveryNote" text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "checkoutTotalCharged" numeric(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" varchar(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" varchar(255);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();

ALTER TABLE public.orders ALTER COLUMN "addressLine1" DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN "postcode" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public."productReviews" (
  "id" SERIAL PRIMARY KEY,
  "productId" integer NOT NULL,
  "customerName" varchar(180) NOT NULL,
  "rating" integer NOT NULL,
  "reviewText" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "source" varchar(80) NOT NULL DEFAULT 'website',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'productReviews' AND column_name = 'product_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'productReviews' AND column_name = 'productId') THEN
    EXECUTE 'ALTER TABLE public."productReviews" RENAME COLUMN product_id TO "productId"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'productReviews' AND column_name = 'customer_name')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'productReviews' AND column_name = 'customerName') THEN
    EXECUTE 'ALTER TABLE public."productReviews" RENAME COLUMN customer_name TO "customerName"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'productReviews' AND column_name = 'review_text')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'productReviews' AND column_name = 'reviewText') THEN
    EXECUTE 'ALTER TABLE public."productReviews" RENAME COLUMN review_text TO "reviewText"';
  END IF;
END $$;
