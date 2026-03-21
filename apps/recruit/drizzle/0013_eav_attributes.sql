-- EAV Attributes: dynamic entity fields with configurable layouts

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
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "field_definitions_entity_type_field_key_key" ON "field_definitions" ("entity_type", "field_key");
CREATE INDEX "field_definitions_entity_type_idx" ON "field_definitions" ("entity_type");

CREATE TABLE "picklist_options" (
  "id" text PRIMARY KEY NOT NULL,
  "field_id" text NOT NULL REFERENCES "field_definitions"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "value" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "picklist_options_field_id_value_key" ON "picklist_options" ("field_id", "value");
CREATE INDEX "picklist_options_field_id_idx" ON "picklist_options" ("field_id");

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

CREATE UNIQUE INDEX "layout_sections_entity_layout_name_key" ON "layout_sections" ("entity_type", "layout_name", "name");
CREATE INDEX "layout_sections_entity_type_idx" ON "layout_sections" ("entity_type", "layout_name");

CREATE TABLE "layout_fields" (
  "id" text PRIMARY KEY NOT NULL,
  "section_id" text NOT NULL REFERENCES "layout_sections"("id") ON DELETE CASCADE,
  "field_id" text NOT NULL REFERENCES "field_definitions"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "column_index" integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "layout_fields_section_id_field_id_key" ON "layout_fields" ("section_id", "field_id");
CREATE INDEX "layout_fields_section_id_idx" ON "layout_fields" ("section_id");

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

CREATE UNIQUE INDEX "entity_field_values_entity_field_key" ON "entity_field_values" ("entity_type", "entity_id", "field_key");
CREATE INDEX "entity_field_values_entity_lookup_idx" ON "entity_field_values" ("entity_type", "entity_id");
CREATE INDEX "entity_field_values_text_search_idx" ON "entity_field_values" ("entity_type", "field_key", "value_text");
CREATE INDEX "entity_field_values_number_search_idx" ON "entity_field_values" ("entity_type", "field_key", "value_number");
CREATE INDEX "entity_field_values_date_search_idx" ON "entity_field_values" ("entity_type", "field_key", "value_date");
CREATE INDEX "entity_field_values_boolean_search_idx" ON "entity_field_values" ("entity_type", "field_key", "value_boolean");
