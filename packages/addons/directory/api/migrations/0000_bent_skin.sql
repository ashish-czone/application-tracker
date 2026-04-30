CREATE TABLE "client_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"primary_email" text,
	"primary_phone" text,
	"linkedin_url" text,
	"job_title" text,
	"client_id" text,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"merged_into_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"email" text,
	"phone" text,
	"tax_id" text,
	"website_domain" text,
	"linkedin_url" text,
	"industry" text,
	"size_band" text,
	"country_code" char(2),
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"address_country_id" text,
	"default_contact_id" text,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"merged_into_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_contacts_client_id_idx" ON "client_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_contacts_full_name_lower_idx" ON "client_contacts" USING btree (lower("full_name"));--> statement-breakpoint
CREATE INDEX "client_contacts_merged_into_idx" ON "client_contacts" USING btree ("merged_into_id");--> statement-breakpoint
CREATE INDEX "clients_name_lower_idx" ON "clients" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "clients_merged_into_idx" ON "clients" USING btree ("merged_into_id");--> statement-breakpoint
-- Partial unique indexes for dedup keys. Drizzle-kit can't emit `WHERE` clauses
-- from the schema builder, so they live here.
CREATE UNIQUE INDEX "clients_website_domain_uniq" ON "clients" USING btree (lower("website_domain")) WHERE "website_domain" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_linkedin_url_uniq" ON "clients" USING btree ("linkedin_url") WHERE "linkedin_url" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_name_lower_uniq" ON "clients" USING btree (lower(trim("name"))) WHERE "deleted_at" IS NULL AND "merged_into_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_email_lower_uniq" ON "clients" USING btree (lower("email")) WHERE "email" IS NOT NULL AND "deleted_at" IS NULL AND "merged_into_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "client_contacts_primary_email_lower_uniq" ON "client_contacts" USING btree (lower("primary_email")) WHERE "primary_email" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "client_contacts_linkedin_url_uniq" ON "client_contacts" USING btree ("linkedin_url") WHERE "linkedin_url" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
-- Self-referencing FKs and circular FK between clients and client_contacts.
-- The clients → client_contacts FK is DEFERRABLE so that "create client; create
-- contact; set client.default_contact_id" can run in a single transaction.
ALTER TABLE "clients" ADD CONSTRAINT "clients_merged_into_id_clients_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_merged_into_id_client_contacts_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."client_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_default_contact_id_client_contacts_id_fk" FOREIGN KEY ("default_contact_id") REFERENCES "public"."client_contacts"("id") ON DELETE set null ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;