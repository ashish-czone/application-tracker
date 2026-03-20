-- Rename "Super Admin" role to "Admin" for consistency.
-- The admin role is identified by having the wildcard '*' permission.

-- Only rename if "Admin" doesn't already exist for the same user type
UPDATE "roles"
SET "name" = 'Admin'
WHERE "name" = 'Super Admin'
  AND NOT EXISTS (
    SELECT 1 FROM "roles" r2
    WHERE r2."name" = 'Admin' AND r2."user_type" = "roles"."user_type"
  );

-- If both "Super Admin" and "Admin" exist, migrate users from Super Admin to Admin
-- and delete the duplicate Super Admin role
DO $$
DECLARE
  v_super_admin_id TEXT;
  v_admin_id TEXT;
BEGIN
  SELECT id INTO v_super_admin_id FROM roles WHERE name = 'Super Admin' LIMIT 1;
  SELECT id INTO v_admin_id FROM roles WHERE name = 'Admin' LIMIT 1;

  IF v_super_admin_id IS NOT NULL AND v_admin_id IS NOT NULL THEN
    -- Move users from Super Admin to Admin (skip if already assigned)
    INSERT INTO user_roles (user_id, role_id)
    SELECT user_id, v_admin_id FROM user_roles WHERE role_id = v_super_admin_id
    ON CONFLICT DO NOTHING;

    -- Remove user assignments from Super Admin
    DELETE FROM user_roles WHERE role_id = v_super_admin_id;

    -- Remove permissions from Super Admin
    DELETE FROM role_permissions WHERE role_id = v_super_admin_id;

    -- Delete Super Admin role
    DELETE FROM roles WHERE id = v_super_admin_id;
  END IF;
END $$;
