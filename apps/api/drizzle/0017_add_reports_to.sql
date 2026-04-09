ALTER TABLE "users" ADD COLUMN "reports_to" TEXT;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reports_to_fk" FOREIGN KEY ("reports_to") REFERENCES "users"("id");
--> statement-breakpoint
CREATE INDEX "users_reports_to_idx" ON "users" ("reports_to");
