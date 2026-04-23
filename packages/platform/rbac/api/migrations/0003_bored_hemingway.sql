CREATE TABLE "role_permission_scopes" (
	"role_id" text NOT NULL,
	"permission" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_params" jsonb,
	CONSTRAINT "role_permission_scopes_role_id_permission_scope_type_pk" PRIMARY KEY("role_id","permission","scope_type")
);
--> statement-breakpoint
ALTER TABLE "role_permission_scopes" ADD CONSTRAINT "role_permission_scopes_grant_fk" FOREIGN KEY ("role_id","permission") REFERENCES "public"."role_permissions"("role_id","permission") ON DELETE cascade ON UPDATE no action;