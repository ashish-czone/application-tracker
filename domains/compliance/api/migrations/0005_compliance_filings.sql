CREATE TABLE "compliance_filings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee_id" text,
	"assignee_team_id" text NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"rule_id" text NOT NULL,
	"client_id" text NOT NULL,
	"law_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"external_key" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_assignee_team_id_org_units_id_fk" FOREIGN KEY ("assignee_team_id") REFERENCES "public"."org_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_rule_id_compliance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_filings_assignee_id_idx" ON "compliance_filings" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "compliance_filings_assignee_team_id_idx" ON "compliance_filings" USING btree ("assignee_team_id");--> statement-breakpoint
CREATE INDEX "compliance_filings_status_idx" ON "compliance_filings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "compliance_filings_due_date_idx" ON "compliance_filings" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "compliance_filings_completed_at_idx" ON "compliance_filings" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "compliance_filings_rule_id_idx" ON "compliance_filings" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "compliance_filings_law_id_idx" ON "compliance_filings" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "compliance_filings_client_period_idx" ON "compliance_filings" USING btree ("client_id","period_start");--> statement-breakpoint
CREATE INDEX "compliance_filings_period_start_idx" ON "compliance_filings" USING btree ("period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_filings_rule_client_period_key" ON "compliance_filings" USING btree ("rule_id","client_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_filings_external_key_unique" ON "compliance_filings" USING btree ("external_key") WHERE external_key IS NOT NULL;