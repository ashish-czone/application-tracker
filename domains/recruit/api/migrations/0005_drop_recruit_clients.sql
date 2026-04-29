-- Drop the `recruit_clients` shadow table. The shared identity tables
-- pattern means a recruit client IS a `companies` row with
-- `recruit_became_client_at` set; child tables FK companies.id directly
-- (PR 1181). This migration removes the now-unused shadow.

DROP TABLE IF EXISTS "recruit_clients";
