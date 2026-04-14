CREATE TABLE "evaluation_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"evaluation_id" text NOT NULL,
	"criteria_name" text NOT NULL,
	"score" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"blinding_enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"evaluator_id" text NOT NULL,
	"overall_rating" integer NOT NULL,
	"recommendation" text,
	"comment" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_template_id_evaluation_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."evaluation_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluator_id_users_id_fk" FOREIGN KEY ("evaluator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evaluation_scores_evaluation_id_idx" ON "evaluation_scores" USING btree ("evaluation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evaluation_templates_slug_key" ON "evaluation_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "evaluation_templates_entity_type_idx" ON "evaluation_templates" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "evaluations_entity_lookup_idx" ON "evaluations" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "evaluations_template_id_idx" ON "evaluations" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "evaluations_evaluator_id_idx" ON "evaluations" USING btree ("evaluator_id");