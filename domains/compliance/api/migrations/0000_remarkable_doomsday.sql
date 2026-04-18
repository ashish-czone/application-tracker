CREATE TABLE "client_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"designation" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_client_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"law_id" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text NOT NULL,
	"email" text,
	"phone" text,
	"website" text,
	"tax_id" text,
	"industry_id" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country_id" text,
	"account_manager_id" text,
	"status" text DEFAULT 'onboarding' NOT NULL,
	"onboarded_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
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
	"name" text NOT NULL,
	"law_id" text NOT NULL,
	"frequency" text NOT NULL,
	"due_day_of_month" integer NOT NULL,
	"due_month_offset" integer DEFAULT 0 NOT NULL,
	"grace_period_days" integer DEFAULT 0 NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_client_registrations" ADD CONSTRAINT "compliance_client_registrations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_client_registrations" ADD CONSTRAINT "compliance_client_registrations_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_law_handlers" ADD CONSTRAINT "compliance_law_handlers_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_law_handlers" ADD CONSTRAINT "compliance_law_handlers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_law_id_compliance_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."compliance_laws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_contacts_client_id_idx" ON "client_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_contacts_is_primary_idx" ON "client_contacts" USING btree ("is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "client_contacts_one_primary_per_client_key" ON "client_contacts" USING btree ("client_id") WHERE "is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_client_registrations_pk_key" ON "compliance_client_registrations" USING btree ("client_id","law_id","registered_at");--> statement-breakpoint
CREATE INDEX "compliance_client_registrations_client_id_idx" ON "compliance_client_registrations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "compliance_client_registrations_law_id_idx" ON "compliance_client_registrations" USING btree ("law_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_tax_id_key" ON "clients" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clients_industry_id_idx" ON "clients" USING btree ("industry_id");--> statement-breakpoint
CREATE INDEX "clients_account_manager_id_idx" ON "clients" USING btree ("account_manager_id");--> statement-breakpoint
CREATE INDEX "clients_country_id_idx" ON "clients" USING btree ("country_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_law_handlers_law_org_client_key" ON "compliance_law_handlers" USING btree ("law_id","org_entity_id","client_id");--> statement-breakpoint
CREATE INDEX "compliance_law_handlers_law_id_idx" ON "compliance_law_handlers" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "compliance_law_handlers_client_id_idx" ON "compliance_law_handlers" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_laws_code_key" ON "compliance_laws" USING btree ("code");--> statement-breakpoint
CREATE INDEX "compliance_laws_parent_id_idx" ON "compliance_laws" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "compliance_laws_path_idx" ON "compliance_laws" USING btree ("path");--> statement-breakpoint
CREATE INDEX "compliance_rules_law_id_idx" ON "compliance_rules" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "compliance_rules_active_idx" ON "compliance_rules" USING btree ("active");