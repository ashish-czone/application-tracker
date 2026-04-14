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
CREATE UNIQUE INDEX "settings_module_key_key" ON "settings" USING btree ("module","key");--> statement-breakpoint
CREATE INDEX "settings_module_idx" ON "settings" USING btree ("module");