ALTER TABLE "questions" DROP CONSTRAINT "questions_ai_metadata_check";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_authorship_method_check";--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD COLUMN "created_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_requirements_source_text_uidx" ON "opportunity_requirements" USING btree ("source_document_id","requirement_text");--> statement-breakpoint
CREATE INDEX "opportunity_requirements_created_by_idx" ON "opportunity_requirements" USING btree ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_independent_review_check" CHECK ("opportunity_requirements"."editorial_status" <> 'reviewed'
        or "opportunity_requirements"."created_by_user_id" is null
        or "opportunity_requirements"."reviewed_by_user_id" <> "opportunity_requirements"."created_by_user_id");--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_review_notes_check" CHECK ("opportunity_requirements"."review_notes" is null or char_length("opportunity_requirements"."review_notes") <= 1500);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_generator_metadata_check" CHECK ("questions"."authorship_method" = 'human' or (
        nullif(btrim("questions"."generator_model"), '') is not null
        and nullif(btrim("questions"."prompt_version"), '') is not null
      ));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_authorship_method_check" CHECK ("questions"."authorship_method" in ('human', 'ai_assisted', 'rule_based'));