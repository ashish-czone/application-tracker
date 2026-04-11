CREATE TABLE "org_unit_levels" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
ALTER TABLE "org_units" ADD COLUMN "level_id" TEXT;
--> statement-breakpoint
DROP INDEX "org_units_type_idx";
--> statement-breakpoint
ALTER TABLE "org_units" DROP COLUMN "type";
--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_level_id_org_unit_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "org_unit_levels"("id");
--> statement-breakpoint
CREATE INDEX "org_units_level_id_idx" ON "org_units" ("level_id");
