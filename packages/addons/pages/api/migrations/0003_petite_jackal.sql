ALTER TABLE "pages" ADD COLUMN "seo" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- Backfill from the legacy flat columns. Kept as a transition; the legacy
-- columns stay for one release and get dropped in a follow-up.
UPDATE "pages"
SET "seo" = jsonb_strip_nulls(
  jsonb_build_object('description', "meta_description", 'ogImage', "og_image")
)
WHERE "seo" = '{}'::jsonb
  AND ("meta_description" IS NOT NULL OR "og_image" IS NOT NULL);