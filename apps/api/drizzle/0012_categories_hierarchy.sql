-- Add materialized path columns to categories for efficient tree queries

ALTER TABLE "categories" ADD COLUMN "path" text NOT NULL DEFAULT '/';
ALTER TABLE "categories" ADD COLUMN "depth" integer NOT NULL DEFAULT 0;
CREATE INDEX "categories_path_idx" ON "categories" ("path");

-- Backfill path and depth for existing rows using a recursive CTE
WITH RECURSIVE tree AS (
  -- Root categories (no parent)
  SELECT id, parent_id, '/' || id AS path, 0 AS depth
  FROM categories
  WHERE parent_id IS NULL

  UNION ALL

  -- Children: append their id to parent's path
  SELECT c.id, c.parent_id, t.path || '/' || c.id AS path, t.depth + 1 AS depth
  FROM categories c
  INNER JOIN tree t ON c.parent_id = t.id
)
UPDATE categories
SET path = tree.path, depth = tree.depth
FROM tree
WHERE categories.id = tree.id;