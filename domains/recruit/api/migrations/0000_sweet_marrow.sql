CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"candidate_id" text NOT NULL,
	"job_opening_id" text NOT NULL,
	"stage" text DEFAULT 'new',
	"source" text,
	"referred_by" text,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"mobile" text,
	"website" text,
	"secondary_email" text,
	"street" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"experience_in_years" numeric,
	"highest_qualification" text,
	"current_title" text,
	"current_company" text,
	"notice_period" text,
	"salary_expectation_min" integer,
	"salary_expectation_max" integer,
	"current_salary" integer,
	"currency" text DEFAULT 'USD',
	"skill_set" text,
	"additional_info" text,
	"linkedin_url" text,
	"facebook_url" text,
	"twitter_handle" text,
	"candidate_status" text DEFAULT 'new',
	"source" text DEFAULT 'added-by-user',
	"email_opt_out" boolean DEFAULT false,
	"date_of_birth" date,
	"gender" text,
	"nationality" text,
	"is_willing_to_relocate" boolean DEFAULT false,
	"available_from" date,
	"notes" text,
	"resume_file" jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "recruit_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"client_contact_id" text,
	"first_name" text,
	"last_name" text NOT NULL,
	"client_id" text,
	"department" text,
	"email" text,
	"secondary_email" text,
	"job_title" text,
	"work_phone" text,
	"mobile" text,
	"mailing_street" text,
	"mailing_city" text,
	"mailing_province" text,
	"mailing_postal_code" text,
	"mailing_country" text,
	"other_street" text,
	"other_city" text,
	"other_province" text,
	"other_postal_code" text,
	"other_country" text,
	"linkedin_url" text,
	"facebook_url" text,
	"twitter_handle" text,
	"source" text DEFAULT 'added-by-user',
	"is_primary_contact" boolean DEFAULT false,
	"email_opt_out" boolean DEFAULT false,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" text PRIMARY KEY NOT NULL,
	"interview_name" text NOT NULL,
	"interview_type" text,
	"round" integer,
	"candidate_id" text NOT NULL,
	"client_id" text,
	"job_opening_id" text NOT NULL,
	"interview_from" timestamp with time zone NOT NULL,
	"interview_to" timestamp with time zone NOT NULL,
	"location" text,
	"video_link" text,
	"duration" integer,
	"schedule_comments" text,
	"status" text DEFAULT 'scheduled',
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "job_openings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"client_id" text,
	"contact_id" text,
	"date_opened" date,
	"target_date" date,
	"employment_type" text DEFAULT 'full-time',
	"status" text DEFAULT 'in-progress',
	"hiring_manager" text,
	"experience" text,
	"industry" text,
	"job_function" text,
	"confidential" boolean DEFAULT false,
	"requirements" text,
	"department" text,
	"location" text,
	"country" text,
	"postal_code" text,
	"remote_job" boolean DEFAULT false,
	"number_of_positions" integer DEFAULT 1,
	"revenue_per_position" integer,
	"expected_revenue" integer,
	"actual_revenue" integer,
	"missed_revenue" integer,
	"description" text,
	"salary_min" integer,
	"salary_max" integer,
	"currency" text DEFAULT 'USD',
	"published_at" date,
	"closing_date" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "offer_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"approver_id" text NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"salary" integer,
	"salary_currency" text,
	"salary_period" text,
	"signing_bonus" integer,
	"equity" text,
	"start_date" date,
	"expires_at" date,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"status" text DEFAULT 'draft',
	"approved_by" text,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"website" text,
	"email_opt_out" boolean DEFAULT false,
	"street" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"country" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "offer_approvals" ADD CONSTRAINT "offer_approvals_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_candidate_id_idx" ON "applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "applications_job_opening_id_idx" ON "applications" USING btree ("job_opening_id");--> statement-breakpoint
CREATE INDEX "applications_stage_idx" ON "applications" USING btree ("stage");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_candidate_job_unique_idx" ON "applications" USING btree ("candidate_id","job_opening_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_email_unique" ON "candidates" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "candidates_source_idx" ON "candidates" USING btree ("source");--> statement-breakpoint
CREATE INDEX "candidates_candidate_status_idx" ON "candidates" USING btree ("candidate_status");--> statement-breakpoint
CREATE INDEX "candidates_country_idx" ON "candidates" USING btree ("country");--> statement-breakpoint
CREATE INDEX "candidates_created_by_idx" ON "candidates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "recruit_contacts_client_id_idx" ON "recruit_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "recruit_contacts_email_idx" ON "recruit_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "recruit_contacts_last_name_idx" ON "recruit_contacts" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "recruit_contacts_created_by_idx" ON "recruit_contacts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "recruit_contacts_client_contact_id_idx" ON "recruit_contacts" USING btree ("client_contact_id");--> statement-breakpoint
CREATE INDEX "interviews_candidate_id_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interviews_job_opening_id_idx" ON "interviews" USING btree ("job_opening_id");--> statement-breakpoint
CREATE INDEX "interviews_client_id_idx" ON "interviews" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "interviews_status_idx" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interviews_interview_from_idx" ON "interviews" USING btree ("interview_from");--> statement-breakpoint
CREATE INDEX "interviews_created_by_idx" ON "interviews" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "job_openings_status_idx" ON "job_openings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_openings_department_idx" ON "job_openings" USING btree ("department");--> statement-breakpoint
CREATE INDEX "job_openings_client_id_idx" ON "job_openings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "job_openings_created_by_idx" ON "job_openings" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "offer_approvals_offer_id_idx" ON "offer_approvals" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_approvals_approver_id_idx" ON "offer_approvals" USING btree ("approver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_approvals_offer_approver_unique_idx" ON "offer_approvals" USING btree ("offer_id","approver_id");--> statement-breakpoint
CREATE INDEX "offers_application_id_idx" ON "offers" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "offers_status_idx" ON "offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "offers_start_date_idx" ON "offers" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "vendors_vendor_name_idx" ON "vendors" USING btree ("vendor_name");--> statement-breakpoint
CREATE INDEX "vendors_email_idx" ON "vendors" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vendors_created_by_idx" ON "vendors" USING btree ("created_by");