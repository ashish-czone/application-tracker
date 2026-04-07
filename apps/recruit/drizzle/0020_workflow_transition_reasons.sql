ALTER TABLE "workflow_transitions" ADD COLUMN "reason_options" jsonb;
--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD COLUMN "reason_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD COLUMN "comment_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "workflow_transition_history" ADD COLUMN "reason" text;
