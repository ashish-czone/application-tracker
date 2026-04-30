-- Promote identity-shape fields to the shared `companies` table.
--
-- Until now, each domain held its own copy of legal_name / email / phone /
-- tax_id / address fields on its own clients table. With the shared-identity
-- pattern, these are 1-per-company and live on `companies` itself; domains
-- attach only domain-specific commercial fields via prefixed columns
-- (recruit_*, compliance_*, …).
--
-- All additive — no existing data migration. Domain services that store
-- these fields in their own tables today can keep doing so until they migrate
-- to read/write through `companies`.

ALTER TABLE "companies" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address_country_id" text;--> statement-breakpoint

-- Identity dedup on email. Like the existing website_domain / linkedin_url /
-- name dedup indexes, this is a partial unique index excluding deleted and
-- merged rows so a soft-deleted client doesn't block creating a fresh one.
CREATE UNIQUE INDEX "companies_email_lower_uniq"
  ON "companies" USING btree (lower("email"))
  WHERE "email" IS NOT NULL AND "deleted_at" IS NULL AND "merged_into_id" IS NULL;
