-- Supabase PostgreSQL schema for the Eby’s Place project
-- Generated from the current Drizzle/MySQL schema and migrations.
-- This file is intentionally standalone and does not modify the running website database.

CREATE TYPE "user_role_enum" AS ENUM ('user', 'admin');
CREATE TYPE "true_false_enum" AS ENUM ('true', 'false');
CREATE TYPE "service_category_enum" AS ENUM ('Braids', 'Twists', 'Locs', 'Kids Styles', 'Add-ons');
CREATE TYPE "booking_status_enum" AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE "deposit_status_enum" AS ENUM ('unpaid', 'checkout_started', 'paid', 'failed', 'refunded');
CREATE TYPE "product_category_enum" AS ENUM ('Accessories', 'Aftercare', 'Hair Attachments');
CREATE TYPE "stock_status_enum" AS ENUM ('in_stock', 'low_stock', 'out_of_stock');
CREATE TYPE "order_status_enum" AS ENUM ('draft', 'pending_payment', 'paid', 'fulfilling', 'shipped', 'completed', 'cancelled');
CREATE TYPE "gallery_category_enum" AS ENUM ('Braids', 'Twists', 'Locs', 'Kids Styles', 'Behind the Chair');
CREATE TYPE "review_status_enum" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "try_on_status_enum" AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320),
  "loginMethod" VARCHAR(64),
  "role" "user_role_enum" NOT NULL DEFAULT 'user',
  "stripeCustomerId" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "websiteSections" (
  "id" SERIAL PRIMARY KEY,
  "sectionKey" VARCHAR(80) NOT NULL UNIQUE,
  "title" VARCHAR(255) NOT NULL,
  "eyebrow" VARCHAR(160),
  "body" TEXT,
  "ctaLabel" VARCHAR(120),
  "ctaHref" VARCHAR(500),
  "imageUrl" VARCHAR(800),
  "portraitImageUrl" VARCHAR(800),
  "portraitDescription" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" "true_false_enum" NOT NULL DEFAULT 'true',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "services" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(220) NOT NULL UNIQUE,
  "category" "service_category_enum" NOT NULL,
  "description" TEXT NOT NULL,
  "duration" VARCHAR(80) NOT NULL,
  "priceFrom" NUMERIC(10, 2) NOT NULL,
  "badge" VARCHAR(80),
  "imageUrl" VARCHAR(800),
  "isBookable" "true_false_enum" NOT NULL DEFAULT 'true',
  "isFeatured" "true_false_enum" NOT NULL DEFAULT 'false',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "bookings" (
  "id" SERIAL PRIMARY KEY,
  "serviceId" INTEGER REFERENCES "services"("id") ON DELETE SET NULL,
  "serviceName" VARCHAR(180) NOT NULL,
  "clientName" VARCHAR(180) NOT NULL,
  "clientEmail" VARCHAR(320) NOT NULL,
  "clientPhone" VARCHAR(80) NOT NULL,
  "addressLine1" VARCHAR(255) NOT NULL,
  "city" VARCHAR(120) NOT NULL,
  "county" VARCHAR(120),
  "postcode" VARCHAR(40) NOT NULL,
  "deliveryNote" TEXT,
  "appointmentDate" VARCHAR(20) NOT NULL,
  "appointmentTime" VARCHAR(20) NOT NULL,
  "status" "booking_status_enum" NOT NULL DEFAULT 'pending',
  "depositStatus" "deposit_status_enum" NOT NULL DEFAULT 'unpaid',
  "stripePaymentIntentId" VARCHAR(255),
  "stripeCheckoutSessionId" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "products" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(220) NOT NULL UNIQUE,
  "seoTitle" VARCHAR(255),
  "seoDescription" TEXT,
  "category" "product_category_enum" NOT NULL,
  "description" TEXT NOT NULL,
  "price" NUMERIC(10, 2) NOT NULL,
  "imageUrl" VARCHAR(800),
  "badge" VARCHAR(80),
  "stockStatus" "stock_status_enum" NOT NULL DEFAULT 'in_stock',
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" "true_false_enum" NOT NULL DEFAULT 'false',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "productVariants" (
  "id" SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "name" VARCHAR(120) NOT NULL,
  "colourHex" VARCHAR(20),
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "orders" (
  "id" SERIAL PRIMARY KEY,
  "customerName" VARCHAR(180) NOT NULL,
  "customerEmail" VARCHAR(320) NOT NULL,
  "customerPhone" VARCHAR(80),
  "addressLine1" VARCHAR(255) NOT NULL,
  "city" VARCHAR(120) NOT NULL,
  "county" VARCHAR(120),
  "postcode" VARCHAR(40) NOT NULL,
  "deliveryNote" TEXT,
  "status" "order_status_enum" NOT NULL DEFAULT 'draft',
  "stripeCheckoutSessionId" VARCHAR(255),
  "stripePaymentIntentId" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "orderItems" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "productId" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "variantId" INTEGER REFERENCES "productVariants"("id") ON DELETE SET NULL,
  "productName" VARCHAR(180) NOT NULL,
  "variantName" VARCHAR(120),
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" NUMERIC(10, 2) NOT NULL
);

CREATE TABLE "galleryImages" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(180) NOT NULL,
  "category" "gallery_category_enum" NOT NULL,
  "imageUrl" VARCHAR(800) NOT NULL,
  "altText" VARCHAR(255) NOT NULL,
  "isPublished" "true_false_enum" NOT NULL DEFAULT 'true',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "reviews" (
  "id" SERIAL PRIMARY KEY,
  "customerName" VARCHAR(180) NOT NULL,
  "rating" INTEGER NOT NULL,
  "reviewText" TEXT NOT NULL,
  "status" "review_status_enum" NOT NULL DEFAULT 'pending',
  "source" VARCHAR(80) NOT NULL DEFAULT 'website',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE TABLE "newsletterSubscribers" (
  "id" SERIAL PRIMARY KEY,
  "email" VARCHAR(320) NOT NULL UNIQUE,
  "productAlerts" "true_false_enum" NOT NULL DEFAULT 'false',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "analyticsEvents" (
  "id" SERIAL PRIMARY KEY,
  "eventName" VARCHAR(120) NOT NULL,
  "pagePath" VARCHAR(500) NOT NULL,
  "metadata" JSONB,
  "createdAtMs" BIGINT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "tryOnGenerations" (
  "id" SERIAL PRIMARY KEY,
  "styleName" VARCHAR(160) NOT NULL,
  "originalImageUrl" VARCHAR(800) NOT NULL,
  "generatedImageUrl" VARCHAR(800),
  "status" "try_on_status_enum" NOT NULL DEFAULT 'pending',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_bookings_serviceId" ON "bookings" ("serviceId");
CREATE INDEX "idx_bookings_appointment" ON "bookings" ("appointmentDate", "appointmentTime");
CREATE INDEX "idx_productVariants_productId" ON "productVariants" ("productId");
CREATE INDEX "idx_orderItems_orderId" ON "orderItems" ("orderId");
CREATE INDEX "idx_orderItems_productId" ON "orderItems" ("productId");
CREATE INDEX "idx_galleryImages_category" ON "galleryImages" ("category");
CREATE INDEX "idx_reviews_status" ON "reviews" ("status");
CREATE INDEX "idx_analyticsEvents_pagePath" ON "analyticsEvents" ("pagePath");
CREATE INDEX "idx_analyticsEvents_createdAtMs" ON "analyticsEvents" ("createdAtMs");
