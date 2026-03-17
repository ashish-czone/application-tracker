-- Tasks module table

CREATE TABLE "tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'open',
  "priority" text NOT NULL DEFAULT 'medium',
  "assignee_id" text REFERENCES "users"("id"),
  "due_date" date,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "tasks_assignee_id_idx" ON "tasks" USING btree ("assignee_id");
--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");
--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");
