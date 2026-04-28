-- R-1: backfill recruit clients/contacts identity into directory.
-- Renames `clients` → `recruit_clients` and `contacts` → `recruit_contacts`
-- (the bare names are reserved for future cross-domain use), drops the unused
-- `parent_client_id` column, adds nullable `company_id` / `person_id` FKs to
-- directory.companies / directory.people, and backfills them by deduplicating
-- identity rows. Old identity columns stay intact — services keep reading them
-- until R-2 rewires reads to directory; R-3 drops them and renames
-- `recruit_contacts` → `recruit_contact_extras`.
--
-- Dedup keys:
--   companies: lower(trim(client_name))     — earliest recruit_client wins
--   people:    lower(trim(email))            — earliest recruit_contact wins
--              (rows with no email get one person each; no merging)

-- =========================================================================
-- 1. Rename `clients` → `recruit_clients`
-- =========================================================================
ALTER TABLE "clients" RENAME TO "recruit_clients";--> statement-breakpoint
ALTER INDEX "clients_client_name_idx" RENAME TO "recruit_clients_client_name_idx";--> statement-breakpoint
ALTER INDEX "clients_industry_idx" RENAME TO "recruit_clients_industry_idx";--> statement-breakpoint
ALTER INDEX "clients_created_by_idx" RENAME TO "recruit_clients_created_by_idx";--> statement-breakpoint

-- Drop unused field. Zero references in any service, controller, or business
-- logic (pure UI lookup field that never had any consumers).
ALTER TABLE "recruit_clients" DROP COLUMN "parent_client_id";--> statement-breakpoint

-- Identity FK to directory.companies. Nullable until R-3 makes it the source
-- of truth for client identity.
ALTER TABLE "recruit_clients" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "recruit_clients"
  ADD CONSTRAINT "recruit_clients_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recruit_clients_company_id_idx" ON "recruit_clients" USING btree ("company_id");--> statement-breakpoint

-- =========================================================================
-- 2. Rename `contacts` → `recruit_contacts`
-- =========================================================================
ALTER TABLE "contacts" RENAME TO "recruit_contacts";--> statement-breakpoint
ALTER INDEX "contacts_client_id_idx" RENAME TO "recruit_contacts_client_id_idx";--> statement-breakpoint
ALTER INDEX "contacts_email_idx" RENAME TO "recruit_contacts_email_idx";--> statement-breakpoint
ALTER INDEX "contacts_last_name_idx" RENAME TO "recruit_contacts_last_name_idx";--> statement-breakpoint
ALTER INDEX "contacts_created_by_idx" RENAME TO "recruit_contacts_created_by_idx";--> statement-breakpoint

ALTER TABLE "recruit_contacts" ADD COLUMN "person_id" text;--> statement-breakpoint
ALTER TABLE "recruit_contacts"
  ADD CONSTRAINT "recruit_contacts_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "people"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recruit_contacts_person_id_idx" ON "recruit_contacts" USING btree ("person_id");--> statement-breakpoint

