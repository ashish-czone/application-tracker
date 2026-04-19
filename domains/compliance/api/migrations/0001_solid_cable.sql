ALTER TABLE "compliance_rules" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_rules" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_rules_code_key" ON "compliance_rules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "compliance_rules_status_idx" ON "compliance_rules" USING btree ("status");