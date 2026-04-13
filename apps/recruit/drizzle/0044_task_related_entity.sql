ALTER TABLE "tasks" ADD COLUMN "related_entity_type" TEXT;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_entity_id" TEXT;
--> statement-breakpoint
CREATE INDEX "tasks_related_entity_idx" ON "tasks" ("related_entity_type", "related_entity_id");
