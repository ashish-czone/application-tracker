-- EAV Attributes: field definitions, picklist options, layout system, field values

CREATE TABLE "field_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "field_key" text NOT NULL,
  "label" text NOT NULL,
  "field_type" text NOT NULL,
  "ui_type" text,
  "is_required" boolean NOT NULL DEFAULT false,
  "is_system" boolean NOT NULL DEFAULT false,
  "is_custom" boolean NOT NULL DEFAULT false,
  "is_unique" boolean NOT NULL DEFAULT false,
  "is_quick_create" boolean NOT NULL DEFAULT false,
  "is_readonly" boolean NOT NULL DEFAULT false,
  "max_length" integer,
  "default_value" text,
  "column_name" text,
  "lookup_entity" text,
  "lookup_label_field" text,
  "lookup_search_fields" text[],
  "tag_group_slug" text,
  "category_group_slug" text,
  "file_accept" text[],
  "file_max_size" integer,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "field_definitions_entity_type_field_key_key" ON "field_definitions" ("entity_type", "field_key");
--> statement-breakpoint
CREATE INDEX "field_definitions_entity_type_idx" ON "field_definitions" ("entity_type");
--> statement-breakpoint
CREATE TABLE "picklist_options" (
  "id" text PRIMARY KEY NOT NULL,
  "field_id" text NOT NULL REFERENCES "field_definitions"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "value" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX "picklist_options_field_id_value_key" ON "picklist_options" ("field_id", "value");
--> statement-breakpoint
CREATE INDEX "picklist_options_field_id_idx" ON "picklist_options" ("field_id");
--> statement-breakpoint
CREATE TABLE "layout_sections" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "layout_name" text NOT NULL DEFAULT 'Standard',
  "name" text NOT NULL,
  "columns" integer NOT NULL DEFAULT 2,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_collapsible" boolean NOT NULL DEFAULT true,
  "is_tabular" boolean NOT NULL DEFAULT false,
  "tabular_max_rows" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "layout_sections_entity_layout_name_key" ON "layout_sections" ("entity_type", "layout_name", "name");
--> statement-breakpoint
CREATE INDEX "layout_sections_entity_type_idx" ON "layout_sections" ("entity_type", "layout_name");
--> statement-breakpoint
CREATE TABLE "layout_fields" (
  "id" text PRIMARY KEY NOT NULL,
  "section_id" text NOT NULL REFERENCES "layout_sections"("id") ON DELETE CASCADE,
  "field_id" text NOT NULL REFERENCES "field_definitions"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "column_index" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX "layout_fields_section_id_field_id_key" ON "layout_fields" ("section_id", "field_id");
--> statement-breakpoint
CREATE INDEX "layout_fields_section_id_idx" ON "layout_fields" ("section_id");
--> statement-breakpoint
CREATE TABLE "entity_field_values" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "field_key" text NOT NULL,
  "value_text" text,
  "value_number" numeric,
  "value_date" date,
  "value_datetime" timestamp with time zone,
  "value_boolean" boolean,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "entity_field_values_entity_field_key" ON "entity_field_values" ("entity_type", "entity_id", "field_key");
--> statement-breakpoint
CREATE INDEX "entity_field_values_entity_lookup_idx" ON "entity_field_values" ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX "entity_field_values_text_search_idx" ON "entity_field_values" ("entity_type", "field_key", "value_text");
--> statement-breakpoint
CREATE INDEX "entity_field_values_number_search_idx" ON "entity_field_values" ("entity_type", "field_key", "value_number");
--> statement-breakpoint
CREATE INDEX "entity_field_values_date_search_idx" ON "entity_field_values" ("entity_type", "field_key", "value_date");
--> statement-breakpoint
CREATE INDEX "entity_field_values_boolean_search_idx" ON "entity_field_values" ("entity_type", "field_key", "value_boolean");
--> statement-breakpoint
-- Entity Relations: multi-value junction table

CREATE TABLE "entity_multi_values" (
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "field_key" text NOT NULL,
  "target_id" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entity_multi_values_entity_type_entity_id_field_key_target_id_pk" PRIMARY KEY("entity_type","entity_id","field_key","target_id")
);
--> statement-breakpoint
CREATE INDEX "emv_entity_lookup_idx" ON "entity_multi_values" USING btree ("entity_type","entity_id","field_key");
--> statement-breakpoint
CREATE INDEX "emv_target_lookup_idx" ON "entity_multi_values" USING btree ("target_id");
--> statement-breakpoint
-- Evaluations: templates, evaluations, scores

CREATE TABLE "evaluation_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "entity_type" text NOT NULL,
  "criteria" jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
  "id" text PRIMARY KEY NOT NULL,
  "template_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "evaluator_id" text NOT NULL,
  "overall_rating" integer NOT NULL,
  "comment" text,
  "submitted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_scores" (
  "id" text PRIMARY KEY NOT NULL,
  "evaluation_id" text NOT NULL,
  "criteria_name" text NOT NULL,
  "score" integer NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_template_id_evaluation_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."evaluation_templates"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluator_id_users_id_fk" FOREIGN KEY ("evaluator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "evaluation_templates_slug_key" ON "evaluation_templates" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "evaluation_templates_entity_type_idx" ON "evaluation_templates" USING btree ("entity_type");
--> statement-breakpoint
CREATE INDEX "evaluations_entity_lookup_idx" ON "evaluations" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX "evaluations_template_id_idx" ON "evaluations" USING btree ("template_id");
--> statement-breakpoint
CREATE INDEX "evaluations_evaluator_id_idx" ON "evaluations" USING btree ("evaluator_id");
--> statement-breakpoint
CREATE INDEX "evaluation_scores_evaluation_id_idx" ON "evaluation_scores" USING btree ("evaluation_id");
--> statement-breakpoint
-- Document Templates

CREATE TABLE IF NOT EXISTS "document_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "subject" text,
  "html_body" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "metadata" jsonb,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_templates_category_idx" ON "document_templates" ("category");
