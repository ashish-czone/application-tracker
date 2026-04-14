-- Compliance domain tables + shared tasks.external_key for idempotent recurring generators.
-- Runs in both recruit and compliance DBs (shared migration set is accepted tech debt).

CREATE TABLE "compliance_laws" (
  "id" text PRIMARY KEY NOT NULL,
  "parent_id" text,
  "path" text NOT NULL DEFAULT '/',
  "depth" integer NOT NULL DEFAULT 0,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "issuing_authority" text,
  "jurisdiction" text,
  "effective_from" date,
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "compliance_laws"
  ADD CONSTRAINT "compliance_laws_parent_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "compliance_laws"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_laws_code_key" ON "compliance_laws" ("code");
--> statement-breakpoint
CREATE INDEX "compliance_laws_parent_id_idx" ON "compliance_laws" ("parent_id");
--> statement-breakpoint
CREATE INDEX "compliance_laws_path_idx" ON "compliance_laws" ("path");
--> statement-breakpoint

CREATE TABLE "compliance_clients" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "legal_name" text,
  "primary_contact_email" text,
  "tax_identifier" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_clients_tax_identifier_key"
  ON "compliance_clients" ("tax_identifier")
  WHERE "tax_identifier" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE "compliance_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "law_id" text NOT NULL REFERENCES "compliance_laws"("id") ON DELETE CASCADE,
  "frequency" text NOT NULL,
  "due_day_of_month" integer NOT NULL,
  "due_month_offset" integer NOT NULL DEFAULT 0,
  "grace_period_days" integer NOT NULL DEFAULT 0,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "compliance_rules_frequency_check"
    CHECK ("frequency" IN ('monthly', 'quarterly', 'half_yearly', 'yearly')),
  CONSTRAINT "compliance_rules_due_day_check"
    CHECK ("due_day_of_month" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE INDEX "compliance_rules_law_id_idx" ON "compliance_rules" ("law_id");
--> statement-breakpoint
CREATE INDEX "compliance_rules_active_idx" ON "compliance_rules" ("active");
--> statement-breakpoint

CREATE TABLE "compliance_law_handlers" (
  "id" text PRIMARY KEY NOT NULL,
  "law_id" text NOT NULL REFERENCES "compliance_laws"("id") ON DELETE CASCADE,
  "org_entity_id" text NOT NULL REFERENCES "org_units"("id") ON DELETE CASCADE,
  "client_id" text REFERENCES "compliance_clients"("id") ON DELETE CASCADE,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- NULLs compare as distinct in unique indexes, so (law_id, org_entity_id, NULL)
-- is considered unique per (law_id, org_entity_id) pair. Use COALESCE to treat
-- NULL clients as a single logical slot.
CREATE UNIQUE INDEX "compliance_law_handlers_law_org_client_key"
  ON "compliance_law_handlers" ("law_id", "org_entity_id", COALESCE("client_id", ''));
--> statement-breakpoint
CREATE INDEX "compliance_law_handlers_law_id_idx" ON "compliance_law_handlers" ("law_id");
--> statement-breakpoint
CREATE INDEX "compliance_law_handlers_client_id_idx" ON "compliance_law_handlers" ("client_id");
--> statement-breakpoint

CREATE TABLE "compliance_client_laws" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "compliance_clients"("id") ON DELETE CASCADE,
  "law_id" text NOT NULL REFERENCES "compliance_laws"("id") ON DELETE CASCADE,
  "registered_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deactivated_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_client_laws_active_key"
  ON "compliance_client_laws" ("client_id", "law_id")
  WHERE "deactivated_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "compliance_client_laws_client_id_idx" ON "compliance_client_laws" ("client_id");
--> statement-breakpoint
CREATE INDEX "compliance_client_laws_law_id_idx" ON "compliance_client_laws" ("law_id");
--> statement-breakpoint

-- Shared tasks table: idempotency key for recurring generators (compliance,
-- subscriptions, renewals, etc.). Nullable; generators set it, ad-hoc tasks leave it blank.
ALTER TABLE "tasks" ADD COLUMN "external_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_related_external_key_key"
  ON "tasks" ("related_entity_type", "related_entity_id", "external_key")
  WHERE "external_key" IS NOT NULL;
