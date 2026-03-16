-- Add trigger_type and scheduling fields to notification_rules
ALTER TABLE "notification_rules" ADD COLUMN "trigger_type" text NOT NULL DEFAULT 'event';
--> statement-breakpoint
ALTER TABLE "notification_rules" ALTER COLUMN "event_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "delay_amount" integer;
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "delay_unit" text;
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "schedule_entity_type" text;
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "schedule_date_field" text;
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "schedule_date_operator" text;
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "schedule_date_amount" integer;
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "schedule_date_unit" text;
--> statement-breakpoint
ALTER TABLE "notification_rules" ADD COLUMN "conditions" jsonb;
--> statement-breakpoint

-- Scheduled notifications (for delayed event rules)
CREATE TABLE "notification_scheduled" (
  "id" text PRIMARY KEY NOT NULL,
  "rule_id" text NOT NULL REFERENCES "notification_rules"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "event_payload" jsonb,
  "scheduled_for" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "notification_scheduled_pending_idx" ON "notification_scheduled" ("scheduled_for") WHERE "sent_at" IS NULL;
--> statement-breakpoint

-- Sent log (dedup for schedule rules)
CREATE TABLE "notification_sent_log" (
  "rule_id" text NOT NULL REFERENCES "notification_rules"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "target_date" date NOT NULL,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_sent_log_dedup_idx" ON "notification_sent_log" ("rule_id", "entity_type", "entity_id", "target_date");
