-- Rebooking Part 4: the list and notifications. Also added at runtime
-- (server/db.ts addPgColumnIfMissing), mirrored here for the record.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "joinList" BOOLEAN;
ALTER TABLE "newsletterSubscribers" ADD COLUMN IF NOT EXISTS "source" VARCHAR(20);
ALTER TABLE "pushSubscriptions" ADD COLUMN IF NOT EXISTS "bookingId" INTEGER;
