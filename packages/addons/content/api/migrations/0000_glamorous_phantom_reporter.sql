CREATE TABLE "testimonials" (
	"id" text PRIMARY KEY NOT NULL,
	"quote" text NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text,
	"company_name" text,
	"avatar_url" text,
	"company_logo_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "testimonials_display_order_idx" ON "testimonials" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "testimonials_is_active_idx" ON "testimonials" USING btree ("is_active");