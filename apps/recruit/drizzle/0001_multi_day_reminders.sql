-- Replace schedule_date_amount (integer) with schedule_date_amounts (jsonb array)
-- to support multiple day offsets per notification rule.
-- Existing data is migrated: single integer N becomes [N].
ALTER TABLE "notification_rules"
  ADD COLUMN "schedule_date_amounts" jsonb;
--> statement-breakpoint
UPDATE "notification_rules"
  SET "schedule_date_amounts" = jsonb_build_array("schedule_date_amount")
  WHERE "schedule_date_amount" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_rules"
  DROP COLUMN "schedule_date_amount";
