CREATE TABLE "compliance_client_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"law_id" text NOT NULL,
	"registration_number" text,
	"effective_from" date,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "compliance_law_handlers" (
	"id" text PRIMARY KEY NOT NULL,
	"law_id" text NOT NULL,
	"org_entity_id" text NOT NULL,
	"client_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_laws" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"path" text DEFAULT '/' NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"issuing_authority" text,
	"jurisdiction" text,
	"effective_from" date,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"law_id" text NOT NULL,
	"frequency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"due_day_of_month" integer NOT NULL,
	"due_month_offset" integer DEFAULT 0 NOT NULL,
	"grace_period_days" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"logo_url" text,
	"email" text,
	"phone" text,
	"website" text,
	"tax_registration" text,
	"fiscal_year_start" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_client_registrations" ADD CONSTRAINT "compliance_client_registrations_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_assignee_team_id_org_units_id_fk" FOREIGN KEY ("assignee_team_id") REFERENCES "public"."org_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_rule_id_compliance_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_law_handlers" ADD CONSTRAINT "compliance_law_handlers_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_client_registrations_pk_key" ON "compliance_client_registrations" USING btree ("client_id","law_id","registered_at");--> statement-breakpoint
CREATE INDEX "compliance_client_registrations_client_id_idx" ON "compliance_client_registrations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "compliance_client_registrations_law_id_idx" ON "compliance_client_registrations" USING btree ("law_id");--> statement-breakpoint
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
CREATE UNIQUE INDEX "compliance_filings_external_key_unique" ON "compliance_filings" USING btree ("external_key") WHERE external_key IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_law_handlers_law_org_client_key" ON "compliance_law_handlers" USING btree ("law_id","org_entity_id","client_id");--> statement-breakpoint
CREATE INDEX "compliance_law_handlers_law_id_idx" ON "compliance_law_handlers" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "compliance_law_handlers_client_id_idx" ON "compliance_law_handlers" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_laws_code_key" ON "compliance_laws" USING btree ("code");--> statement-breakpoint
CREATE INDEX "compliance_laws_parent_id_idx" ON "compliance_laws" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "compliance_laws_path_idx" ON "compliance_laws" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_rules_code_key" ON "compliance_rules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "compliance_rules_law_id_idx" ON "compliance_rules" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "compliance_rules_status_idx" ON "compliance_rules" USING btree ("status");