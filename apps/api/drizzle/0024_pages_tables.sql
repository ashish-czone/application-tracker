CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"meta_description" text,
	"og_image" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"order" integer NOT NULL,
	"block_kind" text NOT NULL,
	"variant" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_unique" ON "pages" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "pages_created_by_idx" ON "pages" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "sections_page_order_idx" ON "sections" USING btree ("page_id","order");
--> statement-breakpoint
CREATE INDEX "sections_block_kind_idx" ON "sections" USING btree ("block_kind");
