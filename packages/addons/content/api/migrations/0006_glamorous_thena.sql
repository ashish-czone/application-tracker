CREATE TABLE "stats" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"value" integer NOT NULL,
	"suffix" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "stats_display_order_idx" ON "stats" USING btree ("display_order");