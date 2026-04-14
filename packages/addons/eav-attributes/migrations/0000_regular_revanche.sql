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
CREATE UNIQUE INDEX "entity_field_values_entity_field_key" ON "entity_field_values" USING btree ("entity_type","entity_id","field_key");--> statement-breakpoint
CREATE INDEX "entity_field_values_entity_lookup_idx" ON "entity_field_values" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_field_values_text_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_text");--> statement-breakpoint
CREATE INDEX "entity_field_values_number_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_number");--> statement-breakpoint
CREATE INDEX "entity_field_values_date_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_date");--> statement-breakpoint
CREATE INDEX "entity_field_values_boolean_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_boolean");