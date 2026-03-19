-- Add schedule_days_of_week to notification_rules.
-- JSONB array of integers (0=Sun, 1=Mon, ..., 6=Sat).
-- When set on recurring rules, the scanner only runs on matching days.
-- When null, the rule runs every day (existing behavior).

ALTER TABLE "notification_rules" ADD COLUMN "schedule_days_of_week" jsonb;
