CREATE TABLE "contest_categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contest_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "contest_categories_slug_check" CHECK ("contest_categories"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "contest_category_careers" (
	"category_id" bigint NOT NULL,
	"career_track_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_category_careers_pkey" PRIMARY KEY("category_id","career_track_id")
);
--> statement-breakpoint
CREATE TABLE "contest_opportunities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contest_opportunities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" bigint NOT NULL,
	"career_track_id" bigint NOT NULL,
	"specialization_id" bigint,
	"jurisdiction_code" text NOT NULL,
	"scope" text NOT NULL,
	"cycle_year" integer NOT NULL,
	"institution_acronym" text NOT NULL,
	"institution_name" text NOT NULL,
	"role_name" text NOT NULL,
	"official_notice_number" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"lifecycle_status" text DEFAULT 'authorized' NOT NULL,
	"status_as_of" date NOT NULL,
	"official_url" text,
	"announced_at" date,
	"notice_published_at" date,
	"registration_starts_at" date,
	"registration_ends_at" date,
	"exam_date" date,
	"source_checked_at" timestamp with time zone,
	"editorial_status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_user_id" bigint,
	"updated_by_user_id" bigint,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_opportunities_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "contest_opportunities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "contest_opportunities_public_id_check" CHECK ("contest_opportunities"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "contest_opportunities_slug_check" CHECK ("contest_opportunities"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "contest_opportunities_jurisdiction_check" CHECK ("contest_opportunities"."jurisdiction_code" ~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO|BR)$'),
	CONSTRAINT "contest_opportunities_scope_check" CHECK ("contest_opportunities"."scope" in ('national', 'federal', 'state', 'regional', 'municipal')),
	CONSTRAINT "contest_opportunities_year_check" CHECK ("contest_opportunities"."cycle_year" between 2000 and 2200),
	CONSTRAINT "contest_opportunities_lifecycle_check" CHECK ("contest_opportunities"."lifecycle_status" in ('authorized', 'commission_formed', 'organizer_selected', 'pre_notice', 'notice_published', 'registration_open', 'registration_closed', 'exam_scheduled', 'exam_held', 'result_published', 'homologated', 'closed', 'suspended', 'canceled')),
	CONSTRAINT "contest_opportunities_editorial_check" CHECK ("contest_opportunities"."editorial_status" in ('draft', 'pending_review', 'reviewed', 'suspended')),
	CONSTRAINT "contest_opportunities_url_check" CHECK ("contest_opportunities"."official_url" is null or "contest_opportunities"."official_url" ~ '^https://'),
	CONSTRAINT "contest_opportunities_registration_range_check" CHECK ("contest_opportunities"."registration_ends_at" is null or "contest_opportunities"."registration_starts_at" is null or "contest_opportunities"."registration_ends_at" >= "contest_opportunities"."registration_starts_at"),
	CONSTRAINT "contest_opportunities_notice_date_check" CHECK ("contest_opportunities"."lifecycle_status" not in ('notice_published', 'registration_open', 'registration_closed', 'exam_scheduled', 'exam_held', 'result_published', 'homologated', 'closed') or "contest_opportunities"."notice_published_at" is not null),
	CONSTRAINT "contest_opportunities_review_check" CHECK ("contest_opportunities"."editorial_status" <> 'reviewed' or (
        "contest_opportunities"."official_url" is not null
        and "contest_opportunities"."source_checked_at" is not null
        and "contest_opportunities"."reviewed_by_user_id" is not null
        and "contest_opportunities"."reviewed_at" is not null
        and "contest_opportunities"."published_at" is not null
      )),
	CONSTRAINT "contest_opportunities_independent_review_check" CHECK ("contest_opportunities"."editorial_status" <> 'reviewed'
        or "contest_opportunities"."created_by_user_id" is null
        or "contest_opportunities"."reviewed_by_user_id" <> "contest_opportunities"."created_by_user_id"),
	CONSTRAINT "contest_opportunities_review_notes_check" CHECK ("contest_opportunities"."review_notes" is null or char_length("contest_opportunities"."review_notes") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "contest_opportunity_plans" (
	"opportunity_id" bigint NOT NULL,
	"plan_id" bigint NOT NULL,
	"availability" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_opportunity_plans_pkey" PRIMARY KEY("opportunity_id","plan_id"),
	CONSTRAINT "contest_opportunity_plans_availability_check" CHECK ("contest_opportunity_plans"."availability" in ('planned', 'active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "opportunity_analysis_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "opportunity_analysis_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"opportunity_id" bigint NOT NULL,
	"organizer_assignment_id" bigint NOT NULL,
	"analysis_kind" text NOT NULL,
	"methodology_version" text NOT NULL,
	"lookback_years" smallint DEFAULT 10 NOT NULL,
	"window_start_year" integer NOT NULL,
	"window_end_year" integer NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"corpus_basis" text NOT NULL,
	"corpus_rights_reference" text,
	"methodology" text NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_bps" integer DEFAULT 0 NOT NULL,
	"limitations" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_user_id" bigint,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_analysis_snapshots_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "opportunity_analysis_snapshots_public_id_check" CHECK ("opportunity_analysis_snapshots"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "opportunity_analysis_snapshots_kind_check" CHECK ("opportunity_analysis_snapshots"."analysis_kind" in ('syllabus_frequency', 'question_incidence', 'legal_change_risk')),
	CONSTRAINT "opportunity_analysis_snapshots_lookback_check" CHECK ("opportunity_analysis_snapshots"."lookback_years" between 1 and 10),
	CONSTRAINT "opportunity_analysis_snapshots_window_check" CHECK ("opportunity_analysis_snapshots"."window_start_year" between 2000 and 2200 and "opportunity_analysis_snapshots"."window_end_year" between "opportunity_analysis_snapshots"."window_start_year" and 2200),
	CONSTRAINT "opportunity_analysis_snapshots_sample_check" CHECK ("opportunity_analysis_snapshots"."sample_size" >= 0),
	CONSTRAINT "opportunity_analysis_snapshots_corpus_check" CHECK ("opportunity_analysis_snapshots"."corpus_basis" in ('official_syllabi', 'licensed_questions', 'mixed_authorized')),
	CONSTRAINT "opportunity_analysis_snapshots_question_rights_check" CHECK ("opportunity_analysis_snapshots"."analysis_kind" <> 'question_incidence' or "opportunity_analysis_snapshots"."corpus_basis" in ('licensed_questions', 'mixed_authorized')),
	CONSTRAINT "opportunity_analysis_snapshots_confidence_check" CHECK ("opportunity_analysis_snapshots"."confidence_bps" between 0 and 10000),
	CONSTRAINT "opportunity_analysis_snapshots_status_check" CHECK ("opportunity_analysis_snapshots"."status" in ('draft', 'pending_review', 'reviewed', 'suspended')),
	CONSTRAINT "opportunity_analysis_snapshots_review_check" CHECK ("opportunity_analysis_snapshots"."status" <> 'reviewed' or (
        "opportunity_analysis_snapshots"."sample_size" > 0
        and nullif(btrim("opportunity_analysis_snapshots"."corpus_rights_reference"), '') is not null
        and "opportunity_analysis_snapshots"."reviewed_by_user_id" is not null
        and "opportunity_analysis_snapshots"."reviewed_at" is not null
      )),
	CONSTRAINT "opportunity_analysis_snapshots_independent_review_check" CHECK ("opportunity_analysis_snapshots"."status" <> 'reviewed'
        or "opportunity_analysis_snapshots"."created_by_user_id" is null
        or "opportunity_analysis_snapshots"."reviewed_by_user_id" <> "opportunity_analysis_snapshots"."created_by_user_id")
);
--> statement-breakpoint
CREATE TABLE "opportunity_organizer_assignments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "opportunity_organizer_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"opportunity_id" bigint NOT NULL,
	"quiz_bank_id" bigint,
	"source_document_id" bigint NOT NULL,
	"responsible_type" text NOT NULL,
	"role" text DEFAULT 'primary_responsible' NOT NULL,
	"organizer_slug" text NOT NULL,
	"organizer_name" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_organizer_assignments_type_check" CHECK ("opportunity_organizer_assignments"."responsible_type" in ('external_organizer', 'institutional_commission', 'hybrid')),
	CONSTRAINT "opportunity_organizer_assignments_role_check" CHECK ("opportunity_organizer_assignments"."role" in ('primary_responsible', 'examination_provider', 'logistics_provider')),
	CONSTRAINT "opportunity_organizer_assignments_slug_check" CHECK ("opportunity_organizer_assignments"."organizer_slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "opportunity_organizer_assignments_bank_check" CHECK (("opportunity_organizer_assignments"."responsible_type" = 'external_organizer' and "opportunity_organizer_assignments"."quiz_bank_id" is not null)
        or ("opportunity_organizer_assignments"."responsible_type" = 'institutional_commission' and "opportunity_organizer_assignments"."quiz_bank_id" is null)
        or "opportunity_organizer_assignments"."responsible_type" = 'hybrid'),
	CONSTRAINT "opportunity_organizer_assignments_date_check" CHECK ("opportunity_organizer_assignments"."valid_until" is null or "opportunity_organizer_assignments"."valid_until" >= "opportunity_organizer_assignments"."valid_from"),
	CONSTRAINT "opportunity_organizer_assignments_status_check" CHECK ("opportunity_organizer_assignments"."status" in ('pending_review', 'reviewed', 'superseded', 'rejected')),
	CONSTRAINT "opportunity_organizer_assignments_review_check" CHECK ("opportunity_organizer_assignments"."status" <> 'reviewed' or ("opportunity_organizer_assignments"."reviewed_by_user_id" is not null and "opportunity_organizer_assignments"."reviewed_at" is not null)),
	CONSTRAINT "opportunity_organizer_assignments_review_notes_check" CHECK ("opportunity_organizer_assignments"."review_notes" is null or char_length("opportunity_organizer_assignments"."review_notes") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "opportunity_requirements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "opportunity_requirements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"opportunity_id" bigint NOT NULL,
	"source_document_id" bigint NOT NULL,
	"subject_id" bigint,
	"topic_id" bigint,
	"legal_act_id" bigint,
	"legal_article_id" bigint,
	"requirement_text" text NOT NULL,
	"source_locator" text NOT NULL,
	"editorial_status" text DEFAULT 'draft' NOT NULL,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_requirements_status_check" CHECK ("opportunity_requirements"."editorial_status" in ('draft', 'pending_review', 'reviewed', 'suspended')),
	CONSTRAINT "opportunity_requirements_topic_subject_check" CHECK ("opportunity_requirements"."topic_id" is null or "opportunity_requirements"."subject_id" is not null),
	CONSTRAINT "opportunity_requirements_article_act_check" CHECK ("opportunity_requirements"."legal_article_id" is null or "opportunity_requirements"."legal_act_id" is not null),
	CONSTRAINT "opportunity_requirements_review_check" CHECK ("opportunity_requirements"."editorial_status" <> 'reviewed' or ("opportunity_requirements"."reviewed_by_user_id" is not null and "opportunity_requirements"."reviewed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "opportunity_source_documents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "opportunity_source_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"opportunity_id" bigint NOT NULL,
	"document_type" text NOT NULL,
	"source_external_id" text,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"source_host" text NOT NULL,
	"published_at" timestamp with time zone,
	"observed_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"checksum_sha256" text,
	"http_status" integer NOT NULL,
	"content_type" text,
	"source_policy" text DEFAULT 'metadata_only' NOT NULL,
	"source_content_stored" boolean DEFAULT false NOT NULL,
	"supersedes_public_id" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"initiated_by_user_id" bigint,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_source_documents_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "opportunity_source_documents_public_id_check" CHECK ("opportunity_source_documents"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "opportunity_source_documents_type_check" CHECK ("opportunity_source_documents"."document_type" in ('authorization', 'commission_act', 'procurement_notice', 'organizer_contract', 'official_announcement', 'notice', 'correction', 'suspension', 'cancellation', 'result', 'homologation', 'other')),
	CONSTRAINT "opportunity_source_documents_url_check" CHECK ("opportunity_source_documents"."source_url" ~ '^https://'),
	CONSTRAINT "opportunity_source_documents_host_check" CHECK ("opportunity_source_documents"."source_host" = lower("opportunity_source_documents"."source_host") and "opportunity_source_documents"."source_host" ~ '^[a-z0-9.-]+$'),
	CONSTRAINT "opportunity_source_documents_checksum_check" CHECK ("opportunity_source_documents"."checksum_sha256" is null or "opportunity_source_documents"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "opportunity_source_documents_http_check" CHECK ("opportunity_source_documents"."http_status" between 100 and 599),
	CONSTRAINT "opportunity_source_documents_policy_check" CHECK ("opportunity_source_documents"."source_policy" in ('metadata_only', 'official_document', 'licensed_content')),
	CONSTRAINT "opportunity_source_documents_metadata_only_check" CHECK ("opportunity_source_documents"."source_policy" <> 'metadata_only' or not "opportunity_source_documents"."source_content_stored"),
	CONSTRAINT "opportunity_source_documents_status_check" CHECK ("opportunity_source_documents"."status" in ('pending_review', 'approved', 'superseded', 'rejected')),
	CONSTRAINT "opportunity_source_documents_review_check" CHECK ("opportunity_source_documents"."status" <> 'approved' or ("opportunity_source_documents"."reviewed_by_user_id" is not null and "opportunity_source_documents"."reviewed_at" is not null)),
	CONSTRAINT "opportunity_source_documents_independent_review_check" CHECK ("opportunity_source_documents"."status" <> 'approved'
        or "opportunity_source_documents"."initiated_by_user_id" is null
        or "opportunity_source_documents"."reviewed_by_user_id" <> "opportunity_source_documents"."initiated_by_user_id"),
	CONSTRAINT "opportunity_source_documents_review_notes_check" CHECK ("opportunity_source_documents"."review_notes" is null or char_length("opportunity_source_documents"."review_notes") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "question_opportunities" (
	"question_id" bigint NOT NULL,
	"opportunity_id" bigint NOT NULL,
	"relationship" text NOT NULL,
	"analysis_snapshot_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_opportunities_pkey" PRIMARY KEY("question_id","opportunity_id"),
	CONSTRAINT "question_opportunities_relationship_check" CHECK ("question_opportunities"."relationship" in ('direct_requirement', 'statistical_priority', 'legal_change'))
);
--> statement-breakpoint
ALTER TABLE "contest_category_careers" ADD CONSTRAINT "contest_category_careers_category_id_contest_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."contest_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_category_careers" ADD CONSTRAINT "contest_category_careers_career_track_id_quiz_career_tracks_id_fk" FOREIGN KEY ("career_track_id") REFERENCES "public"."quiz_career_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_category_id_contest_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."contest_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_career_track_id_quiz_career_tracks_id_fk" FOREIGN KEY ("career_track_id") REFERENCES "public"."quiz_career_tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_specialization_career_fk" FOREIGN KEY ("specialization_id","career_track_id") REFERENCES "public"."quiz_career_specializations"("id","career_track_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_opportunity_plans" ADD CONSTRAINT "contest_opportunity_plans_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_opportunity_plans" ADD CONSTRAINT "contest_opportunity_plans_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_analysis_snapshots" ADD CONSTRAINT "opportunity_analysis_snapshots_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_analysis_snapshots" ADD CONSTRAINT "opportunity_analysis_snapshots_organizer_assignment_id_opportunity_organizer_assignments_id_fk" FOREIGN KEY ("organizer_assignment_id") REFERENCES "public"."opportunity_organizer_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_analysis_snapshots" ADD CONSTRAINT "opportunity_analysis_snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_analysis_snapshots" ADD CONSTRAINT "opportunity_analysis_snapshots_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_organizer_assignments" ADD CONSTRAINT "opportunity_organizer_assignments_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_organizer_assignments" ADD CONSTRAINT "opportunity_organizer_assignments_quiz_bank_id_quiz_banks_id_fk" FOREIGN KEY ("quiz_bank_id") REFERENCES "public"."quiz_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_organizer_assignments" ADD CONSTRAINT "opportunity_organizer_assignments_source_document_id_opportunity_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."opportunity_source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_organizer_assignments" ADD CONSTRAINT "opportunity_organizer_assignments_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_source_document_id_opportunity_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."opportunity_source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_subject_id_quiz_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."quiz_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_topic_id_quiz_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."quiz_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_legal_act_id_legal_acts_id_fk" FOREIGN KEY ("legal_act_id") REFERENCES "public"."legal_acts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_legal_article_id_legal_articles_id_fk" FOREIGN KEY ("legal_article_id") REFERENCES "public"."legal_articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_source_documents" ADD CONSTRAINT "opportunity_source_documents_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_source_documents" ADD CONSTRAINT "opportunity_source_documents_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_source_documents" ADD CONSTRAINT "opportunity_source_documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_opportunities" ADD CONSTRAINT "question_opportunities_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_opportunities" ADD CONSTRAINT "question_opportunities_opportunity_id_contest_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."contest_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_opportunities" ADD CONSTRAINT "question_opportunities_analysis_snapshot_id_opportunity_analysis_snapshots_id_fk" FOREIGN KEY ("analysis_snapshot_id") REFERENCES "public"."opportunity_analysis_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contest_categories_active_sort_idx" ON "contest_categories" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "contest_category_careers_career_idx" ON "contest_category_careers" USING btree ("career_track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contest_opportunities_identity_uidx" ON "contest_opportunities" USING btree ("institution_acronym","official_notice_number","cycle_year","role_name");--> statement-breakpoint
CREATE INDEX "contest_opportunities_public_catalog_idx" ON "contest_opportunities" USING btree ("editorial_status","lifecycle_status","status_as_of","id");--> statement-breakpoint
CREATE INDEX "contest_opportunities_category_jurisdiction_idx" ON "contest_opportunities" USING btree ("category_id","jurisdiction_code","lifecycle_status");--> statement-breakpoint
CREATE INDEX "contest_opportunities_career_idx" ON "contest_opportunities" USING btree ("career_track_id","cycle_year");--> statement-breakpoint
CREATE INDEX "contest_opportunities_specialization_idx" ON "contest_opportunities" USING btree ("specialization_id");--> statement-breakpoint
CREATE INDEX "contest_opportunities_created_by_idx" ON "contest_opportunities" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "contest_opportunities_updated_by_idx" ON "contest_opportunities" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE INDEX "contest_opportunities_reviewed_by_idx" ON "contest_opportunities" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "contest_opportunity_plans_plan_idx" ON "contest_opportunity_plans" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "opportunity_analysis_snapshots_catalog_idx" ON "opportunity_analysis_snapshots" USING btree ("opportunity_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "opportunity_analysis_snapshots_assignment_idx" ON "opportunity_analysis_snapshots" USING btree ("organizer_assignment_id");--> statement-breakpoint
CREATE INDEX "opportunity_analysis_snapshots_created_by_idx" ON "opportunity_analysis_snapshots" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "opportunity_analysis_snapshots_reviewed_by_idx" ON "opportunity_analysis_snapshots" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_organizer_assignments_primary_active_uidx" ON "opportunity_organizer_assignments" USING btree ("opportunity_id") WHERE "opportunity_organizer_assignments"."role" = 'primary_responsible' and "opportunity_organizer_assignments"."status" = 'reviewed' and "opportunity_organizer_assignments"."valid_until" is null;--> statement-breakpoint
CREATE INDEX "opportunity_organizer_assignments_bank_idx" ON "opportunity_organizer_assignments" USING btree ("quiz_bank_id");--> statement-breakpoint
CREATE INDEX "opportunity_organizer_assignments_source_idx" ON "opportunity_organizer_assignments" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "opportunity_organizer_assignments_reviewed_by_idx" ON "opportunity_organizer_assignments" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "opportunity_requirements_opportunity_status_idx" ON "opportunity_requirements" USING btree ("opportunity_id","editorial_status","subject_id");--> statement-breakpoint
CREATE INDEX "opportunity_requirements_source_idx" ON "opportunity_requirements" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "opportunity_requirements_topic_idx" ON "opportunity_requirements" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "opportunity_requirements_legal_act_idx" ON "opportunity_requirements" USING btree ("legal_act_id");--> statement-breakpoint
CREATE INDEX "opportunity_requirements_legal_article_idx" ON "opportunity_requirements" USING btree ("legal_article_id");--> statement-breakpoint
CREATE INDEX "opportunity_requirements_reviewed_by_idx" ON "opportunity_requirements" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_source_documents_opportunity_url_uidx" ON "opportunity_source_documents" USING btree ("opportunity_id","source_url");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_source_documents_external_uidx" ON "opportunity_source_documents" USING btree ("opportunity_id","source_external_id") WHERE "opportunity_source_documents"."source_external_id" is not null;--> statement-breakpoint
CREATE INDEX "opportunity_source_documents_status_idx" ON "opportunity_source_documents" USING btree ("opportunity_id","status","observed_at");--> statement-breakpoint
CREATE INDEX "opportunity_source_documents_reviewed_by_idx" ON "opportunity_source_documents" USING btree ("reviewed_by_user_id");--> statement-breakpoint
CREATE INDEX "question_opportunities_opportunity_idx" ON "question_opportunities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "question_opportunities_analysis_idx" ON "question_opportunities" USING btree ("analysis_snapshot_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_opportunity_organizer_assignment"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_opportunity_id bigint;
  source_status text;
BEGIN
  SELECT "opportunity_id", "status"
    INTO source_opportunity_id, source_status
  FROM "opportunity_source_documents"
  WHERE "id" = NEW."source_document_id";

  IF source_opportunity_id IS NULL OR source_opportunity_id <> NEW."opportunity_id" THEN
    RAISE EXCEPTION 'A fonte do responsável deve pertencer à mesma oportunidade.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."status" = 'reviewed' AND source_status <> 'approved' THEN
    RAISE EXCEPTION 'Um responsável revisado exige uma fonte oficial aprovada.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "opportunity_organizer_assignment_source_guard"
BEFORE INSERT OR UPDATE ON "opportunity_organizer_assignments"
FOR EACH ROW
EXECUTE FUNCTION "validate_opportunity_organizer_assignment"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_contest_opportunity_publication"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."editorial_status" = 'reviewed' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "opportunity_source_documents" source
      WHERE source."opportunity_id" = NEW."id"
        AND source."status" = 'approved'
    ) THEN
      RAISE EXCEPTION 'Uma oportunidade pública exige ao menos uma fonte oficial aprovada.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW."lifecycle_status" IN (
      'organizer_selected',
      'notice_published',
      'registration_open',
      'registration_closed',
      'exam_scheduled',
      'exam_held',
      'result_published',
      'homologated',
      'closed'
    ) AND NOT EXISTS (
      SELECT 1
      FROM "opportunity_organizer_assignments" assignment
      WHERE assignment."opportunity_id" = NEW."id"
        AND assignment."role" = 'primary_responsible'
        AND assignment."status" = 'reviewed'
        AND assignment."valid_until" IS NULL
    ) THEN
      RAISE EXCEPTION 'A etapa pública exige um único responsável primário revisado para esta edição.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "contest_opportunity_publication_guard"
BEFORE INSERT OR UPDATE ON "contest_opportunities"
FOR EACH ROW
EXECUTE FUNCTION "validate_contest_opportunity_publication"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_public_opportunity_primary_gap"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_opportunity_id bigint;
BEGIN
  affected_opportunity_id := OLD."opportunity_id";

  IF EXISTS (
    SELECT 1
    FROM "contest_opportunities" opportunity
    WHERE opportunity."id" = affected_opportunity_id
      AND opportunity."editorial_status" = 'reviewed'
      AND opportunity."lifecycle_status" IN (
        'organizer_selected',
        'notice_published',
        'registration_open',
        'registration_closed',
        'exam_scheduled',
        'exam_held',
        'result_published',
        'homologated',
        'closed'
      )
  ) AND NOT EXISTS (
    SELECT 1
    FROM "opportunity_organizer_assignments" assignment
    WHERE assignment."opportunity_id" = affected_opportunity_id
      AND assignment."role" = 'primary_responsible'
      AND assignment."status" = 'reviewed'
      AND assignment."valid_until" IS NULL
  ) THEN
    RAISE EXCEPTION 'Uma oportunidade pública não pode ficar sem responsável primário revisado.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "opportunity_organizer_assignment_publication_guard"
AFTER UPDATE OR DELETE ON "opportunity_organizer_assignments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "prevent_public_opportunity_primary_gap"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_reviewed_opportunity_source_gap"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_opportunity_id bigint;
BEGIN
  affected_opportunity_id := OLD."opportunity_id";

  IF EXISTS (
    SELECT 1
    FROM "opportunity_organizer_assignments" assignment
    LEFT JOIN "opportunity_source_documents" source
      ON source."id" = assignment."source_document_id"
    WHERE assignment."source_document_id" = OLD."id"
      AND assignment."status" = 'reviewed'
      AND (
        source."id" IS NULL
        OR source."status" <> 'approved'
        OR source."opportunity_id" <> assignment."opportunity_id"
      )
  ) THEN
    RAISE EXCEPTION 'Um responsável revisado não pode perder sua fonte oficial aprovada.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "contest_opportunities" opportunity
    WHERE opportunity."id" = affected_opportunity_id
      AND opportunity."editorial_status" = 'reviewed'
  ) AND NOT EXISTS (
    SELECT 1
    FROM "opportunity_source_documents" source
    WHERE source."opportunity_id" = affected_opportunity_id
      AND source."status" = 'approved'
  ) THEN
    RAISE EXCEPTION 'Uma oportunidade pública não pode ficar sem fonte oficial aprovada.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "opportunity_source_document_publication_guard"
AFTER UPDATE OR DELETE ON "opportunity_source_documents"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "prevent_reviewed_opportunity_source_gap"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_opportunity_requirement_context"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_opportunity_id bigint;
  topic_subject_id bigint;
  article_legal_act_id bigint;
BEGIN
  SELECT source."opportunity_id"
    INTO source_opportunity_id
  FROM "opportunity_source_documents" source
  WHERE source."id" = NEW."source_document_id";

  IF source_opportunity_id IS NULL OR source_opportunity_id <> NEW."opportunity_id" THEN
    RAISE EXCEPTION 'A fonte do conteúdo programático deve pertencer à mesma oportunidade.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."topic_id" IS NOT NULL THEN
    SELECT topic."subject_id"
      INTO topic_subject_id
    FROM "quiz_topics" topic
    WHERE topic."id" = NEW."topic_id";

    IF topic_subject_id IS NULL
      OR NEW."subject_id" IS NULL
      OR topic_subject_id <> NEW."subject_id" THEN
      RAISE EXCEPTION 'O tópico do conteúdo programático deve pertencer à matéria informada.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."legal_article_id" IS NOT NULL THEN
    SELECT version."legal_act_id"
      INTO article_legal_act_id
    FROM "legal_articles" article
    JOIN "legal_versions" version
      ON version."id" = article."legal_version_id"
    WHERE article."id" = NEW."legal_article_id";

    IF article_legal_act_id IS NULL
      OR NEW."legal_act_id" IS NULL
      OR article_legal_act_id <> NEW."legal_act_id" THEN
      RAISE EXCEPTION 'O artigo do conteúdo programático deve pertencer ao ato legal informado.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "opportunity_requirement_context_guard"
BEFORE INSERT OR UPDATE ON "opportunity_requirements"
FOR EACH ROW
EXECUTE FUNCTION "validate_opportunity_requirement_context"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_opportunity_analysis_context"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_opportunity_id bigint;
BEGIN
  SELECT assignment."opportunity_id"
    INTO assignment_opportunity_id
  FROM "opportunity_organizer_assignments" assignment
  WHERE assignment."id" = NEW."organizer_assignment_id";

  IF assignment_opportunity_id IS NULL
    OR assignment_opportunity_id <> NEW."opportunity_id" THEN
    RAISE EXCEPTION 'A análise deve usar um responsável da mesma oportunidade.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "opportunity_analysis_context_guard"
BEFORE INSERT OR UPDATE ON "opportunity_analysis_snapshots"
FOR EACH ROW
EXECUTE FUNCTION "validate_opportunity_analysis_context"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_question_opportunity_context"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  analysis_opportunity_id bigint;
BEGIN
  IF NEW."analysis_snapshot_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT analysis."opportunity_id"
    INTO analysis_opportunity_id
  FROM "opportunity_analysis_snapshots" analysis
  WHERE analysis."id" = NEW."analysis_snapshot_id";

  IF analysis_opportunity_id IS NULL
    OR analysis_opportunity_id <> NEW."opportunity_id" THEN
    RAISE EXCEPTION 'A questão deve usar uma análise da mesma oportunidade.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "question_opportunity_context_guard"
BEFORE INSERT OR UPDATE ON "question_opportunities"
FOR EACH ROW
EXECUTE FUNCTION "validate_question_opportunity_context"();
