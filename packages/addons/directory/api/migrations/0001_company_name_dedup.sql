-- Enforce name-based identity dedup on companies. Without this index, two
-- callers racing on `findOrCreate({ name: 'Acme Corp' })` (no website, no
-- linkedin) would each pass lookupByDedupKeys's NULL fallback and insert
-- separate rows — defeating the directory dedup contract.
--
-- The index is partial: deleted and merged rows are excluded so a soft-deleted
-- "Acme Corp" doesn't block creating a fresh one, and a merge-loser doesn't
-- block reviving the canonical winner.
--
-- Drizzle-kit can't emit `WHERE` clauses or `lower(trim(...))` expressions on
-- uniqueIndex from the schema builder, so this migration is hand-written
-- (matches the pattern already in 0000 for website_domain / linkedin_url).

CREATE UNIQUE INDEX "companies_name_lower_uniq"
  ON "companies" USING btree (lower(trim("name")))
  WHERE "deleted_at" IS NULL AND "merged_into_id" IS NULL;
