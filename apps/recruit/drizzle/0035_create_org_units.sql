CREATE TABLE "org_units" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "parent_id" TEXT REFERENCES "org_units"("id"),
  "type" TEXT NOT NULL DEFAULT 'team',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX "org_units_parent_id_idx" ON "org_units" ("parent_id");
--> statement-breakpoint
CREATE INDEX "org_units_type_idx" ON "org_units" ("type");
--> statement-breakpoint
CREATE TABLE "org_unit_members" (
  "org_unit_id" TEXT NOT NULL REFERENCES "org_units"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("org_unit_id", "user_id")
);
