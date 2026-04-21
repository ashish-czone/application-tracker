CREATE TABLE "client_logos" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text NOT NULL,
	"href" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "client_logos_display_order_idx" ON "client_logos" USING btree ("display_order");