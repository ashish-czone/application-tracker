CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website_domain" text,
	"linkedin_url" text,
	"industry" text,
	"size_band" text,
	"country_code" char(2),
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
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"primary_email" text,
	"primary_phone" text,
	"linkedin_url" text,
	"job_title" text,
	"company_id" text,
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
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_name_lower_idx" ON "companies" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "companies_merged_into_idx" ON "companies" USING btree ("merged_into_id") WHERE "merged_into_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "people_company_id_idx" ON "people" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "people_full_name_lower_idx" ON "people" USING btree (lower("full_name"));--> statement-breakpoint
CREATE INDEX "people_merged_into_idx" ON "people" USING btree ("merged_into_id") WHERE "merged_into_id" IS NOT NULL;--> statement-breakpoint
-- Partial unique indexes for dedup keys. Drizzle-kit can't emit `WHERE` clauses
-- from the schema builder, so they live here.
CREATE UNIQUE INDEX "companies_website_domain_uniq" ON "companies" USING btree (lower("website_domain")) WHERE "website_domain" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_linkedin_url_uniq" ON "companies" USING btree ("linkedin_url") WHERE "linkedin_url" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "people_primary_email_lower_uniq" ON "people" USING btree (lower("primary_email")) WHERE "primary_email" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "people_linkedin_url_uniq" ON "people" USING btree ("linkedin_url") WHERE "linkedin_url" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
-- Self-referencing FKs and circular FK between companies and people.
-- The companies → people FK is DEFERRABLE so that "create company; create
-- person; set company.default_contact_id" can run in a single transaction.
ALTER TABLE "companies" ADD CONSTRAINT "companies_merged_into_id_companies_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_merged_into_id_people_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_default_contact_id_people_id_fk" FOREIGN KEY ("default_contact_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;