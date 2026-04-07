-- Add new candidate fields
ALTER TABLE "candidates" ADD COLUMN "notice_period" text;
ALTER TABLE "candidates" ADD COLUMN "salary_expectation_min" integer;
ALTER TABLE "candidates" ADD COLUMN "salary_expectation_max" integer;
