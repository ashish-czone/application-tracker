DROP INDEX "tasks_kind_related_idx";--> statement-breakpoint
CREATE INDEX "tasks_kind_idx" ON "tasks" USING btree ("kind");--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "related_entity_id";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "external_key";