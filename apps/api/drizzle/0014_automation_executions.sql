CREATE TABLE IF NOT EXISTS "automation_executions" (
  "id" text PRIMARY KEY NOT NULL,
  "rule_id" text NOT NULL REFERENCES "automation_rules"("id") ON DELETE CASCADE,
  "action_index" integer NOT NULL,
  "action_type" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "status" text NOT NULL,
  "error_message" text,
  "executed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "automation_executions_rule_idx" ON "automation_executions" ("rule_id");
CREATE INDEX IF NOT EXISTS "automation_executions_entity_idx" ON "automation_executions" ("entity_type", "entity_id");
