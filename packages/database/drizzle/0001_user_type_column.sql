-- Add user_type column to users (nullable first for data migration)
ALTER TABLE "users" ADD COLUMN "user_type" text;
--> statement-breakpoint

-- Migrate data from user_user_types to users.user_type (pick first type per user)
UPDATE "users" SET "user_type" = (
  SELECT "user_type" FROM "user_user_types"
  WHERE "user_user_types"."user_id" = "users"."id"
  LIMIT 1
);
--> statement-breakpoint

-- Set NOT NULL constraint after data migration
ALTER TABLE "users" ALTER COLUMN "user_type" SET NOT NULL;
--> statement-breakpoint

-- Drop user_user_types table
DROP TABLE "user_user_types";
