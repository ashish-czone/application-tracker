-- Add recruit-prefixed columns to the shared `companies` table and
-- backfill them from `recruit_clients`. Per the shared identity tables
-- convention in .claude/rules/module-boundaries.md, domains extend
-- `directory.companies` by adding columns prefixed with their slug.
--
-- After this migration, `companies.recruit_*` carries the canonical
-- recruit-client data. `recruit_clients` is still written by services
-- as a shadow until the cleanup commit drops it.
--
-- The address columns (billing_*, shipping_*) on recruit_clients
-- collapse into two jsonb fields here. Per the shared-identity rule,
-- recruit-specific lifecycle is captured by `recruit_became_client_at`
-- + `recruit_archived_at`; remaining audit comes from companies' own
-- columns.

-- =========================================================================
-- 1. Add recruit_* columns
-- =========================================================================
ALTER TABLE "companies" ADD COLUMN "recruit_about" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "recruit_contact_number" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "recruit_source" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "recruit_billing_address" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "recruit_shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "recruit_became_client_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "recruit_archived_at" timestamp with time zone;--> statement-breakpoint

-- Partial index for "active recruit clients" lookups.
CREATE INDEX "companies_recruit_active_idx" ON "companies" ("recruit_became_client_at")
  WHERE "recruit_became_client_at" IS NOT NULL AND "recruit_archived_at" IS NULL;--> statement-breakpoint

-- =========================================================================
-- 2. Backfill from recruit_clients
-- =========================================================================
-- Pick the latest-created non-deleted recruit_clients row per company_id
-- (defensive: there is no unique index on company_id, so duplicates may
-- exist). NULLs in source columns translate to NULL jsonb / text on
-- companies, not "{}".
WITH ranked AS (
  SELECT
    "company_id",
    "contact_number",
    "about",
    "source",
    "billing_street", "billing_city", "billing_province", "billing_code", "billing_country",
    "shipping_street", "shipping_city", "shipping_province", "shipping_code", "shipping_country",
    "created_at" AS became_client_at,
    "deleted_at" AS archived_at,
    ROW_NUMBER() OVER (
      PARTITION BY "company_id"
      ORDER BY ("deleted_at" IS NULL) DESC, "created_at" DESC
    ) AS rn
  FROM "recruit_clients"
  WHERE "company_id" IS NOT NULL
)
UPDATE "companies" c
SET
  "recruit_about" = r."about",
  "recruit_contact_number" = r."contact_number",
  "recruit_source" = r."source",
  "recruit_billing_address" = CASE
    WHEN COALESCE(r."billing_street", r."billing_city", r."billing_province", r."billing_code", r."billing_country") IS NULL
      THEN NULL
    ELSE jsonb_strip_nulls(jsonb_build_object(
      'street', r."billing_street",
      'city', r."billing_city",
      'province', r."billing_province",
      'postalCode', r."billing_code",
      'country', r."billing_country"
    ))
  END,
  "recruit_shipping_address" = CASE
    WHEN COALESCE(r."shipping_street", r."shipping_city", r."shipping_province", r."shipping_code", r."shipping_country") IS NULL
      THEN NULL
    ELSE jsonb_strip_nulls(jsonb_build_object(
      'street', r."shipping_street",
      'city', r."shipping_city",
      'province', r."shipping_province",
      'postalCode', r."shipping_code",
      'country', r."shipping_country"
    ))
  END,
  "recruit_became_client_at" = r."became_client_at",
  "recruit_archived_at" = r."archived_at"
FROM ranked r
WHERE r.rn = 1 AND c."id" = r."company_id";