-- =========================================================================
-- 3. Backfill `companies` (one row per distinct lower(trim(client_name)))
-- =========================================================================
-- Earliest recruit_client (by created_at) wins per identity. website_domain
-- stays NULL during backfill so multiple clients sharing a website don't
-- collide on the partial unique index — admins can populate it later via the
-- directory UI. NOT EXISTS guard skips identities already present.
INSERT INTO "companies" (
  "id", "name", "industry",
  "external_ids", "created_by", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  trim(rc.client_name),
  rc.industry,
  '{}'::jsonb,
  rc.created_by,
  rc.created_at,
  rc.updated_at
FROM (
  SELECT DISTINCT ON (lower(trim(client_name)))
    client_name, industry, created_by, created_at, updated_at
  FROM "recruit_clients"
  WHERE deleted_at IS NULL
  ORDER BY lower(trim(client_name)), created_at ASC
) rc
WHERE NOT EXISTS (
  SELECT 1 FROM "companies" c
  WHERE lower(trim(c.name)) = lower(trim(rc.client_name))
    AND c.deleted_at IS NULL
    AND c.merged_into_id IS NULL
);--> statement-breakpoint

-- =========================================================================
-- 4. Resolve recruit_clients.company_id
-- =========================================================================
UPDATE "recruit_clients" rc
SET company_id = c.id
FROM "companies" c
WHERE lower(trim(rc.client_name)) = lower(trim(c.name))
  AND rc.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND c.merged_into_id IS NULL;--> statement-breakpoint

-- =========================================================================
-- 5a. Backfill `people` from contacts WITH email (dedup by lowercased email)
-- =========================================================================
-- Earliest recruit_contact (by created_at) wins per email. company_id comes
-- from recruit_clients.company_id resolved in step 4. linkedin_url stays NULL
-- so multiple contacts sharing a profile URL don't collide on the partial
-- unique index.
INSERT INTO "people" (
  "id", "full_name", "primary_email", "primary_phone",
  "job_title", "company_id",
  "external_ids", "created_by", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  trim(coalesce(rc.first_name, '') || ' ' || coalesce(rc.last_name, '')),
  lower(trim(rc.email)),
  coalesce(rc.mobile, rc.work_phone),
  rc.job_title,
  cl.company_id,
  '{}'::jsonb,
  rc.created_by,
  rc.created_at,
  rc.updated_at
FROM (
  SELECT DISTINCT ON (lower(trim(email)))
    id, first_name, last_name, email, mobile, work_phone,
    job_title, client_id, created_by, created_at, updated_at
  FROM "recruit_contacts"
  WHERE email IS NOT NULL AND trim(email) <> '' AND deleted_at IS NULL
  ORDER BY lower(trim(email)), created_at ASC
) rc
LEFT JOIN "recruit_clients" cl ON cl.id = rc.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM "people" p
  WHERE lower(p.primary_email) = lower(trim(rc.email))
    AND p.deleted_at IS NULL
    AND p.merged_into_id IS NULL
);--> statement-breakpoint

-- =========================================================================
-- 5b. Backfill `people` from contacts WITHOUT email (one row each, no dedup)
-- =========================================================================
-- The recruit_contact id is stashed in external_ids so step 6b can resolve
-- the person_id back-reference without an email match.
INSERT INTO "people" (
  "id", "full_name", "primary_phone", "job_title", "company_id",
  "external_ids", "created_by", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  trim(coalesce(rc.first_name, '') || ' ' || coalesce(rc.last_name, '')),
  coalesce(rc.mobile, rc.work_phone),
  rc.job_title,
  cl.company_id,
  jsonb_build_object('recruit_contact_id', rc.id),
  rc.created_by,
  rc.created_at,
  rc.updated_at
FROM "recruit_contacts" rc
LEFT JOIN "recruit_clients" cl ON cl.id = rc.client_id
WHERE (rc.email IS NULL OR trim(rc.email) = '')
  AND rc.deleted_at IS NULL;--> statement-breakpoint

-- =========================================================================
-- 6a. Resolve recruit_contacts.person_id for contacts WITH email
-- =========================================================================
UPDATE "recruit_contacts" c
SET person_id = p.id
FROM "people" p
WHERE c.email IS NOT NULL AND trim(c.email) <> ''
  AND lower(p.primary_email) = lower(trim(c.email))
  AND c.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND p.merged_into_id IS NULL;--> statement-breakpoint

-- =========================================================================
-- 6b. Resolve recruit_contacts.person_id for contacts WITHOUT email
-- =========================================================================
UPDATE "recruit_contacts" c
SET person_id = p.id
FROM "people" p
WHERE (c.email IS NULL OR trim(c.email) = '')
  AND p.external_ids ->> 'recruit_contact_id' = c.id
  AND c.deleted_at IS NULL;
