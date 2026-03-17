-- Add optional phone field to users table (E.164 format)
ALTER TABLE "users" ADD COLUMN "phone" text;
