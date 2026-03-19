-- Remove is_superadmin flag from roles table.
-- Admin roles are now identified by having the wildcard '*' permission
-- in the role_permissions table instead of a boolean flag.

-- Migrate existing superadmin roles: grant '*' permission to any role that had isSuperadmin = true
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT "id", '*', 'all'
FROM "roles"
WHERE "is_superadmin" = true
ON CONFLICT ("role_id", "permission") DO NOTHING;

-- Drop the column
ALTER TABLE "roles" DROP COLUMN IF EXISTS "is_superadmin";
