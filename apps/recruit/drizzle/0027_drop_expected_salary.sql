ALTER TABLE "candidates" DROP COLUMN IF EXISTS "expected_salary";

-- Also clean up the field definition so it doesn't linger as an orphaned record
DELETE FROM "field_definitions" WHERE "entity_type" = 'candidates' AND "field_key" = 'expectedSalary';
