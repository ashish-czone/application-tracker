-- Restore Zoho-style polymorphic task relations. `kind` was a domain
-- discriminator added when compliance-tasks was modelled as an
-- extensionOf child of tasks; now that domain entities own their own
-- tables, tasks go back to a polymorphic FK (`related_entity_type`,
-- `related_entity_id`) pointing at any record. The idempotency
-- column (`external_key`) is retained, but its uniqueness is now
-- scoped by `related_entity_type` instead of `kind`.
DROP INDEX "tasks_kind_idx";--> statement-breakpoint
DROP INDEX "tasks_kind_external_key_unique";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_entity_type" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "related_entity_id" text;--> statement-breakpoint
CREATE INDEX "tasks_related_entity_idx" ON "tasks" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_related_entity_external_key_unique" ON "tasks" USING btree ("related_entity_type","external_key") WHERE related_entity_type IS NOT NULL AND external_key IS NOT NULL;
