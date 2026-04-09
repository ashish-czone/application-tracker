ALTER TABLE "candidates" DROP COLUMN IF EXISTS "fax";
--> statement-breakpoint
ALTER TABLE "candidates" DROP COLUMN IF EXISTS "skype_id";
--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "fax";
--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "skype_id";
--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN IF EXISTS "fax";
