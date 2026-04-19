ALTER TABLE "tasks" RENAME COLUMN "related_entity_type" TO "kind";--> statement-breakpoint
DROP INDEX "tasks_related_entity_idx";--> statement-breakpoint
CREATE INDEX "tasks_kind_related_idx" ON "tasks" USING btree ("kind","related_entity_id");
