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
CREATE TABLE "picklist_options" (
	"id" text PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "picklist_options" ADD CONSTRAINT "picklist_options_field_id_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_definitions_entity_type_field_key_key" ON "field_definitions" USING btree ("entity_type","field_key");--> statement-breakpoint
CREATE INDEX "field_definitions_entity_type_idx" ON "field_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "picklist_options_field_id_value_key" ON "picklist_options" USING btree ("field_id","value");--> statement-breakpoint
CREATE INDEX "picklist_options_field_id_idx" ON "picklist_options" USING btree ("field_id");