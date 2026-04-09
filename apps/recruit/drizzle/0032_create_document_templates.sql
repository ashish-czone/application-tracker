CREATE TABLE IF NOT EXISTS "document_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "subject" text,
  "html_body" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "metadata" jsonb,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "document_templates_category_idx" ON "document_templates" ("category");
