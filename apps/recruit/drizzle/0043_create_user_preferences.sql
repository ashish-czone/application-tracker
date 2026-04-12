CREATE TABLE "user_preferences" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "namespace" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_ns_key_unique" ON "user_preferences" ("user_id", "namespace", "key");
--> statement-breakpoint
CREATE INDEX "user_preferences_user_ns_idx" ON "user_preferences" ("user_id", "namespace");
