ALTER TABLE "compliance_tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "compliance_tasks" CASCADE;--> statement-breakpoint
ALTER TABLE "compliance_filings" DROP CONSTRAINT "compliance_filings_assignee_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "compliance_filings" DROP CONSTRAINT "compliance_filings_created_by_users_id_fk";
