-- Add recruit-prefixed columns to the shared `clients` table. Per the shared
-- identity tables convention in .claude/rules/module-boundaries.md, domains
-- extend `directory.clients` by adding columns prefixed with their slug.
--
-- This is a hand-written migration because the JS-side `clients` reference
-- in domains/recruit/api/clients/clients-ref.ts is intentionally NOT in
-- recruit's drizzle.config.ts schema array — drizzle-kit must not regenerate
-- CREATE TABLE migrations for the shared identity row from recruit's package.

ALTER TABLE "clients" ADD COLUMN "recruit_about" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "recruit_contact_number" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "recruit_source" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "recruit_billing_address" jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "recruit_shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "recruit_became_client_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "recruit_archived_at" timestamp with time zone;--> statement-breakpoint

-- Partial index for "active recruit clients" lookups.
CREATE INDEX "clients_recruit_active_idx" ON "clients" ("recruit_became_client_at")
  WHERE "recruit_became_client_at" IS NOT NULL AND "recruit_archived_at" IS NULL;
