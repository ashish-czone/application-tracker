-- Enforces compliance Q2 decision: every task must have a team; an
-- individual assignee is optional and layered on top. Prior to this
-- change, `assignee_team_id` was nullable and an XOR invariant blocked
-- setting both columns at once. That XOR is removed in the same feature
-- flow; this migration tightens the column.
--
-- Pre-condition: no rows where `assignee_team_id IS NULL`. If a tenant
-- has such rows, the migration will fail — resolve by either deleting
-- the orphan tasks or backfilling them to a team before re-running.
ALTER TABLE "tasks" ALTER COLUMN "assignee_team_id" SET NOT NULL;
