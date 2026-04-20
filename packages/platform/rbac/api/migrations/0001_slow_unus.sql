DROP INDEX "roles_name_user_type_key";--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "user_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_key" ON "roles" USING btree ("name");