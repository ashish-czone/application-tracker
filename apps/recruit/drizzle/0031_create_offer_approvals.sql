CREATE TABLE IF NOT EXISTS "offer_approvals" (
  "id" text PRIMARY KEY NOT NULL,
  "offer_id" text NOT NULL REFERENCES "offers"("id") ON DELETE CASCADE,
  "approver_id" text NOT NULL REFERENCES "users"("id"),
  "decision" text NOT NULL DEFAULT 'pending',
  "comment" text,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "offer_approvals_offer_id_idx" ON "offer_approvals" ("offer_id");
CREATE INDEX IF NOT EXISTS "offer_approvals_approver_id_idx" ON "offer_approvals" ("approver_id");
