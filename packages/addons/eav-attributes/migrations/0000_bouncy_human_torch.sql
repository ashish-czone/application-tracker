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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"ui_type" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"is_unique" boolean DEFAULT false NOT NULL,
	"is_quick_create" boolean DEFAULT false NOT NULL,
	"is_readonly" boolean DEFAULT false NOT NULL,
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
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layout_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"field_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"column_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layout_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"layout_name" text DEFAULT 'Standard' NOT NULL,
	"name" text NOT NULL,
	"columns" integer DEFAULT 2 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_collapsible" boolean DEFAULT true NOT NULL,
	"is_tabular" boolean DEFAULT false NOT NULL,
	"tabular_max_rows" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "picklist_options" (
	"id" text PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "layout_fields" ADD CONSTRAINT "layout_fields_section_id_layout_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."layout_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_fields" ADD CONSTRAINT "layout_fields_field_id_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picklist_options" ADD CONSTRAINT "picklist_options_field_id_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_field_values_entity_field_key" ON "entity_field_values" USING btree ("entity_type","entity_id","field_key");--> statement-breakpoint
CREATE INDEX "entity_field_values_entity_lookup_idx" ON "entity_field_values" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_field_values_text_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_text");--> statement-breakpoint
CREATE INDEX "entity_field_values_number_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_number");--> statement-breakpoint
CREATE INDEX "entity_field_values_date_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_date");--> statement-breakpoint
CREATE INDEX "entity_field_values_boolean_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_boolean");--> statement-breakpoint
CREATE UNIQUE INDEX "field_definitions_entity_type_field_key_key" ON "field_definitions" USING btree ("entity_type","field_key");--> statement-breakpoint
CREATE INDEX "field_definitions_entity_type_idx" ON "field_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "layout_fields_section_id_field_id_key" ON "layout_fields" USING btree ("section_id","field_id");--> statement-breakpoint
CREATE INDEX "layout_fields_section_id_idx" ON "layout_fields" USING btree ("section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "layout_sections_entity_layout_name_key" ON "layout_sections" USING btree ("entity_type","layout_name","name");--> statement-breakpoint
CREATE INDEX "layout_sections_entity_type_idx" ON "layout_sections" USING btree ("entity_type","layout_name");--> statement-breakpoint
CREATE UNIQUE INDEX "picklist_options_field_id_value_key" ON "picklist_options" USING btree ("field_id","value");--> statement-breakpoint
CREATE INDEX "picklist_options_field_id_idx" ON "picklist_options" USING btree ("field_id");