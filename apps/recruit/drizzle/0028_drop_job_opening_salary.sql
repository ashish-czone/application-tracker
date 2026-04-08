ALTER TABLE "job_openings" DROP COLUMN IF EXISTS "salary";

DELETE FROM "field_definitions" WHERE "entity_type" = 'job_openings' AND "field_key" = 'salary';
