-- Refactor task claim: drop claimedById, claiming now sets assigneeId directly
-- Both assigneeId and assigneeTeamId can coexist (= claimed team task)

-- Drop the old exclusivity constraint (both can now coexist for claimed team tasks)
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_assignee_exclusive";

-- Migrate existing claimed tasks: set assignee_id = claimed_by_id where claimed
UPDATE "tasks" SET "assignee_id" = "claimed_by_id" WHERE "claimed_by_id" IS NOT NULL AND "assignee_id" IS NULL;

-- Drop claimed_by_id column and its index
DROP INDEX IF EXISTS "tasks_claimed_by_id_idx";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "claimed_by_id";
