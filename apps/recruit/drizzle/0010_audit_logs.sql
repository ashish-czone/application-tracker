-- Audit log table for tracking who did what to which entity and when.
-- Stores before/after snapshots and computed diffs for update events.

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "action" text NOT NULL,
  "event_name" text NOT NULL,
  "actor_id" text REFERENCES "users"("id"),
  "before" jsonb,
  "after" jsonb,
  "changes" jsonb,
  "correlation_id" text,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs" USING btree ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_event_name_idx" ON "audit_logs" USING btree ("event_name");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
