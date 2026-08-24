CREATE TABLE "question_style_profiles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_style_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"quiz_bank_id" bigint NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"format" text NOT NULL,
	"command_style" text NOT NULL,
	"reasoning_demand" text NOT NULL,
	"authoring_guidelines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"distractor_guidance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prohibited_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disclaimer" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_style_profiles_quiz_bank_id_unique" UNIQUE("quiz_bank_id"),
	CONSTRAINT "question_style_profiles_version_check" CHECK ("question_style_profiles"."version" >= 1),
	CONSTRAINT "question_style_profiles_format_check" CHECK ("question_style_profiles"."format" in ('multiple_choice', 'true_false')),
	CONSTRAINT "question_style_profiles_disclaimer_check" CHECK (char_length(btrim("question_style_profiles"."disclaimer")) between 20 and 500)
);
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_mode_relations_check";--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "learning_objective" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "created_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "clean_room_attested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "question_style_profiles" ADD CONSTRAINT "question_style_profiles_quiz_bank_id_quiz_banks_id_fk" FOREIGN KEY ("quiz_bank_id") REFERENCES "public"."quiz_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_style_profiles" ADD CONSTRAINT "question_style_profiles_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_style_profiles_active_idx" ON "question_style_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "question_style_profiles_updated_by_idx" ON "question_style_profiles" USING btree ("updated_by_user_id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_created_by_user_id_idx" ON "questions" USING btree ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_independent_review_check" CHECK ("questions"."editorial_status" <> 'reviewed'
        or "questions"."quiz_mode" <> 'original_style'
        or "questions"."reviewed_by_user_id" <> "questions"."created_by_user_id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_submission_check" CHECK ("questions"."editorial_status" not in ('pending_review', 'reviewed')
        or "questions"."quiz_mode" <> 'original_style'
        or "questions"."submitted_at" is not null);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_review_notes_check" CHECK ("questions"."review_notes" is null or char_length("questions"."review_notes") <= 1500);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_mode_relations_check" CHECK ((
        "questions"."quiz_mode" = 'dry_law'
        and "questions"."legal_article_id" is not null
        and "questions"."exam_edition_id" is null
        and "questions"."style_bank_id" is null
      ) or (
        "questions"."quiz_mode" = 'original_style'
        and "questions"."legal_article_id" is not null
        and "questions"."subject_id" is not null
        and "questions"."exam_edition_id" is null
        and "questions"."style_bank_id" is not null
        and "questions"."source_rights" = 'original_authorial'
        and nullif(btrim("questions"."learning_objective"), '') is not null
        and "questions"."created_by_user_id" is not null
        and "questions"."clean_room_attested_at" is not null
      ) or (
        "questions"."quiz_mode" = 'previous_exam'
        and "questions"."subject_id" is not null
        and "questions"."exam_edition_id" is not null
        and "questions"."style_bank_id" is null
        and "questions"."source_rights" = 'licensed'
      ));