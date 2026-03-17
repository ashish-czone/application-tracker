-- Workflow state transitions engine tables

CREATE TABLE "workflow_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "entity_type" text NOT NULL,
  "field_name" text NOT NULL,
  "initial_state" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definitions_slug_key" ON "workflow_definitions" USING btree ("slug") WHERE "workflow_definitions"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definitions_entity_type_field_name_key" ON "workflow_definitions" USING btree ("entity_type", "field_name") WHERE "workflow_definitions"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "workflow_definitions_entity_type_idx" ON "workflow_definitions" USING btree ("entity_type");
--> statement-breakpoint

CREATE TABLE "workflow_states" (
  "id" text PRIMARY KEY NOT NULL,
  "workflow_definition_id" text NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "color" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_states_definition_name_key" ON "workflow_states" USING btree ("workflow_definition_id", "name");
--> statement-breakpoint
CREATE INDEX "workflow_states_definition_id_idx" ON "workflow_states" USING btree ("workflow_definition_id");
--> statement-breakpoint

CREATE TABLE "workflow_transitions" (
  "id" text PRIMARY KEY NOT NULL,
  "workflow_definition_id" text NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE CASCADE,
  "from_state_id" text NOT NULL REFERENCES "workflow_states"("id") ON DELETE CASCADE,
  "to_state_id" text NOT NULL REFERENCES "workflow_states"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "required_permissions" jsonb,
  "guard_names" jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_transitions_definition_from_to_key" ON "workflow_transitions" USING btree ("workflow_definition_id", "from_state_id", "to_state_id");
--> statement-breakpoint
CREATE INDEX "workflow_transitions_definition_id_idx" ON "workflow_transitions" USING btree ("workflow_definition_id");
--> statement-breakpoint

CREATE TABLE "workflow_transition_history" (
  "id" text PRIMARY KEY NOT NULL,
  "workflow_definition_id" text NOT NULL REFERENCES "workflow_definitions"("id"),
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "field_name" text NOT NULL,
  "from_state" text NOT NULL,
  "to_state" text NOT NULL,
  "transition_id" text REFERENCES "workflow_transitions"("id") ON DELETE SET NULL,
  "actor_id" text,
  "comment" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "workflow_transition_history_entity_idx" ON "workflow_transition_history" USING btree ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX "workflow_transition_history_definition_id_idx" ON "workflow_transition_history" USING btree ("workflow_definition_id");
--> statement-breakpoint
CREATE INDEX "workflow_transition_history_actor_id_idx" ON "workflow_transition_history" USING btree ("actor_id");
