CREATE TABLE "marketing_monitoring_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"config_json" jsonb NOT NULL,
	"polling_cadence_minutes" integer DEFAULT 15 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "marketing_monitoring_sources_kind_idx" ON "marketing_monitoring_sources" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "marketing_monitoring_sources_is_active_idx" ON "marketing_monitoring_sources" USING btree ("is_active");