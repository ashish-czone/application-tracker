CREATE TABLE "marketing_monitoring_items" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"author" text,
	"title" text,
	"body_excerpt" text,
	"matched_keyword_ids" text[] DEFAULT '{}' NOT NULL,
	"posted_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"snoozed_until" timestamp with time zone,
	"engagement_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "marketing_monitoring_items" ADD CONSTRAINT "marketing_monitoring_items_source_id_marketing_monitoring_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."marketing_monitoring_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_monitoring_items_source_external_uniq" ON "marketing_monitoring_items" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "marketing_monitoring_items_source_idx" ON "marketing_monitoring_items" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "marketing_monitoring_items_status_idx" ON "marketing_monitoring_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_monitoring_items_posted_at_idx" ON "marketing_monitoring_items" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "marketing_monitoring_items_snoozed_until_idx" ON "marketing_monitoring_items" USING btree ("snoozed_until");