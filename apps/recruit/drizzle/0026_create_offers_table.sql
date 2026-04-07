CREATE TABLE IF NOT EXISTS "offers" (
  "id" text PRIMARY KEY NOT NULL,
  "application_id" text NOT NULL,
  "salary" integer,
  "salary_currency" text,
  "salary_period" text,
  "signing_bonus" integer,
  "equity" text,
  "start_date" date,
  "expires_at" date,
  "sent_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "status" text DEFAULT 'draft',
  "approved_by" text REFERENCES "users"("id"),
  "notes" text,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" text
);

CREATE INDEX "offers_application_id_idx" ON "offers" ("application_id");
CREATE INDEX "offers_status_idx" ON "offers" ("status");
CREATE INDEX "offers_start_date_idx" ON "offers" ("start_date");
