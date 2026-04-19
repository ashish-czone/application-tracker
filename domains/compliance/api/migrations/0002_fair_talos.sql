CREATE TABLE "compliance_tasks" (
	"task_id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"client_id" text NOT NULL,
	"law_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"external_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_rule_id_compliance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_tasks_external_key_key" ON "compliance_tasks" USING btree ("external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_tasks_rule_client_period_key" ON "compliance_tasks" USING btree ("rule_id","client_id","period_start");--> statement-breakpoint
CREATE INDEX "compliance_tasks_client_period_idx" ON "compliance_tasks" USING btree ("client_id","period_start");--> statement-breakpoint
CREATE INDEX "compliance_tasks_rule_id_idx" ON "compliance_tasks" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "compliance_tasks_law_id_idx" ON "compliance_tasks" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "compliance_tasks_period_start_idx" ON "compliance_tasks" USING btree ("period_start");