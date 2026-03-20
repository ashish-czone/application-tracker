-- Categories: hierarchical category groups and categories

CREATE TABLE "category_groups" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "category_groups_slug_key" ON "category_groups" ("slug");

CREATE TABLE "categories" (
  "id" text PRIMARY KEY NOT NULL,
  "group_id" text NOT NULL REFERENCES "category_groups"("id") ON DELETE CASCADE,
  "parent_id" text REFERENCES "categories"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "categories_slug_group_id_parent_id_key" ON "categories" ("slug", "group_id", "parent_id");
CREATE INDEX "categories_group_id_idx" ON "categories" ("group_id");
CREATE INDEX "categories_parent_id_idx" ON "categories" ("parent_id");
