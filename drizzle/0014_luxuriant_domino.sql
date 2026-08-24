CREATE TABLE "exam_source_portals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_source_portals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"quiz_bank_id" bigint NOT NULL,
	"official_url" text NOT NULL,
	"source_policy" text DEFAULT 'metadata_only' NOT NULL,
	"last_http_status" integer,
	"last_page_title" text,
	"last_final_url" text,
	"last_error" text,
	"last_checked_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_source_portals_quiz_bank_id_unique" UNIQUE("quiz_bank_id"),
	CONSTRAINT "exam_source_portals_url_check" CHECK ("exam_source_portals"."official_url" ~ '^https://'),
	CONSTRAINT "exam_source_portals_policy_check" CHECK ("exam_source_portals"."source_policy" = 'metadata_only'),
	CONSTRAINT "exam_source_portals_http_status_check" CHECK ("exam_source_portals"."last_http_status" is null or "exam_source_portals"."last_http_status" between 100 and 599)
);
--> statement-breakpoint
CREATE TABLE "legal_source_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legal_source_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"legal_act_id" bigint NOT NULL,
	"source_url" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"normalized_content" text NOT NULL,
	"content_length" integer NOT NULL,
	"article_marker_count" integer NOT NULL,
	"http_status" integer NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"initiated_by_user_id" bigint,
	"reviewed_by_user_id" bigint,
	"review_notes" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_source_snapshots_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "legal_source_snapshots_public_id_check" CHECK ("legal_source_snapshots"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "legal_source_snapshots_url_check" CHECK ("legal_source_snapshots"."source_url" ~ '^https://legis\.senado\.leg\.br/norma/[0-9]+$'),
	CONSTRAINT "legal_source_snapshots_checksum_check" CHECK ("legal_source_snapshots"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "legal_source_snapshots_content_check" CHECK ("legal_source_snapshots"."content_length" >= 1000),
	CONSTRAINT "legal_source_snapshots_article_count_check" CHECK ("legal_source_snapshots"."article_marker_count" >= 1),
	CONSTRAINT "legal_source_snapshots_http_status_check" CHECK ("legal_source_snapshots"."http_status" between 200 and 299),
	CONSTRAINT "legal_source_snapshots_status_check" CHECK ("legal_source_snapshots"."status" in ('pending_review', 'approved', 'superseded', 'rejected')),
	CONSTRAINT "legal_source_snapshots_review_check" CHECK ("legal_source_snapshots"."status" <> 'approved' or ("legal_source_snapshots"."reviewed_by_user_id" is not null and "legal_source_snapshots"."reviewed_at" is not null)),
	CONSTRAINT "legal_source_snapshots_independent_review_check" CHECK ("legal_source_snapshots"."status" <> 'approved'
        or "legal_source_snapshots"."initiated_by_user_id" is null
        or "legal_source_snapshots"."reviewed_by_user_id" <> "legal_source_snapshots"."initiated_by_user_id"),
	CONSTRAINT "legal_source_snapshots_review_notes_check" CHECK ("legal_source_snapshots"."review_notes" is null or char_length("legal_source_snapshots"."review_notes") <= 1500)
);
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "source_policy" text DEFAULT 'metadata_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "source_content_stored" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "source_page_title" text;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "source_http_status" integer;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "source_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "created_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "updated_by_user_id" bigint;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "similarity_max_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "similarity_reference_public_id" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "originality_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exam_source_portals" ADD CONSTRAINT "exam_source_portals_quiz_bank_id_quiz_banks_id_fk" FOREIGN KEY ("quiz_bank_id") REFERENCES "public"."quiz_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_source_snapshots" ADD CONSTRAINT "legal_source_snapshots_legal_act_id_legal_acts_id_fk" FOREIGN KEY ("legal_act_id") REFERENCES "public"."legal_acts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_source_snapshots" ADD CONSTRAINT "legal_source_snapshots_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_source_snapshots" ADD CONSTRAINT "legal_source_snapshots_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_source_portals_active_idx" ON "exam_source_portals" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_snapshots_act_checksum_uidx" ON "legal_source_snapshots" USING btree ("legal_act_id","checksum_sha256");--> statement-breakpoint
CREATE INDEX "legal_source_snapshots_act_status_idx" ON "legal_source_snapshots" USING btree ("legal_act_id","status","fetched_at");--> statement-breakpoint
CREATE INDEX "legal_source_snapshots_initiated_by_idx" ON "legal_source_snapshots" USING btree ("initiated_by_user_id");--> statement-breakpoint
CREATE INDEX "legal_source_snapshots_reviewed_by_idx" ON "legal_source_snapshots" USING btree ("reviewed_by_user_id");--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_editions_created_by_idx" ON "exam_editions" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "exam_editions_source_policy_idx" ON "exam_editions" USING btree ("source_policy","exam_date");--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_source_policy_check" CHECK ("exam_editions"."source_policy" in ('metadata_only', 'licensed_content'));--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_metadata_only_check" CHECK ("exam_editions"."source_policy" <> 'metadata_only' or not "exam_editions"."source_content_stored");--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_source_http_status_check" CHECK ("exam_editions"."source_http_status" is null or "exam_editions"."source_http_status" between 100 and 599);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_similarity_score_check" CHECK ("questions"."similarity_max_bps" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_originality_check" CHECK ("questions"."quiz_mode" <> 'original_style' or "questions"."originality_checked_at" is not null);
