CREATE UNIQUE INDEX IF NOT EXISTS "offer_approvals_offer_approver_unique_idx" ON "offer_approvals" ("offer_id", "approver_id");
