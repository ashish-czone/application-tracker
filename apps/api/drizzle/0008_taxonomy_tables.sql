-- Taxonomy: tag groups, tags, and polymorphic entity-tag attachments

CREATE TABLE "tag_groups" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "allow_multiple" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "tag_groups_slug_key" ON "tag_groups" ("slug");

CREATE TABLE "tags" (
  "id" text PRIMARY KEY NOT NULL,
  "tag_group_id" text NOT NULL REFERENCES "tag_groups"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "color" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "tags_slug_tag_group_id_key" ON "tags" ("slug", "tag_group_id");

CREATE TABLE "entity_tags" (
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "tag_id" text NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("entity_type", "entity_id", "tag_id")
);

CREATE INDEX "entity_tags_entity_lookup_idx" ON "entity_tags" ("entity_type", "entity_id");
CREATE INDEX "entity_tags_tag_id_idx" ON "entity_tags" ("tag_id");
