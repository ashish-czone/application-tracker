-- Add source and referredBy columns to applications
ALTER TABLE "applications" ADD COLUMN "source" text;
ALTER TABLE "applications" ADD COLUMN "referred_by" text REFERENCES "users"("id");
