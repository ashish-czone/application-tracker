-- Add claimed_by_id column for team task claiming
ALTER TABLE "tasks" ADD COLUMN "claimed_by_id" text REFERENCES "users"("id");
CREATE INDEX "tasks_claimed_by_id_idx" ON "tasks" ("claimed_by_id");

-- Enforce mutual exclusivity: at most one of assignee_id or assignee_team_id
-- First, clear any existing violations (set assignee_team_id to null where both are set)
UPDATE "tasks" SET "assignee_team_id" = NULL WHERE "assignee_id" IS NOT NULL AND "assignee_team_id" IS NOT NULL;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_exclusive" CHECK (num_nonnulls(assignee_id, assignee_team_id) <= 1);
