-- Fold compliance's standalone `clients` and `client_contacts` tables into
-- the shared identity tables (`companies` / `people`). Mirrors recruit's
-- final F-2c step (PR #1182) — once this runs, every compliance client
-- and contact lives as a single shared identity row with compliance_*
-- prefix columns, and the standalone tables are gone.
--
-- This migration is the C-2/C-3/C-4 combined step. The service rewrite
-- ships in the same PR; by the time this runs in CI/dev, the services
-- already operate on the shared tables and the standalone schema files
-- have been deleted.
--
-- Field-name mapping (compliance standalone → shared base/prefix):
--   clients.name              → companies.name
--   clients.legal_name        → companies.legal_name
--   clients.email             → companies.email
--   clients.phone             → companies.phone
--   clients.website           → companies.website_domain        (renamed)
--   clients.tax_id            → companies.tax_id
--   clients.industry_id       → companies.industry              (renamed; opaque text)
--   clients.address_line*     → companies.address_line*
--   clients.city/state/postal → companies.city/state/postal_code
--   clients.country_id        → companies.address_country_id    (renamed; opaque text)
--   clients.account_manager_id→ companies.compliance_account_manager_id (prefix)
--   clients.status            → companies.compliance_status              (prefix)
--   clients.onboarded_at      → companies.compliance_onboarded_at        (prefix)
--   clients.notes             → companies.compliance_notes               (prefix)
--   clients.created_at        → companies.created_at AND companies.compliance_became_client_at
--   clients.updated_at        → companies.updated_at
--   ─                         → companies.created_by = 'system'   (NOT NULL on shared)
--
--   client_contacts.name      → people.full_name             (renamed)
--   client_contacts.email     → people.primary_email         (renamed)
--   client_contacts.phone     → people.primary_phone         (renamed)
--   client_contacts.client_id → people.compliance_client_id  (prefix)
--   client_contacts.designation → people.compliance_designation (prefix)
--   client_contacts.is_primary→ people.compliance_is_primary (prefix)
--   client_contacts.notes     → people.compliance_notes      (prefix)
--   client_contacts.created_at→ people.created_at
--   client_contacts.updated_at→ people.updated_at
--   ─                         → people.created_by = 'system' (NOT NULL on shared)
--
-- Idempotency: ON CONFLICT (id) DO NOTHING on the backfill INSERTs so the
-- migration is safe to retry mid-flight (drizzle-orm wraps each migration
-- in a transaction, so partial application can't happen, but the guard
-- protects us if a developer manually re-applies on a partially-migrated
-- DB).

-- ── Backfill `companies` from compliance.clients ─────────────────────────
INSERT INTO "companies" (
  "id", "name", "legal_name", "email", "phone", "website_domain", "tax_id", "industry",
  "address_line1", "address_line2", "city", "state", "postal_code", "address_country_id",
  "compliance_account_manager_id", "compliance_status", "compliance_onboarded_at",
  "compliance_notes", "compliance_became_client_at",
  "created_at", "updated_at", "created_by", "external_ids"
)
SELECT
  "id", "name", "legal_name", "email", "phone", "website", "tax_id", "industry_id",
  "address_line1", "address_line2", "city", "state", "postal_code", "country_id",
  "account_manager_id", "status", "onboarded_at",
  "notes", "created_at",
  "created_at", "updated_at", 'system', '{}'::jsonb
FROM "clients"
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- ── Backfill `people` from compliance.client_contacts ────────────────────
INSERT INTO "people" (
  "id", "full_name", "primary_email", "primary_phone",
  "compliance_client_id", "compliance_designation", "compliance_is_primary", "compliance_notes",
  "created_at", "updated_at", "created_by", "external_ids", "do_not_contact"
)
SELECT
  "id", "name", "email", "phone",
  "client_id", "designation", "is_primary", "notes",
  "created_at", "updated_at", 'system', '{}'::jsonb, false
FROM "client_contacts"
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- ── Drop standalone tables ──────────────────────────────────────────────
-- DROP TABLE … CASCADE drops the FK constraints from child tables that
-- reference clients(id): client_registrations.client_id_fkey,
-- law_handlers.client_id_fkey, compliance_filings.client_id_fkey, and
-- client_contacts.client_id_fkey. We re-add them below, repointed at
-- companies(id).
DROP TABLE IF EXISTS "client_contacts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "clients" CASCADE;
--> statement-breakpoint

-- ── Re-add child FK constraints, now pointing at companies(id) ──────────
ALTER TABLE "compliance_client_registrations"
  ADD CONSTRAINT "compliance_client_registrations_client_id_companies_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "companies"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "compliance_law_handlers"
  ADD CONSTRAINT "compliance_law_handlers_client_id_companies_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "companies"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "compliance_filings"
  ADD CONSTRAINT "compliance_filings_client_id_companies_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "companies"("id") ON DELETE CASCADE;
