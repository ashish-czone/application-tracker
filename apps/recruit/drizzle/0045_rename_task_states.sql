UPDATE "tasks" SET "status" = 'pending' WHERE "status" = 'open';
--> statement-breakpoint
UPDATE "tasks" SET "status" = 'completed' WHERE "status" = 'done';
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'pending';
