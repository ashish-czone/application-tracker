CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"user_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"identifier" text NOT NULL,
	"secret_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "credentials_secret_hash_check" CHECK (("credentials"."provider" = 'password' AND "credentials"."secret_hash" IS NOT NULL) OR ("credentials"."provider" != 'password' AND "credentials"."secret_hash" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission" text NOT NULL,
	"scope" text DEFAULT 'all' NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_type" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"module" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "notification_preferences_user_id_channel_pk" PRIMARY KEY("user_id","channel")
);
--> statement-breakpoint
CREATE TABLE "notification_rule_channels" (
	"rule_id" text NOT NULL,
	"channel" text NOT NULL,
	"template_id" text NOT NULL,
	CONSTRAINT "notification_rule_channels_rule_id_channel_pk" PRIMARY KEY("rule_id","channel")
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text DEFAULT 'event' NOT NULL,
	"event_name" text,
	"delay_amount" integer,
	"delay_unit" text,
	"schedule_entity_type" text,
	"schedule_date_field" text,
	"schedule_date_operator" text,
	"schedule_date_amounts" jsonb,
	"schedule_date_unit" text,
	"schedule_days_of_week" jsonb,
	"conditions" jsonb,
	"recipient_strategy" text NOT NULL,
	"recipient_config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_scheduled" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"event_payload" jsonb,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_sent_log" (
	"rule_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"target_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"event_name" text,
	"entity_type" text,
	"entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"field_name" text NOT NULL,
	"initial_state" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_states" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_definition_id" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_transition_history" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_definition_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_name" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"transition_id" text,
	"actor_id" text,
	"comment" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_definition_id" text NOT NULL,
	"from_state_id" text NOT NULL,
	"to_state_id" text NOT NULL,
	"name" text NOT NULL,
	"required_permissions" jsonb,
	"guard_names" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"event_name" text NOT NULL,
	"actor_id" text,
	"before" jsonb,
	"after" jsonb,
	"changes" jsonb,
	"correlation_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_field_values" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_key" text NOT NULL,
	"value_text" text,
	"value_number" numeric,
	"value_date" date,
	"value_datetime" timestamp with time zone,
	"value_boolean" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"ui_type" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"is_unique" boolean DEFAULT false NOT NULL,
	"is_quick_create" boolean DEFAULT false NOT NULL,
	"is_readonly" boolean DEFAULT false NOT NULL,
	"max_length" integer,
	"default_value" text,
	"column_name" text,
	"lookup_entity" text,
	"lookup_label_field" text,
	"lookup_search_fields" text[],
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layout_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"field_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"column_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layout_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"layout_name" text DEFAULT 'Standard' NOT NULL,
	"name" text NOT NULL,
	"columns" integer DEFAULT 2 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_collapsible" boolean DEFAULT true NOT NULL,
	"is_tabular" boolean DEFAULT false NOT NULL,
	"tabular_max_rows" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "picklist_options" (
	"id" text PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"parent_client_id" text,
	"contact_number" text,
	"fax" text,
	"website" text,
	"industry" text,
	"about" text,
	"source" text DEFAULT 'added-by-user',
	"billing_street" text,
	"billing_city" text,
	"billing_province" text,
	"billing_code" text,
	"billing_country" text,
	"shipping_street" text,
	"shipping_city" text,
	"shipping_province" text,
	"shipping_code" text,
	"shipping_country" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text NOT NULL,
	"client_id" text,
	"department" text,
	"email" text,
	"secondary_email" text,
	"job_title" text,
	"work_phone" text,
	"mobile" text,
	"fax" text,
	"skype_id" text,
	"mailing_street" text,
	"mailing_city" text,
	"mailing_province" text,
	"mailing_postal_code" text,
	"mailing_country" text,
	"other_street" text,
	"other_city" text,
	"other_province" text,
	"other_postal_code" text,
	"other_country" text,
	"linkedin_url" text,
	"facebook_url" text,
	"twitter_handle" text,
	"source" text DEFAULT 'added-by-user',
	"is_primary_contact" boolean DEFAULT false,
	"email_opt_out" boolean DEFAULT false,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"website" text,
	"email_opt_out" boolean DEFAULT false,
	"street" text,
	"city" text,
	"province" text,
	"postal_code" text,
	"country" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"mobile" text,
	"website" text,
	"secondary_email" text,
	"fax" text,
	"street" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"experience_in_years" numeric,
	"highest_qualification" text,
	"current_title" text,
	"current_company" text,
	"expected_salary" integer,
	"current_salary" integer,
	"currency" text DEFAULT 'USD',
	"skill_set" text,
	"additional_info" text,
	"skype_id" text,
	"linkedin_url" text,
	"facebook_url" text,
	"twitter_handle" text,
	"candidate_status" text DEFAULT 'new',
	"source" text DEFAULT 'added-by-user',
	"email_opt_out" boolean DEFAULT false,
	"date_of_birth" date,
	"gender" text,
	"nationality" text,
	"is_willing_to_relocate" boolean DEFAULT false,
	"available_from" date,
	"notes" text,
	"resume_file" jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "job_openings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"client_id" text,
	"contact_id" text,
	"date_opened" date,
	"target_date" date,
	"employment_type" text DEFAULT 'full-time',
	"status" text DEFAULT 'in-progress',
	"experience" text,
	"industry" text,
	"requirements" text,
	"salary" text,
	"department" text,
	"location" text,
	"country" text,
	"postal_code" text,
	"remote_job" boolean DEFAULT false,
	"number_of_positions" integer DEFAULT 1,
	"revenue_per_position" integer,
	"expected_revenue" integer,
	"actual_revenue" integer,
	"missed_revenue" integer,
	"description" text,
	"salary_min" integer,
	"salary_max" integer,
	"currency" text DEFAULT 'USD',
	"published_at" date,
	"closing_date" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"candidate_id" text NOT NULL,
	"job_opening_id" text NOT NULL,
	"status" text DEFAULT 'applied',
	"stage" text DEFAULT 'new',
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" text PRIMARY KEY NOT NULL,
	"interview_name" text NOT NULL,
	"candidate_id" text NOT NULL,
	"client_id" text,
	"job_opening_id" text NOT NULL,
	"interview_from" timestamp with time zone NOT NULL,
	"interview_to" timestamp with time zone NOT NULL,
	"location" text,
	"schedule_comments" text,
	"status" text DEFAULT 'scheduled',
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rule_channels" ADD CONSTRAINT "notification_rule_channels_rule_id_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rule_channels" ADD CONSTRAINT "notification_rule_channels_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_scheduled" ADD CONSTRAINT "notification_scheduled_rule_id_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_sent_log" ADD CONSTRAINT "notification_sent_log_rule_id_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transition_history" ADD CONSTRAINT "workflow_transition_history_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transition_history" ADD CONSTRAINT "workflow_transition_history_transition_id_workflow_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."workflow_transitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_state_id_workflow_states_id_fk" FOREIGN KEY ("from_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_state_id_workflow_states_id_fk" FOREIGN KEY ("to_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tag_group_id_tag_groups_id_fk" FOREIGN KEY ("tag_group_id") REFERENCES "public"."tag_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_fields" ADD CONSTRAINT "layout_fields_section_id_layout_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."layout_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_fields" ADD CONSTRAINT "layout_fields_field_id_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picklist_options" ADD CONSTRAINT "picklist_options_field_id_field_definitions_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_type_idx" ON "auth_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_token_hash_unique" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_provider_identifier_key" ON "credentials" USING btree ("provider","identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_user_type_key" ON "roles" USING btree ("name","user_type");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_module_key_key" ON "settings" USING btree ("module","key");--> statement-breakpoint
CREATE INDEX "settings_module_idx" ON "settings" USING btree ("module");--> statement-breakpoint
CREATE INDEX "notification_scheduled_pending_idx" ON "notification_scheduled" USING btree ("scheduled_for") WHERE sent_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_sent_log_dedup_idx" ON "notification_sent_log" USING btree ("rule_id","entity_type","entity_id","target_date");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definitions_slug_key" ON "workflow_definitions" USING btree ("slug") WHERE "workflow_definitions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definitions_entity_type_field_name_key" ON "workflow_definitions" USING btree ("entity_type","field_name") WHERE "workflow_definitions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "workflow_definitions_entity_type_idx" ON "workflow_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_states_definition_name_key" ON "workflow_states" USING btree ("workflow_definition_id","name");--> statement-breakpoint
CREATE INDEX "workflow_states_definition_id_idx" ON "workflow_states" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "workflow_transition_history_entity_idx" ON "workflow_transition_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "workflow_transition_history_definition_id_idx" ON "workflow_transition_history" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "workflow_transition_history_actor_id_idx" ON "workflow_transition_history" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_transitions_definition_from_to_key" ON "workflow_transitions" USING btree ("workflow_definition_id","from_state_id","to_state_id");--> statement-breakpoint
CREATE INDEX "workflow_transitions_definition_id_idx" ON "workflow_transitions" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_group_id_parent_id_key" ON "categories" USING btree ("slug","group_id","parent_id");--> statement-breakpoint
CREATE INDEX "categories_group_id_idx" ON "categories" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_path_idx" ON "categories" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "category_groups_slug_key" ON "category_groups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "entity_tags_entity_lookup_idx" ON "entity_tags" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_tags_tag_id_idx" ON "entity_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_groups_slug_key" ON "tag_groups" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_tag_group_id_key" ON "tags" USING btree ("slug","tag_group_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_event_name_idx" ON "audit_logs" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_field_values_entity_field_key" ON "entity_field_values" USING btree ("entity_type","entity_id","field_key");--> statement-breakpoint
CREATE INDEX "entity_field_values_entity_lookup_idx" ON "entity_field_values" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "entity_field_values_text_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_text");--> statement-breakpoint
CREATE INDEX "entity_field_values_number_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_number");--> statement-breakpoint
CREATE INDEX "entity_field_values_date_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_date");--> statement-breakpoint
CREATE INDEX "entity_field_values_boolean_search_idx" ON "entity_field_values" USING btree ("entity_type","field_key","value_boolean");--> statement-breakpoint
CREATE UNIQUE INDEX "field_definitions_entity_type_field_key_key" ON "field_definitions" USING btree ("entity_type","field_key");--> statement-breakpoint
CREATE INDEX "field_definitions_entity_type_idx" ON "field_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "layout_fields_section_id_field_id_key" ON "layout_fields" USING btree ("section_id","field_id");--> statement-breakpoint
CREATE INDEX "layout_fields_section_id_idx" ON "layout_fields" USING btree ("section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "layout_sections_entity_layout_name_key" ON "layout_sections" USING btree ("entity_type","layout_name","name");--> statement-breakpoint
CREATE INDEX "layout_sections_entity_type_idx" ON "layout_sections" USING btree ("entity_type","layout_name");--> statement-breakpoint
CREATE UNIQUE INDEX "picklist_options_field_id_value_key" ON "picklist_options" USING btree ("field_id","value");--> statement-breakpoint
CREATE INDEX "picklist_options_field_id_idx" ON "picklist_options" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "clients_client_name_idx" ON "clients" USING btree ("client_name");--> statement-breakpoint
CREATE INDEX "clients_industry_idx" ON "clients" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "clients_created_by_idx" ON "clients" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "contacts_client_id_idx" ON "contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contacts_last_name_idx" ON "contacts" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "contacts_created_by_idx" ON "contacts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "vendors_vendor_name_idx" ON "vendors" USING btree ("vendor_name");--> statement-breakpoint
CREATE INDEX "vendors_email_idx" ON "vendors" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vendors_created_by_idx" ON "vendors" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_email_unique" ON "candidates" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "candidates_source_idx" ON "candidates" USING btree ("source");--> statement-breakpoint
CREATE INDEX "candidates_candidate_status_idx" ON "candidates" USING btree ("candidate_status");--> statement-breakpoint
CREATE INDEX "candidates_country_idx" ON "candidates" USING btree ("country");--> statement-breakpoint
CREATE INDEX "candidates_created_by_idx" ON "candidates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "job_openings_status_idx" ON "job_openings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_openings_department_idx" ON "job_openings" USING btree ("department");--> statement-breakpoint
CREATE INDEX "job_openings_client_id_idx" ON "job_openings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "job_openings_created_by_idx" ON "job_openings" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "applications_candidate_id_idx" ON "applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "applications_job_opening_id_idx" ON "applications" USING btree ("job_opening_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interviews_candidate_id_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interviews_job_opening_id_idx" ON "interviews" USING btree ("job_opening_id");--> statement-breakpoint
CREATE INDEX "interviews_client_id_idx" ON "interviews" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "interviews_status_idx" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interviews_interview_from_idx" ON "interviews" USING btree ("interview_from");--> statement-breakpoint
CREATE INDEX "interviews_created_by_idx" ON "interviews" USING btree ("created_by");