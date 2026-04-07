ALTER TABLE "audit_logs" ADD COLUMN "target_entity_type" text;
ALTER TABLE "audit_logs" ADD COLUMN "target_entity_id" text;
CREATE INDEX "audit_logs_target_entity_idx" ON "audit_logs" ("target_entity_type", "target_entity_id");
