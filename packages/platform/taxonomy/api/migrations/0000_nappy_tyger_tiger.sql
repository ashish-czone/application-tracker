CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"parent_id" text,
	"path" text DEFAULT '/' NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_tags" (
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_tags_entity_type_entity_id_tag_id_pk" PRIMARY KEY("entity_type","entity_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"allow_multiple" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"tag_group_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tag_group_id_tag_groups_id_fk" FOREIGN KEY ("tag_group_id") REFERENCES "public"."tag_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_group_id_parent_id_key" ON "categories" USING btree ("slug","group_id","parent_id");--> statement-breakpoint
CREATE INDEX "categories_group_id_idx" ON "categories" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_path_idx" ON "categories" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "category_groups_slug_key" ON "category_groups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "entity_tags_entity_lookup_idx" ON "entity_tags" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_tags_tag_id_idx" ON "entity_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_groups_slug_key" ON "tag_groups" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_tag_group_id_key" ON "tags" USING btree ("slug","tag_group_id");