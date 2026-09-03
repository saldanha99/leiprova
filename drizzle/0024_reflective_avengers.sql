CREATE TABLE "legal_text_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legal_text_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"legal_act_id" bigint NOT NULL,
	"monitor_snapshot_id" bigint NOT NULL,
	"source_url" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"normalized_content" text NOT NULL,
	"content_length" integer NOT NULL,
	"article_count" integer NOT NULL,
	"parser_version" text NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"initiated_by_user_id" bigint,
	"reviewed_by_user_id" bigint,
	"review_notes" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_text_snapshots_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "legal_text_snapshots_public_id_check" CHECK ("legal_text_snapshots"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "legal_text_snapshots_url_check" CHECK ("legal_text_snapshots"."source_url" ~ '^https://legis\.senado\.leg\.br/norma/[0-9]+/publicacao/[0-9]+$'),
	CONSTRAINT "legal_text_snapshots_checksum_check" CHECK ("legal_text_snapshots"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "legal_text_snapshots_content_check" CHECK ("legal_text_snapshots"."content_length" between 1000 and 5000000 and char_length("legal_text_snapshots"."normalized_content") = "legal_text_snapshots"."content_length"),
	CONSTRAINT "legal_text_snapshots_article_count_check" CHECK ("legal_text_snapshots"."article_count" between 1 and 5000),
	CONSTRAINT "legal_text_snapshots_status_check" CHECK ("legal_text_snapshots"."status" in ('pending_review', 'approved', 'superseded', 'rejected')),
	CONSTRAINT "legal_text_snapshots_review_check" CHECK ("legal_text_snapshots"."status" <> 'approved' or ("legal_text_snapshots"."reviewed_by_user_id" is not null and "legal_text_snapshots"."reviewed_at" is not null)),
	CONSTRAINT "legal_text_snapshots_independent_review_check" CHECK ("legal_text_snapshots"."status" <> 'approved'
        or "legal_text_snapshots"."initiated_by_user_id" is null
        or "legal_text_snapshots"."reviewed_by_user_id" <> "legal_text_snapshots"."initiated_by_user_id"),
	CONSTRAINT "legal_text_snapshots_review_notes_check" CHECK ("legal_text_snapshots"."review_notes" is null or char_length("legal_text_snapshots"."review_notes") <= 1500)
);
--> statement-breakpoint
ALTER TABLE "legal_text_snapshots" ADD CONSTRAINT "legal_text_snapshots_legal_act_id_legal_acts_id_fk" FOREIGN KEY ("legal_act_id") REFERENCES "public"."legal_acts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_text_snapshots" ADD CONSTRAINT "legal_text_snapshots_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_text_snapshots" ADD CONSTRAINT "legal_text_snapshots_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_source_snapshots_id_act_uidx" ON "legal_source_snapshots" USING btree ("id","legal_act_id");--> statement-breakpoint
ALTER TABLE "legal_text_snapshots" ADD CONSTRAINT "legal_text_snapshots_monitor_act_fk" FOREIGN KEY ("monitor_snapshot_id","legal_act_id") REFERENCES "public"."legal_source_snapshots"("id","legal_act_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_text_snapshots_act_checksum_uidx" ON "legal_text_snapshots" USING btree ("legal_act_id","checksum_sha256");--> statement-breakpoint
CREATE INDEX "legal_text_snapshots_act_status_idx" ON "legal_text_snapshots" USING btree ("legal_act_id","status","fetched_at");--> statement-breakpoint
CREATE INDEX "legal_text_snapshots_monitor_idx" ON "legal_text_snapshots" USING btree ("monitor_snapshot_id");--> statement-breakpoint
CREATE INDEX "legal_text_snapshots_initiated_by_idx" ON "legal_text_snapshots" USING btree ("initiated_by_user_id");--> statement-breakpoint
CREATE INDEX "legal_text_snapshots_reviewed_by_idx" ON "legal_text_snapshots" USING btree ("reviewed_by_user_id");
