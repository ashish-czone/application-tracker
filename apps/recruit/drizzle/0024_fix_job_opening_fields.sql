-- Add new columns to job_openings
ALTER TABLE "job_openings" ADD COLUMN "hiring_manager" text REFERENCES "users"("id");
ALTER TABLE "job_openings" ADD COLUMN "job_function" text;
ALTER TABLE "job_openings" ADD COLUMN "confidential" boolean DEFAULT false;
