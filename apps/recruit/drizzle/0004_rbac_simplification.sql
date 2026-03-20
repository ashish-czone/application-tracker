-- Drop the old role_permissions table (has FK to permissions)
DROP TABLE IF EXISTS "role_permissions" CASCADE;

-- Drop the permissions table (no longer needed)
DROP TABLE IF EXISTS "permissions" CASCADE;

-- Recreate role_permissions with permission as a string column
CREATE TABLE "role_permissions" (
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission" text NOT NULL,
  "scope" text NOT NULL DEFAULT 'all',
  PRIMARY KEY ("role_id", "permission")
);

-- Add is_superadmin flag to roles
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_superadmin" boolean NOT NULL DEFAULT false;
