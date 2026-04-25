CREATE TABLE "automation_action_log" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"action_index" integer NOT NULL,
	"link_name" text,
	"source_entity_type" text NOT NULL,
	"source_entity_id" text NOT NULL,
	"target_entity_type" text NOT NULL,
	"target_entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"action_index" integer NOT NULL,
	"action_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" text DEFAULT 'event' NOT NULL,
	"event_name" text,
	"delay_amount" integer,
	"delay_unit" text,
	"schedule_entity_type" text,
	"schedule_date_field" text,
	"schedule_date_operator" text,
	"schedule_date_amounts" jsonb,
	"schedule_date_unit" text,
	"schedule_days_of_week" jsonb,
	"conditions" jsonb,
	"actions" jsonb DEFAULT '[]' NOT NULL,
	"on_source_updated" jsonb,
	"on_source_deleted" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_scheduled" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"event_payload" jsonb,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_sent_log" (
	"rule_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"target_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_action_log" ADD CONSTRAINT "automation_action_log_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_scheduled" ADD CONSTRAINT "automation_scheduled_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_sent_log" ADD CONSTRAINT "automation_sent_log_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_action_log_source_idx" ON "automation_action_log" USING btree ("rule_id","source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "automation_action_log_link_idx" ON "automation_action_log" USING btree ("rule_id","link_name","source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "automation_executions_rule_idx" ON "automation_executions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "automation_executions_entity_idx" ON "automation_executions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "automation_scheduled_pending_idx" ON "automation_scheduled" USING btree ("scheduled_for") WHERE sent_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_sent_log_dedup_idx" ON "automation_sent_log" USING btree ("rule_id","entity_type","entity_id","target_date");