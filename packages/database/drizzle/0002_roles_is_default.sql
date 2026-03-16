-- Add is_default column to roles
ALTER TABLE "roles" ADD COLUMN "is_default" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- Enforce at most one default role per user_type
CREATE UNIQUE INDEX "roles_user_type_is_default_key" ON "roles" ("user_type") WHERE "is_default" = true;
