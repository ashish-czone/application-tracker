DROP INDEX IF EXISTS "drafts_created_by_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "drafts_entity_type_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "drafts_user_entity_key_idx";
--> statement-breakpoint
ALTER TABLE "drafts" DROP CONSTRAINT IF EXISTS "drafts_created_by_id_users_id_fk";
--> statement-breakpoint
DROP TABLE IF EXISTS "drafts";
