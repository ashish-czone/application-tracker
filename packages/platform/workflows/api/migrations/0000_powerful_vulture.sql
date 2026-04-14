CREATE TABLE "entity_pipeline_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_name" text NOT NULL,
	"workflow_definition_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"field_name" text NOT NULL,
	"initial_state" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"discriminator_key" text,
	"discriminator_value" text,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_states" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_definition_id" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_transition_history" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_definition_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_name" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"transition_id" text,
	"actor_id" text,
	"reason" text,
	"comment" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_definition_id" text NOT NULL,
	"from_state_id" text NOT NULL,
	"to_state_id" text NOT NULL,
	"name" text NOT NULL,
	"required_permissions" jsonb,
	"guard_names" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"reason_options" jsonb,
	"reason_required" boolean DEFAULT false NOT NULL,
	"comment_required" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_pipeline_assignments" ADD CONSTRAINT "entity_pipeline_assignments_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transition_history" ADD CONSTRAINT "workflow_transition_history_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transition_history" ADD CONSTRAINT "workflow_transition_history_transition_id_workflow_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."workflow_transitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_state_id_workflow_states_id_fk" FOREIGN KEY ("from_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_state_id_workflow_states_id_fk" FOREIGN KEY ("to_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_pipeline_assignments_entity_field_key" ON "entity_pipeline_assignments" USING btree ("entity_type","entity_id","field_name");--> statement-breakpoint
CREATE INDEX "entity_pipeline_assignments_entity_idx" ON "entity_pipeline_assignments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definitions_slug_key" ON "workflow_definitions" USING btree ("slug") WHERE "workflow_definitions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "workflow_definitions_entity_type_field_name_idx" ON "workflow_definitions" USING btree ("entity_type","field_name");--> statement-breakpoint
CREATE INDEX "workflow_definitions_entity_type_idx" ON "workflow_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_states_definition_name_key" ON "workflow_states" USING btree ("workflow_definition_id","name");--> statement-breakpoint
CREATE INDEX "workflow_states_definition_id_idx" ON "workflow_states" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "workflow_transition_history_entity_idx" ON "workflow_transition_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "workflow_transition_history_definition_id_idx" ON "workflow_transition_history" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "workflow_transition_history_actor_id_idx" ON "workflow_transition_history" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_transitions_definition_from_to_key" ON "workflow_transitions" USING btree ("workflow_definition_id","from_state_id","to_state_id");--> statement-breakpoint
CREATE INDEX "workflow_transitions_definition_id_idx" ON "workflow_transitions" USING btree ("workflow_definition_id");