-- Add compliance-prefixed columns to the shared identity tables and wire up
-- compliance child-table FKs to `clients`. Per the shared identity tables
-- convention in .claude/rules/module-boundaries.md, domains extend
-- `directory.clients` / `directory.client_contacts` by adding columns
-- prefixed with their slug.
--
-- This is a hand-written migration because the JS-side `clients` /
-- `clientContacts` references in domains/compliance/api/clients/*-ref.ts are
-- intentionally NOT in compliance's drizzle.config.ts schema array — drizzle-
-- kit must not regenerate CREATE TABLE migrations for the shared identity
-- rows from compliance's package. The same applies to FKs from compliance
-- child schemas (client-registrations, law-handlers, compliance-filings) to
-- `clients(id)` — declared at SQL level only.

-- ── clients (compliance client extension) ────────────────────────────────
ALTER TABLE "clients" ADD COLUMN "compliance_status" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "compliance_account_manager_id" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "compliance_onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "compliance_notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "compliance_became_client_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "compliance_archived_at" timestamp with time zone;--> statement-breakpoint

-- Partial index — most queries filter "is a compliance client" by the
-- became_client_at marker (mirrors recruit_became_client_at pattern).
CREATE INDEX "clients_compliance_became_client_at_idx"
  ON "clients" ("compliance_became_client_at")
  WHERE "compliance_became_client_at" IS NOT NULL;--> statement-breakpoint

-- ── client_contacts (compliance contact extension) ───────────────────────
ALTER TABLE "client_contacts" ADD COLUMN "compliance_client_id" text REFERENCES "clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "compliance_designation" text;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "compliance_is_primary" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "compliance_notes" text;--> statement-breakpoint

CREATE INDEX "client_contacts_compliance_client_id_idx"
  ON "client_contacts" ("compliance_client_id")
  WHERE "compliance_client_id" IS NOT NULL;--> statement-breakpoint

-- Exactly one primary contact per compliance client. Excludes deleted /
-- merged rows.
CREATE UNIQUE INDEX "client_contacts_compliance_primary_per_client_uniq"
  ON "client_contacts" ("compliance_client_id")
  WHERE "compliance_is_primary" = true
    AND "compliance_client_id" IS NOT NULL
    AND "deleted_at" IS NULL
    AND "merged_into_id" IS NULL;--> statement-breakpoint

-- ── Compliance child-table FKs to clients(id) ───────────────────────────
ALTER TABLE "compliance_client_registrations"
  ADD CONSTRAINT "compliance_client_registrations_client_id_clients_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "compliance_law_handlers"
  ADD CONSTRAINT "compliance_law_handlers_client_id_clients_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "compliance_filings"
  ADD CONSTRAINT "compliance_filings_client_id_clients_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;
