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
ALTER TABLE "layout_fields" ADD CONSTRAINT "layout_fields_section_id_layout_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."layout_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_fields" ADD CONSTRAINT "layout_fields_field_id_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "layout_fields_section_id_field_id_key" ON "layout_fields" USING btree ("section_id","field_id");--> statement-breakpoint
CREATE INDEX "layout_fields_section_id_idx" ON "layout_fields" USING btree ("section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "layout_sections_entity_layout_name_key" ON "layout_sections" USING btree ("entity_type","layout_name","name");--> statement-breakpoint
CREATE INDEX "layout_sections_entity_type_idx" ON "layout_sections" USING btree ("entity_type","layout_name");