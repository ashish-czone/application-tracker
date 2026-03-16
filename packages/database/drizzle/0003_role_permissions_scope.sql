-- Add scope column to role_permissions (default 'all' for backward compatibility)
ALTER TABLE "role_permissions" ADD COLUMN "scope" text NOT NULL DEFAULT 'all';
