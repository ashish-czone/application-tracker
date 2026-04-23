-- Role-grant scopes: sibling table that carries per-grant scope rows.
--
-- Mirrors packages/platform/rbac/api/schema/role-permission-scopes.ts.
-- A grant with zero scope rows is interpreted as the unrestricted 'any'
-- scope (see getRolePermissions in RbacService). Grants with multiple
-- rows are OR-combined at enforcement time.
--
-- Also drops org_position_scopes — scope is now carried by roles, not
-- positions (see domains/compliance/todos.md §1 Q15–Q16).

CREATE TABLE IF NOT EXISTS "role_permission_scopes" (
  "role_id" text NOT NULL,
  "permission" text NOT NULL,
  "scope_type" text NOT NULL,
  "scope_params" jsonb,
  CONSTRAINT "role_permission_scopes_role_id_permission_scope_type_pk"
    PRIMARY KEY("role_id","permission","scope_type")
);
--> statement-breakpoint

ALTER TABLE "role_permission_scopes"
  ADD CONSTRAINT "role_permission_scopes_grant_fk"
  FOREIGN KEY ("role_id","permission")
  REFERENCES "public"."role_permissions"("role_id","permission")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

DROP TABLE IF EXISTS "org_position_scopes" CASCADE;
