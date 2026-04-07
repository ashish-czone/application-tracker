-- Add new columns to interviews
ALTER TABLE "interviews" ADD COLUMN "interview_type" text;
ALTER TABLE "interviews" ADD COLUMN "round" integer;
ALTER TABLE "interviews" ADD COLUMN "video_link" text;
ALTER TABLE "interviews" ADD COLUMN "duration" integer;
