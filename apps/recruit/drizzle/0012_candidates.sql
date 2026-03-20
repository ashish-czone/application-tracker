-- Recruit: candidates table

CREATE TABLE "candidates" (
  "id" text PRIMARY KEY NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "source" text DEFAULT 'direct',
  "current_company" text,
  "current_title" text,
  "expected_salary" integer,
  "currency" text DEFAULT 'USD',
  "highest_qualification" text,
  "date_of_birth" date,
  "gender" text,
  "nationality" text,
  "address" text,
  "city" text,
  "state" text,
  "country" text,
  "zip_code" text,
  "is_willing_to_relocate" boolean DEFAULT false,
  "available_from" date,
  "linkedin_url" text,
  "notes" text,
  "resume_file" jsonb,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_email_unique" ON "candidates" ("email") WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX "candidates_source_idx" ON "candidates" ("source");
--> statement-breakpoint
CREATE INDEX "candidates_country_idx" ON "candidates" ("country");
--> statement-breakpoint
CREATE INDEX "candidates_created_by_idx" ON "candidates" ("created_by");
