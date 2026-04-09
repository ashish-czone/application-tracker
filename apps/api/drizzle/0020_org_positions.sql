-- Org positions: define named positions (Department Head, Team Lead, Member)
CREATE TABLE "org_positions" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

-- Per-position, per-entity scope configuration
CREATE TABLE "org_position_scopes" (
  "position_id" TEXT NOT NULL REFERENCES "org_positions"("id") ON DELETE CASCADE,
  "entity_type" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  PRIMARY KEY ("position_id", "entity_type")
);
--> statement-breakpoint

-- Add position reference to org unit members
ALTER TABLE "org_unit_members" ADD COLUMN "position_id" TEXT REFERENCES "org_positions"("id");
--> statement-breakpoint

-- Drop scope from role_permissions (scope is now determined by org positions)
ALTER TABLE "role_permissions" DROP COLUMN IF EXISTS "scope";
--> statement-breakpoint

-- Drop reports_to from users (hierarchy is now implicit from org structure)
ALTER TABLE "users" DROP COLUMN IF EXISTS "reports_to";
