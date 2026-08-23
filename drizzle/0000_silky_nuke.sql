CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" bigint,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"plan_id" bigint NOT NULL,
	"provider_session_id" text,
	"status" text DEFAULT 'created' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_attempts_provider_session_id_unique" UNIQUE("provider_session_id"),
	CONSTRAINT "checkout_attempts_status_check" CHECK ("checkout_attempts"."status" in ('created', 'session_created', 'completed', 'expired', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "legal_acts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legal_acts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_title" text NOT NULL,
	"act_type" text NOT NULL,
	"act_number" text,
	"act_year" integer,
	"jurisdiction" text DEFAULT 'federal' NOT NULL,
	"urn" text,
	"official_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_acts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "legal_acts_urn_unique" UNIQUE("urn"),
	CONSTRAINT "legal_acts_year_check" CHECK ("legal_acts"."act_year" is null or "legal_acts"."act_year" between 1800 and 2200)
);
--> statement-breakpoint
CREATE TABLE "legal_articles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legal_articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legal_version_id" bigint NOT NULL,
	"article_ref" text NOT NULL,
	"article_order" integer NOT NULL,
	"heading" text,
	"path" text NOT NULL,
	"literal_text" text NOT NULL,
	"editorial_status" text DEFAULT 'reviewed' NOT NULL,
	"source_rights" text DEFAULT 'official_text' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_articles_editorial_status_check" CHECK ("legal_articles"."editorial_status" in ('draft', 'pending_review', 'reviewed', 'suspended')),
	CONSTRAINT "legal_articles_source_rights_check" CHECK ("legal_articles"."source_rights" in ('official_text', 'original_authorial', 'licensed'))
);
--> statement-breakpoint
CREATE TABLE "legal_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legal_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"legal_act_id" bigint NOT NULL,
	"source_url" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"published_at" timestamp with time zone,
	"valid_from" date,
	"valid_until" date,
	"verified_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_versions_status_check" CHECK ("legal_versions"."status" in ('draft', 'current', 'superseded', 'revoked', 'pending_review')),
	CONSTRAINT "legal_versions_date_range_check" CHECK ("legal_versions"."valid_until" is null or "legal_versions"."valid_from" is null or "legal_versions"."valid_until" >= "legal_versions"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"billing_type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'brl' NOT NULL,
	"stripe_price_id" text,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug"),
	CONSTRAINT "plans_stripe_price_id_unique" UNIQUE("stripe_price_id"),
	CONSTRAINT "plans_billing_type_check" CHECK ("plans"."billing_type" in ('month', 'year', 'lifetime')),
	CONSTRAINT "plans_amount_nonnegative_check" CHECK ("plans"."amount_cents" >= 0),
	CONSTRAINT "plans_currency_lowercase_check" CHECK ("plans"."currency" = lower("plans"."currency"))
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"question_id" bigint NOT NULL,
	"option_key" text NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"mutation_kind" text,
	"rationale" text,
	"sort_order" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"question_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "question_reports_status_check" CHECK ("question_reports"."status" in ('open', 'reviewing', 'resolved', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"legal_article_id" bigint NOT NULL,
	"type" text NOT NULL,
	"prompt" text NOT NULL,
	"explanation" text NOT NULL,
	"topic" text NOT NULL,
	"difficulty" smallint DEFAULT 2 NOT NULL,
	"mutation_kind" text,
	"exam_board_style" text,
	"editorial_status" text DEFAULT 'reviewed' NOT NULL,
	"source_rights" text DEFAULT 'original_authorial' NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "questions_difficulty_check" CHECK ("questions"."difficulty" between 1 and 5),
	CONSTRAINT "questions_type_check" CHECK ("questions"."type" in ('literal_exact', 'cloze', 'altered_word', 'deadline', 'competence', 'true_false')),
	CONSTRAINT "questions_editorial_status_check" CHECK ("questions"."editorial_status" in ('draft', 'pending_review', 'reviewed', 'suspended')),
	CONSTRAINT "questions_source_rights_check" CHECK ("questions"."source_rights" in ('original_authorial', 'licensed'))
);
--> statement-breakpoint
CREATE TABLE "review_queue" (
	"user_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"stage" smallint DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"last_result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_queue_pkey" PRIMARY KEY("user_id","question_id"),
	CONSTRAINT "review_queue_stage_check" CHECK ("review_queue"."stage" between 0 and 6),
	CONSTRAINT "review_queue_counts_check" CHECK ("review_queue"."repetitions" >= 0 and "review_queue"."lapses" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"api_version" text,
	"livemode" boolean NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	CONSTRAINT "stripe_events_status_check" CHECK ("stripe_events"."status" in ('received', 'processing', 'processed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "study_days" (
	"user_id" bigint NOT NULL,
	"study_date" date NOT NULL,
	"answered_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"minutes_studied" integer DEFAULT 0 NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_days_pkey" PRIMARY KEY("user_id","study_date"),
	CONSTRAINT "study_days_counts_check" CHECK ("study_days"."answered_count" >= 0 and "study_days"."correct_count" >= 0 and "study_days"."correct_count" <= "study_days"."answered_count"),
	CONSTRAINT "study_days_minutes_xp_check" CHECK ("study_days"."minutes_studied" >= 0 and "study_days"."xp_earned" >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"plan_id" bigint NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_subscription_id" text,
	"provider_checkout_session_id" text,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"access_ends_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_provider_subscription_id_unique" UNIQUE("provider_subscription_id"),
	CONSTRAINT "subscriptions_provider_checkout_session_id_unique" UNIQUE("provider_checkout_session_id"),
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" in ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'unpaid', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "user_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"selected_option_id" bigint,
	"is_correct" boolean NOT NULL,
	"confidence" smallint,
	"duration_ms" integer,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_attempts_confidence_check" CHECK ("user_attempts"."confidence" is null or "user_attempts"."confidence" between 1 and 3),
	CONSTRAINT "user_attempts_duration_check" CHECK ("user_attempts"."duration_ms" is null or "user_attempts"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"avatar_url" text,
	"stripe_customer_id" text,
	"email_verified_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('student', 'editor', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_articles" ADD CONSTRAINT "legal_articles_legal_version_id_legal_versions_id_fk" FOREIGN KEY ("legal_version_id") REFERENCES "public"."legal_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_versions" ADD CONSTRAINT "legal_versions_legal_act_id_legal_acts_id_fk" FOREIGN KEY ("legal_act_id") REFERENCES "public"."legal_acts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_legal_article_id_legal_articles_id_fk" FOREIGN KEY ("legal_article_id") REFERENCES "public"."legal_articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_days" ADD CONSTRAINT "study_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_attempts" ADD CONSTRAINT "user_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_attempts" ADD CONSTRAINT "user_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_attempts" ADD CONSTRAINT "user_attempts_selected_option_id_question_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."question_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "checkout_attempts_user_created_idx" ON "checkout_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "checkout_attempts_plan_id_idx" ON "checkout_attempts" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "legal_acts_title_idx" ON "legal_acts" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_articles_version_path_uidx" ON "legal_articles" USING btree ("legal_version_id","path");--> statement-breakpoint
CREATE INDEX "legal_articles_version_order_idx" ON "legal_articles" USING btree ("legal_version_id","article_order");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_versions_act_checksum_uidx" ON "legal_versions" USING btree ("legal_act_id","checksum_sha256");--> statement-breakpoint
CREATE INDEX "legal_versions_act_id_idx" ON "legal_versions" USING btree ("legal_act_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_options_question_key_uidx" ON "question_options" USING btree ("question_id","option_key");--> statement-breakpoint
CREATE UNIQUE INDEX "question_options_question_order_uidx" ON "question_options" USING btree ("question_id","sort_order");--> statement-breakpoint
CREATE INDEX "question_options_question_id_idx" ON "question_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_reports_question_id_idx" ON "question_reports" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_reports_user_id_idx" ON "question_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "question_reports_open_idx" ON "question_reports" USING btree ("created_at") WHERE "question_reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX "questions_article_id_idx" ON "questions" USING btree ("legal_article_id");--> statement-breakpoint
CREATE INDEX "questions_topic_status_idx" ON "questions" USING btree ("topic","editorial_status");--> statement-breakpoint
CREATE INDEX "review_queue_user_due_idx" ON "review_queue" USING btree ("user_id","next_review_at");--> statement-breakpoint
CREATE INDEX "review_queue_question_id_idx" ON "review_queue" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "stripe_events_status_received_idx" ON "stripe_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "stripe_events_type_idx" ON "stripe_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "study_days_date_xp_idx" ON "study_days" USING btree ("study_date","xp_earned");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_current_per_user_uidx" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."status" in ('active', 'trialing', 'past_due');--> statement-breakpoint
CREATE INDEX "user_attempts_user_answered_idx" ON "user_attempts" USING btree ("user_id","answered_at");--> statement-breakpoint
CREATE INDEX "user_attempts_question_id_idx" ON "user_attempts" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "user_attempts_selected_option_id_idx" ON "user_attempts" USING btree ("selected_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uidx" ON "users" USING btree (lower("email"));