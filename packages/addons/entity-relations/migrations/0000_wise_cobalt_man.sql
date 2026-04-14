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
CREATE INDEX "emv_entity_lookup_idx" ON "entity_multi_values" USING btree ("entity_type","entity_id","field_key");--> statement-breakpoint
CREATE INDEX "emv_target_lookup_idx" ON "entity_multi_values" USING btree ("target_id");