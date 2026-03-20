-- Initial recruit database schema
-- Includes shared infrastructure tables + candidates

-- Users (shared, same schema as platform)
CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "first_name" text NOT NULL DEFAULT '',
  "last_name" text NOT NULL DEFAULT '',
  "user_type" text NOT NULL DEFAULT 'client',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone,
  "deleted_by" text
);

CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");

-- Auth: credentials
CREATE TABLE "credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "provider" text NOT NULL,
  "identifier" text NOT NULL,
  "secret_hash" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "credentials_user_id_idx" ON "credentials" ("user_id");
CREATE UNIQUE INDEX "credentials_provider_identifier_key" ON "credentials" ("provider", "identifier");

-- Auth: tokens
CREATE TABLE "tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "token_hash" text NOT NULL,
  "type" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "tokens_user_id_idx" ON "tokens" ("user_id");
CREATE INDEX "tokens_token_hash_idx" ON "tokens" ("token_hash");

-- RBAC: roles
CREATE TABLE "roles" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "user_type" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- RBAC: role_permissions
CREATE TABLE "role_permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission" text NOT NULL,
  "scope" text NOT NULL DEFAULT 'all',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions" ("role_id");
CREATE UNIQUE INDEX "role_permissions_role_id_permission_key" ON "role_permissions" ("role_id", "permission");

-- RBAC: user_roles
CREATE TABLE "user_roles" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles" ("user_id", "role_id");

-- Settings
CREATE TABLE "settings" (
  "id" text PRIMARY KEY NOT NULL,
  "module" text NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_by" text REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "settings_module_key_key" ON "settings" ("module", "key");

-- Notifications
CREATE TABLE "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "channel" text NOT NULL DEFAULT 'in_app',
  "title" text NOT NULL,
  "body" text,
  "data" jsonb,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id");
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications" ("user_id", "read_at");

-- Notification rules
CREATE TABLE "notification_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "trigger_type" text NOT NULL,
  "trigger_event" text,
  "trigger_entity_type" text,
  "trigger_date_field" text,
  "trigger_date_amounts" text,
  "trigger_date_unit" text,
  "trigger_date_operator" text,
  "trigger_schedule_days" text,
  "conditions" jsonb,
  "recipient_strategy" text NOT NULL DEFAULT 'actor',
  "recipient_field" text,
  "recipient_role_id" text,
  "channels" jsonb NOT NULL DEFAULT '[]',
  "template_email_id" text,
  "template_in_app_id" text,
  "template_whatsapp_id" text,
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Notification templates
CREATE TABLE "notification_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "channel" text NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Workflows
CREATE TABLE "workflow_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "entity_type" text NOT NULL,
  "field_name" text NOT NULL,
  "initial_state" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX "workflow_definitions_slug_key" ON "workflow_definitions" ("slug");

CREATE TABLE "workflow_states" (
  "id" text PRIMARY KEY NOT NULL,
  "definition_id" text NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "color" text,
  "is_terminal" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "workflow_transitions" (
  "id" text PRIMARY KEY NOT NULL,
  "definition_id" text NOT NULL REFERENCES "workflow_definitions"("id") ON DELETE CASCADE,
  "from_state_id" text NOT NULL REFERENCES "workflow_states"("id") ON DELETE CASCADE,
  "to_state_id" text NOT NULL REFERENCES "workflow_states"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "guard_names" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Taxonomy
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

-- Audit logs
CREATE TABLE "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "event_name" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "actor_id" text,
  "payload" jsonb,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" ("actor_id");
CREATE INDEX "audit_logs_event_name_idx" ON "audit_logs" ("event_name");

-- Categories (hierarchy)
CREATE TABLE "categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "parent_id" text REFERENCES "categories"("id"),
  "path" text NOT NULL DEFAULT '',
  "depth" integer NOT NULL DEFAULT 0,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- =============================================
-- RECRUIT APP: Candidates
-- =============================================

CREATE TABLE "candidates" (
  "id" text PRIMARY KEY NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "source" text DEFAULT 'direct',
  "current_company" text,
  "current_title" text,
  "expected_salary" integer,
  "currency" text DEFAULT 'USD',
  "highest_qualification" text,
  "date_of_birth" date,
  "gender" text,
  "nationality" text,
  "address" text,
  "city" text,
  "state" text,
  "country" text,
  "zip_code" text,
  "is_willing_to_relocate" boolean DEFAULT false,
  "available_from" date,
  "linkedin_url" text,
  "notes" text,
  "resume_file" jsonb,
  "created_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone,
  "deleted_by" text
);

CREATE UNIQUE INDEX "candidates_email_unique" ON "candidates" ("email") WHERE deleted_at IS NULL;
CREATE INDEX "candidates_source_idx" ON "candidates" ("source");
CREATE INDEX "candidates_country_idx" ON "candidates" ("country");
CREATE INDEX "candidates_created_by_idx" ON "candidates" ("created_by");
