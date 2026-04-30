-- Compliance prefix columns on the shared identity tables.
--
-- Mirrors the recruit_* extension pattern (recruit's 0003 migration) — adds
-- compliance-specific commercial fields to `companies` and `people` so a
-- single shared identity row can be a recruit client AND a compliance client
-- without a separate domain table per relationship.
--
-- All additive. No data migration here — compliance services keep writing
-- to the standalone `clients` / `client_contacts` tables until C-2 flips
-- them to read/write through these prefix columns.

-- ── companies (compliance client extension) ──────────────────────────────
ALTER TABLE "companies" ADD COLUMN "compliance_status" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "compliance_account_manager_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "compliance_onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "compliance_notes" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "compliance_became_client_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "compliance_archived_at" timestamp with time zone;--> statement-breakpoint

-- Partial index — most queries filter "is a compliance client" by the
-- became_client_at marker (mirrors recruit_became_client_at pattern). The
-- partial keeps the index small for apps that have many directory clients
-- but few compliance clients.
CREATE INDEX "companies_compliance_became_client_at_idx"
  ON "companies" ("compliance_became_client_at")
  WHERE "compliance_became_client_at" IS NOT NULL;--> statement-breakpoint

-- ── people (compliance contact extension) ────────────────────────────────
ALTER TABLE "people" ADD COLUMN "compliance_client_id" text REFERENCES "companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "compliance_designation" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "compliance_is_primary" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "compliance_notes" text;--> statement-breakpoint

CREATE INDEX "people_compliance_client_id_idx"
  ON "people" ("compliance_client_id")
  WHERE "compliance_client_id" IS NOT NULL;--> statement-breakpoint

-- Exactly one primary contact per compliance client, mirroring the existing
-- compliance.client_contacts.is_primary partial unique. Excludes deleted
-- (mergedIntoId set, deletedAt set) rows.
CREATE UNIQUE INDEX "people_compliance_primary_per_client_uniq"
  ON "people" ("compliance_client_id")
  WHERE "compliance_is_primary" = true
    AND "compliance_client_id" IS NOT NULL
    AND "deleted_at" IS NULL
    AND "merged_into_id" IS NULL;
