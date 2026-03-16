-- Notification templates (Mustache templates per channel)
CREATE TABLE "notification_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "channel" text NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

-- Notification rules (event → recipient strategy, channels attached via junction)
CREATE TABLE "notification_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "event_name" text NOT NULL,
  "recipient_strategy" text NOT NULL,
  "recipient_config" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Junction: which channels a rule delivers on, each with its own template
CREATE TABLE "notification_rule_channels" (
  "rule_id" text NOT NULL REFERENCES "notification_rules"("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "template_id" text NOT NULL REFERENCES "notification_templates"("id"),
  PRIMARY KEY ("rule_id", "channel")
);
--> statement-breakpoint

-- In-app notifications (queryable by the UI)
CREATE TABLE "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "body" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "event_name" text,
  "entity_type" text,
  "entity_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Per-user channel preferences (opt-in/opt-out)
CREATE TABLE "notification_preferences" (
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "channel" text NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("user_id", "channel")
);
--> statement-breakpoint

-- Index for querying rules by event name
CREATE INDEX "notification_rules_event_name_idx" ON "notification_rules" ("event_name") WHERE "is_active" = true;
--> statement-breakpoint

-- Index for querying in-app notifications by user
CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id");
