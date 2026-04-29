-- F-2c: drop the shadow identity columns from `recruit_clients`.
--
-- Identity (clientName, website, industry) lives canonically in
-- `directory.companies`. R-1 backfilled `recruit_clients.company_id` for
-- every existing row; F-1/F-2b rewired reads/writes to JOIN with companies
-- and source identity from there. F-2c-pre (PR #1173) replaced engine-driven
-- lookup label resolution with a custom resolver that JOINs companies, so
-- nothing reads these shadow columns anymore.
--
-- This migration drops the columns and the supporting indexes.

DROP INDEX "recruit_clients_client_name_idx";--> statement-breakpoint
DROP INDEX "recruit_clients_industry_idx";--> statement-breakpoint

ALTER TABLE "recruit_clients" DROP COLUMN "client_name";--> statement-breakpoint
ALTER TABLE "recruit_clients" DROP COLUMN "website";--> statement-breakpoint
ALTER TABLE "recruit_clients" DROP COLUMN "industry";
