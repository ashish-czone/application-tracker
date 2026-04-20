DROP INDEX "roles_name_key";--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "deleted_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_key" ON "roles" USING btree ("name") WHERE deleted_at IS NULL;