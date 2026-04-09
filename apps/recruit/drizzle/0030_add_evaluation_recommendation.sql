ALTER TABLE "evaluations" ADD COLUMN "recommendation" text;
ALTER TABLE "evaluation_templates" ADD COLUMN "blinding_enabled" boolean NOT NULL DEFAULT false;
