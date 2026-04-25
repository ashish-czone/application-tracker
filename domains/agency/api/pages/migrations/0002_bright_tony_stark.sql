ALTER TABLE "pages" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
-- Pre-existing rows predate the publishing workflow and are assumed live.
UPDATE "pages" SET "status" = 'published', "published_at" = "created_at" WHERE "published_at" IS NULL;--> statement-breakpoint
CREATE INDEX "pages_status_published_at_idx" ON "pages" USING btree ("status","published_at");