-- Catches apps/api up to the rbac package schema. The rbac package's own
-- migrations (packages/platform/rbac/api/migrations/*) aren't run against
-- apps/api's DB, so several schema changes accumulated in the code without
-- a corresponding app-level migration.
--
-- Changes made here:
--   1. `roles`: add deleted_at / deleted_by columns, swap the unique index
--      from (name, user_type) to (name) scoped to non-soft-deleted rows.
--   2. `user_roles`: add created_at timestamp (default now).

-- ── roles: soft-delete support ──────────────────────────────

ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "deleted_by" text;--> statement-breakpoint

DROP INDEX IF EXISTS "roles_name_user_type_key";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key"
  ON "roles" ("name") WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- ── user_roles: timestamp column ─────────────────────────────

ALTER TABLE "user_roles"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now();
