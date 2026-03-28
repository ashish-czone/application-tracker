-- Multi-pipeline support: allow multiple workflow definitions per (entity_type, field_name)

-- Drop the unique constraint on (entity_type, field_name)
DROP INDEX IF EXISTS "workflow_definitions_entity_type_field_name_key";

-- Replace with non-unique index
CREATE INDEX IF NOT EXISTS "workflow_definitions_entity_type_field_name_idx"
  ON "workflow_definitions" ("entity_type", "field_name");

-- Add discriminator columns
ALTER TABLE "workflow_definitions"
  ADD COLUMN "discriminator_key" text,
  ADD COLUMN "discriminator_value" text,
  ADD COLUMN "is_default" boolean NOT NULL DEFAULT true;

-- New table: tracks which pipeline is assigned to each entity record
CREATE TABLE IF NOT EXISTS "entity_pipeline_assignments" (
  "id" text PRIMARY KEY,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "field_name" text NOT NULL,
  "workflow_definition_id" text NOT NULL REFERENCES "workflow_definitions"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "entity_pipeline_assignments_entity_field_key"
  ON "entity_pipeline_assignments" ("entity_type", "entity_id", "field_name");

CREATE INDEX "entity_pipeline_assignments_entity_idx"
  ON "entity_pipeline_assignments" ("entity_type", "entity_id");
