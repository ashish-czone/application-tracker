-- Repoint recruit_contacts / interviews / job_openings child FK columns
-- from `recruit_clients.id` to `companies.id`. The shared identity table
-- pattern means a "client" is a `companies` row with `recruit_became_client_at`
-- set; child tables FK directly to `companies.id` so the recruit_clients
-- shadow can be dropped in the cleanup PR.
--
-- The values currently stored in `client_id` are recruit_clients UUIDs.
-- We rewrite them to the corresponding companies UUID by JOIN through
-- recruit_clients.company_id. Rows whose client_id has no matching
-- recruit_clients row, or whose recruit_clients.company_id is NULL, end
-- up with NULL company_id — these would have been broken anyway.

-- =========================================================================
-- 1. recruit_contacts
-- =========================================================================
ALTER TABLE "recruit_contacts" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER INDEX "recruit_contacts_client_id_idx" RENAME TO "recruit_contacts_company_id_idx";--> statement-breakpoint

UPDATE "recruit_contacts"
SET "company_id" = rc."company_id"
FROM "recruit_clients" rc
WHERE "recruit_contacts"."company_id" = rc."id";--> statement-breakpoint

-- Rows whose old client_id had no matching recruit_clients row stay with
-- whatever value was there (now treated as a stale companies.id) — the next
-- statement nulls those out so the column is a valid companies FK.
UPDATE "recruit_contacts"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "companies" WHERE "id" = "recruit_contacts"."company_id");--> statement-breakpoint

-- =========================================================================
-- 2. interviews
-- =========================================================================
ALTER TABLE "interviews" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER INDEX "interviews_client_id_idx" RENAME TO "interviews_company_id_idx";--> statement-breakpoint

UPDATE "interviews"
SET "company_id" = rc."company_id"
FROM "recruit_clients" rc
WHERE "interviews"."company_id" = rc."id";--> statement-breakpoint

UPDATE "interviews"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "companies" WHERE "id" = "interviews"."company_id");--> statement-breakpoint

-- =========================================================================
-- 3. job_openings
-- =========================================================================
ALTER TABLE "job_openings" RENAME COLUMN "client_id" TO "company_id";--> statement-breakpoint
ALTER INDEX "job_openings_client_id_idx" RENAME TO "job_openings_company_id_idx";--> statement-breakpoint

UPDATE "job_openings"
SET "company_id" = rc."company_id"
FROM "recruit_clients" rc
WHERE "job_openings"."company_id" = rc."id";--> statement-breakpoint

UPDATE "job_openings"
SET "company_id" = NULL
WHERE "company_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "companies" WHERE "id" = "job_openings"."company_id");
