CREATE TABLE "marketing_monitoring_keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"phrase" text NOT NULL,
	"is_regex" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "marketing_monitoring_keywords" ADD CONSTRAINT "marketing_monitoring_keywords_source_id_marketing_monitoring_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."marketing_monitoring_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_monitoring_keywords_source_idx" ON "marketing_monitoring_keywords" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "marketing_monitoring_keywords_active_idx" ON "marketing_monitoring_keywords" USING btree ("is_active");