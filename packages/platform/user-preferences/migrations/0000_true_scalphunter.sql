CREATE TABLE "user_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_ns_key_unique" ON "user_preferences" USING btree ("user_id","namespace","key");--> statement-breakpoint
CREATE INDEX "user_preferences_user_ns_idx" ON "user_preferences" USING btree ("user_id","namespace");