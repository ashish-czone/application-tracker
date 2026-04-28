CREATE TABLE "case_studies" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"client" text NOT NULL,
	"industry" text,
	"year" integer,
	"summary" text NOT NULL,
	"body" text,
	"results" text,
	"hero_image_url" text,
	"cta_text" text,
	"cta_href" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "case_studies_slug_unique" ON "case_studies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "case_studies_display_order_idx" ON "case_studies" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "case_studies_industry_idx" ON "case_studies" USING btree ("industry");