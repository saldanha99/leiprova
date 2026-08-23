CREATE TABLE "exam_editions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_editions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"career_track_id" bigint NOT NULL,
	"specialization_id" bigint,
	"bank_id" bigint NOT NULL,
	"title" text NOT NULL,
	"organizer" text,
	"jurisdiction" text,
	"official_url" text,
	"exam_date" date NOT NULL,
	"published_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_editions_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "exam_editions_status_check" CHECK ("exam_editions"."status" in ('draft', 'scheduled', 'held', 'published', 'canceled', 'archived')),
	CONSTRAINT "exam_editions_public_id_check" CHECK ("exam_editions"."public_id" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "quiz_banks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_banks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_banks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "quiz_banks_slug_check" CHECK ("quiz_banks"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "quiz_career_specializations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_career_specializations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"career_track_id" bigint NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_career_specializations_slug_check" CHECK ("quiz_career_specializations"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "quiz_career_subjects" (
	"career_track_id" bigint NOT NULL,
	"subject_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_career_subjects_pkey" PRIMARY KEY("career_track_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_career_tracks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_career_tracks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"description" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_career_tracks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "quiz_career_tracks_slug_check" CHECK ("quiz_career_tracks"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "quiz_session_answers" (
	"session_id" text NOT NULL,
	"question_id" bigint NOT NULL,
	"selected_option_id" bigint NOT NULL,
	"is_correct" boolean NOT NULL,
	"duration_ms" integer,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_session_answers_pkey" PRIMARY KEY("session_id","question_id"),
	CONSTRAINT "quiz_session_answers_duration_check" CHECK ("quiz_session_answers"."duration_ms" is null or "quiz_session_answers"."duration_ms" between 0 and 3600000)
);
--> statement-breakpoint
CREATE TABLE "quiz_session_questions" (
	"session_id" text NOT NULL,
	"question_id" bigint NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_session_questions_pkey" PRIMARY KEY("session_id","question_id"),
	CONSTRAINT "quiz_session_questions_position_check" CHECK ("quiz_session_questions"."position" >= 1)
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"path" text NOT NULL,
	"career_track_id" bigint,
	"specialization_id" bigint,
	"bank_id" bigint,
	"subject_id" bigint,
	"topic_id" bigint,
	"mode" text NOT NULL,
	"experience" text DEFAULT 'training' NOT NULL,
	"timed" boolean DEFAULT false NOT NULL,
	"exam_scope" text DEFAULT 'latest' NOT NULL,
	"exam_edition_id" bigint,
	"requested_count" smallint NOT NULL,
	"question_count" smallint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_sessions_path_check" CHECK ("quiz_sessions"."path" in ('career', 'bank')),
	CONSTRAINT "quiz_sessions_path_selection_check" CHECK (("quiz_sessions"."path" = 'career' and "quiz_sessions"."career_track_id" is not null)
        or ("quiz_sessions"."path" = 'bank' and "quiz_sessions"."bank_id" is not null)),
	CONSTRAINT "quiz_sessions_specialization_check" CHECK ("quiz_sessions"."specialization_id" is null or "quiz_sessions"."career_track_id" is not null),
	CONSTRAINT "quiz_sessions_topic_check" CHECK ("quiz_sessions"."topic_id" is null or "quiz_sessions"."subject_id" is not null),
	CONSTRAINT "quiz_sessions_mode_check" CHECK ("quiz_sessions"."mode" in ('dry_law', 'previous_exam', 'original_style')),
	CONSTRAINT "quiz_sessions_experience_check" CHECK ("quiz_sessions"."experience" in ('training', 'exam')),
	CONSTRAINT "quiz_sessions_exam_scope_check" CHECK ("quiz_sessions"."exam_scope" in ('latest', 'all')),
	CONSTRAINT "quiz_sessions_exam_edition_check" CHECK ("quiz_sessions"."exam_edition_id" is null or "quiz_sessions"."mode" = 'previous_exam'),
	CONSTRAINT "quiz_sessions_count_check" CHECK ("quiz_sessions"."requested_count" between 1 and 50 and "quiz_sessions"."question_count" between 0 and "quiz_sessions"."requested_count"),
	CONSTRAINT "quiz_sessions_status_check" CHECK ("quiz_sessions"."status" in ('created', 'in_progress', 'completed', 'expired')),
	CONSTRAINT "quiz_sessions_expiry_check" CHECK ("quiz_sessions"."expires_at" > "quiz_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "quiz_subjects" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_subjects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_subjects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "quiz_subjects_slug_check" CHECK ("quiz_subjects"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "quiz_topics" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quiz_topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"subject_id" bigint NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_topics_slug_check" CHECK ("quiz_topics"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_type_check";--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "legal_article_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "subject_id" bigint;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "topic_id" bigint;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "quiz_mode" text DEFAULT 'dry_law' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "style_bank_id" bigint;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "exam_edition_id" bigint;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_title" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_rights_holder" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "license_basis" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "license_reference" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "licensed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "license_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "original_question_number" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "original_booklet" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "authorship_method" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "generator_model" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "prompt_version" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "reviewed_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "user_attempts" ADD COLUMN "quiz_session_id" text;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_career_track_id_quiz_career_tracks_id_fk" FOREIGN KEY ("career_track_id") REFERENCES "public"."quiz_career_tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_specialization_id_quiz_career_specializations_id_fk" FOREIGN KEY ("specialization_id") REFERENCES "public"."quiz_career_specializations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_bank_id_quiz_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."quiz_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_career_specializations" ADD CONSTRAINT "quiz_career_specializations_career_track_id_quiz_career_tracks_id_fk" FOREIGN KEY ("career_track_id") REFERENCES "public"."quiz_career_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_career_subjects" ADD CONSTRAINT "quiz_career_subjects_career_track_id_quiz_career_tracks_id_fk" FOREIGN KEY ("career_track_id") REFERENCES "public"."quiz_career_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_career_subjects" ADD CONSTRAINT "quiz_career_subjects_subject_id_quiz_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."quiz_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_answers" ADD CONSTRAINT "quiz_session_answers_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_answers" ADD CONSTRAINT "quiz_session_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_answers" ADD CONSTRAINT "quiz_session_answers_selected_option_id_question_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."question_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_questions" ADD CONSTRAINT "quiz_session_questions_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_questions" ADD CONSTRAINT "quiz_session_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_career_track_id_quiz_career_tracks_id_fk" FOREIGN KEY ("career_track_id") REFERENCES "public"."quiz_career_tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_specialization_id_quiz_career_specializations_id_fk" FOREIGN KEY ("specialization_id") REFERENCES "public"."quiz_career_specializations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_bank_id_quiz_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."quiz_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_subject_id_quiz_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."quiz_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_topic_id_quiz_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."quiz_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_exam_edition_id_exam_editions_id_fk" FOREIGN KEY ("exam_edition_id") REFERENCES "public"."exam_editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_topics" ADD CONSTRAINT "quiz_topics_subject_id_quiz_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."quiz_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_editions_career_status_date_idx" ON "exam_editions" USING btree ("career_track_id","status","exam_date","id");--> statement-breakpoint
CREATE INDEX "exam_editions_bank_status_date_idx" ON "exam_editions" USING btree ("bank_id","status","exam_date","id");--> statement-breakpoint
CREATE INDEX "exam_editions_specialization_id_idx" ON "exam_editions" USING btree ("specialization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_career_specializations_career_slug_uidx" ON "quiz_career_specializations" USING btree ("career_track_id","slug");--> statement-breakpoint
CREATE INDEX "quiz_career_specializations_career_active_idx" ON "quiz_career_specializations" USING btree ("career_track_id","is_active");--> statement-breakpoint
CREATE INDEX "quiz_career_subjects_subject_id_idx" ON "quiz_career_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "quiz_career_tracks_active_featured_idx" ON "quiz_career_tracks" USING btree ("is_active","featured");--> statement-breakpoint
CREATE INDEX "quiz_session_answers_question_id_idx" ON "quiz_session_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quiz_session_answers_selected_option_id_idx" ON "quiz_session_answers" USING btree ("selected_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_session_questions_session_position_uidx" ON "quiz_session_questions" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "quiz_session_questions_question_id_idx" ON "quiz_session_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_user_created_idx" ON "quiz_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "quiz_sessions_career_track_id_idx" ON "quiz_sessions" USING btree ("career_track_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_specialization_id_idx" ON "quiz_sessions" USING btree ("specialization_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_bank_id_idx" ON "quiz_sessions" USING btree ("bank_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_subject_id_idx" ON "quiz_sessions" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_topic_id_idx" ON "quiz_sessions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_exam_edition_id_idx" ON "quiz_sessions" USING btree ("exam_edition_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_expires_at_idx" ON "quiz_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_topics_subject_slug_uidx" ON "quiz_topics" USING btree ("subject_id","slug");--> statement-breakpoint
CREATE INDEX "quiz_topics_subject_active_idx" ON "quiz_topics" USING btree ("subject_id","is_active");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_quiz_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."quiz_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_quiz_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."quiz_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_style_bank_id_quiz_banks_id_fk" FOREIGN KEY ("style_bank_id") REFERENCES "public"."quiz_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_edition_id_exam_editions_id_fk" FOREIGN KEY ("exam_edition_id") REFERENCES "public"."exam_editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_attempts" ADD CONSTRAINT "user_attempts_quiz_session_id_quiz_sessions_id_fk" FOREIGN KEY ("quiz_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_subject_id_idx" ON "questions" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "questions_topic_id_idx" ON "questions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "questions_style_bank_id_idx" ON "questions" USING btree ("style_bank_id");--> statement-breakpoint
CREATE INDEX "questions_exam_edition_id_idx" ON "questions" USING btree ("exam_edition_id");--> statement-breakpoint
CREATE INDEX "questions_reviewed_by_user_id_idx" ON "questions" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "questions_mode_status_subject_topic_idx" ON "questions" USING btree ("quiz_mode","editorial_status","subject_id","topic_id");--> statement-breakpoint
CREATE INDEX "questions_exam_mode_status_idx" ON "questions" USING btree ("exam_edition_id","quiz_mode","editorial_status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_attempts_quiz_session_question_uidx" ON "user_attempts" USING btree ("quiz_session_id","question_id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_mode_check" CHECK ("questions"."quiz_mode" in ('dry_law', 'previous_exam', 'original_style'));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_authorship_method_check" CHECK ("questions"."authorship_method" in ('human', 'ai_assisted'));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_ai_metadata_check" CHECK ("questions"."authorship_method" <> 'ai_assisted' or (
        nullif(btrim("questions"."generator_model"), '') is not null
        and nullif(btrim("questions"."prompt_version"), '') is not null
      ));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_mode_relations_check" CHECK ((
        "questions"."quiz_mode" = 'dry_law'
        and "questions"."legal_article_id" is not null
        and "questions"."exam_edition_id" is null
        and "questions"."style_bank_id" is null
      ) or (
        "questions"."quiz_mode" = 'original_style'
        and "questions"."subject_id" is not null
        and "questions"."exam_edition_id" is null
        and "questions"."style_bank_id" is not null
        and "questions"."source_rights" = 'original_authorial'
      ) or (
        "questions"."quiz_mode" = 'previous_exam'
        and "questions"."subject_id" is not null
        and "questions"."exam_edition_id" is not null
        and "questions"."style_bank_id" is null
        and "questions"."source_rights" = 'licensed'
      ));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_subject_check" CHECK ("questions"."topic_id" is null or "questions"."subject_id" is not null);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_previous_exam_provenance_check" CHECK ("questions"."quiz_mode" <> 'previous_exam' or (
        nullif(btrim("questions"."source_title"), '') is not null
        and nullif(btrim("questions"."source_url"), '') is not null
        and nullif(btrim("questions"."source_rights_holder"), '') is not null
        and nullif(btrim("questions"."license_basis"), '') is not null
        and nullif(btrim("questions"."license_reference"), '') is not null
        and nullif(btrim("questions"."original_question_number"), '') is not null
        and "questions"."licensed_at" is not null
      ));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_license_period_check" CHECK ("questions"."license_expires_at" is null or "questions"."licensed_at" is null or "questions"."license_expires_at" > "questions"."licensed_at");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewed_provenance_check" CHECK ("questions"."editorial_status" <> 'reviewed' or "questions"."quiz_mode" = 'dry_law' or "questions"."reviewed_by_user_id" is not null);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_type_check" CHECK ("questions"."type" in ('literal_exact', 'cloze', 'altered_word', 'deadline', 'competence', 'true_false', 'multiple_choice'));