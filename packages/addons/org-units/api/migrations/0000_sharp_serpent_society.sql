CREATE TABLE "org_position_scopes" (
	"position_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"scope" text NOT NULL,
	CONSTRAINT "org_position_scopes_position_id_entity_type_pk" PRIMARY KEY("position_id","entity_type")
);
--> statement-breakpoint
CREATE TABLE "org_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_unit_levels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_unit_members" (
	"org_unit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"position_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_unit_members_org_unit_id_user_id_pk" PRIMARY KEY("org_unit_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "org_units" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"level_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_position_scopes" ADD CONSTRAINT "org_position_scopes_position_id_org_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."org_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_unit_members" ADD CONSTRAINT "org_unit_members_org_unit_id_org_units_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."org_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_unit_members" ADD CONSTRAINT "org_unit_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_unit_members" ADD CONSTRAINT "org_unit_members_position_id_org_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."org_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_id_org_units_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."org_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_level_id_org_unit_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."org_unit_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_units_parent_id_idx" ON "org_units" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "org_units_level_id_idx" ON "org_units" USING btree ("level_id");