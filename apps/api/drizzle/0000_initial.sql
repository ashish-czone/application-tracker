-- ============================================================
-- Initial migration: creates all platform tables from scratch
-- ============================================================

-- ===================
-- 1. USERS (core identity)
-- ===================
CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "user_type" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email") WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- ===================
-- 2. AUTH (credentials + tokens)
-- ===================
CREATE TABLE "credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "provider" text NOT NULL,
  "identifier" text NOT NULL,
  "secret_hash" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "credentials_secret_hash_check" CHECK (
    ("provider" = 'password' AND "secret_hash" IS NOT NULL)
    OR ("provider" != 'password' AND "secret_hash" IS NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_provider_identifier_key" ON "credentials" ("provider", "identifier");
--> statement-breakpoint

CREATE TABLE "auth_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "type" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_type_idx" ON "auth_tokens" ("user_id", "type");
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_token_hash_unique" ON "auth_tokens" ("token_hash");
--> statement-breakpoint

-- ===================
-- 3. RBAC (roles, permissions, assignments)
-- ===================
CREATE TABLE "roles" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "user_type" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_user_type_key" ON "roles" ("name", "user_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "roles_user_type_is_default_key" ON "roles" ("user_type") WHERE "is_default" = true;
--> statement-breakpoint

CREATE TABLE "permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint

CREATE TABLE "role_permissions" (
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" text NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "scope" text NOT NULL DEFAULT 'all',
  PRIMARY KEY ("role_id", "permission_id")
);
--> statement-breakpoint

CREATE TABLE "user_roles" (
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  PRIMARY KEY ("user_id", "role_id")
);
--> statement-breakpoint

-- ===================
-- 4. SETTINGS
-- ===================
CREATE TABLE "settings" (
  "id" text PRIMARY KEY NOT NULL,
  "module" text NOT NULL,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "settings_module_key_key" ON "settings" ("module", "key");
--> statement-breakpoint
CREATE INDEX "settings_module_idx" ON "settings" ("module");
--> statement-breakpoint

-- ===================
-- 5. NOTIFICATIONS
-- ===================
CREATE TABLE "notification_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "channel" text NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE TABLE "notification_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "trigger_type" text NOT NULL DEFAULT 'event',
  "event_name" text,
  "delay_amount" integer,
  "delay_unit" text,
  "schedule_entity_type" text,
  "schedule_date_field" text,
  "schedule_date_operator" text,
  "schedule_date_amount" integer,
  "schedule_date_unit" text,
  "conditions" jsonb,
  "recipient_strategy" text NOT NULL,
  "recipient_config" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "notification_rules_event_name_idx" ON "notification_rules" ("event_name") WHERE "is_active" = true;
--> statement-breakpoint

CREATE TABLE "notification_rule_channels" (
  "rule_id" text NOT NULL REFERENCES "notification_rules"("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "template_id" text NOT NULL REFERENCES "notification_templates"("id"),
  PRIMARY KEY ("rule_id", "channel")
);
--> statement-breakpoint

CREATE TABLE "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "body" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "event_name" text,
  "entity_type" text,
  "entity_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id");
--> statement-breakpoint

CREATE TABLE "notification_preferences" (
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "channel" text NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("user_id", "channel")
);
--> statement-breakpoint

CREATE TABLE "notification_scheduled" (
  "id" text PRIMARY KEY NOT NULL,
  "rule_id" text NOT NULL REFERENCES "notification_rules"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "event_payload" jsonb,
  "scheduled_for" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "notification_scheduled_pending_idx" ON "notification_scheduled" ("scheduled_for") WHERE "sent_at" IS NULL;
--> statement-breakpoint

CREATE TABLE "notification_sent_log" (
  "rule_id" text NOT NULL REFERENCES "notification_rules"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "target_date" date NOT NULL,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_sent_log_dedup_idx" ON "notification_sent_log" ("rule_id", "entity_type", "entity_id", "target_date");
