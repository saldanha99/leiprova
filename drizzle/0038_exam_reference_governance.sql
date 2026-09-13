ALTER TABLE "exam_editions" ADD COLUMN "institution_acronym" text;
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "jurisdiction_code" text;
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "exam_edition_document_id" bigint;
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "exam_edition_answer_key_document_id" bigint;
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "exam_edition_answer_key_document_type" text;
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_institution_acronym_check" CHECK (
	"exam_editions"."institution_acronym" is null or (
		char_length(btrim("exam_editions"."institution_acronym")) between 2 and 80
		and "exam_editions"."institution_acronym" = upper(btrim("exam_editions"."institution_acronym"))
	)
);
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_jurisdiction_code_check" CHECK (
	"exam_editions"."jurisdiction_code" is null
	or "exam_editions"."jurisdiction_code" ~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO|BR)$'
);
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_scope_identity_check" CHECK (
	"exam_editions"."status" not in ('scheduled', 'held', 'published') or (
		"exam_editions"."institution_acronym" is not null
		and "exam_editions"."jurisdiction_code" is not null
	)
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_previous_exam_independent_review_check" CHECK (
	"questions"."quiz_mode" <> 'previous_exam'
	or "questions"."editorial_status" <> 'reviewed'
	or (
		"questions"."created_by_user_id" is not null
		and "questions"."reviewed_by_user_id" <> "questions"."created_by_user_id"
		and "questions"."submitted_at" is not null
		and nullif(btrim("questions"."review_notes"), '') is not null
		and char_length(btrim("questions"."review_notes")) between 20 and 1500
	)
);
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_mode_relations_check";
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_mode_relations_check" CHECK (
	(
		"questions"."quiz_mode" = 'dry_law'
		and "questions"."legal_article_id" is not null
			and "questions"."exam_edition_id" is null
			and "questions"."exam_edition_document_id" is null
			and "questions"."exam_edition_answer_key_document_id" is null
			and "questions"."exam_edition_answer_key_document_type" is null
			and "questions"."style_bank_id" is null
	) or (
		"questions"."quiz_mode" = 'original_style'
		and "questions"."legal_article_id" is not null
		and "questions"."subject_id" is not null
			and "questions"."exam_edition_id" is null
			and "questions"."exam_edition_document_id" is null
			and "questions"."exam_edition_answer_key_document_id" is null
			and "questions"."exam_edition_answer_key_document_type" is null
			and "questions"."style_bank_id" is not null
		and "questions"."source_rights" = 'original_authorial'
		and nullif(btrim("questions"."learning_objective"), '') is not null
	) or (
		"questions"."quiz_mode" = 'previous_exam'
		and "questions"."subject_id" is not null
			and "questions"."exam_edition_id" is not null
			and "questions"."exam_edition_document_id" is not null
			and "questions"."exam_edition_answer_key_document_id" is not null
			and "questions"."exam_edition_answer_key_document_type" = 'answer_key'
			and "questions"."exam_edition_answer_key_document_id" <> "questions"."exam_edition_document_id"
			and "questions"."style_bank_id" is null
		and "questions"."source_rights" = 'licensed'
	)
);
--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_key_check" CHECK (
	char_length(btrim("question_options"."option_key")) between 1 and 10
);
--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_text_check" CHECK (
	char_length(btrim("question_options"."text")) between 1 and 5000
);
--> statement-breakpoint
DROP INDEX "questions_exam_original_order_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "questions_exam_original_order_uidx" ON "questions" USING btree ("exam_edition_document_id", "original_question_order") WHERE "questions"."exam_edition_document_id" is not null and "questions"."original_question_order" is not null and "questions"."editorial_status" <> 'suspended';
--> statement-breakpoint
CREATE TABLE "exam_edition_documents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_edition_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"exam_edition_id" bigint NOT NULL,
	"document_type" text NOT NULL,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"source_host" text NOT NULL,
	"published_at" timestamp with time zone,
	"source_checked_at" timestamp with time zone NOT NULL,
	"http_status" integer NOT NULL,
	"content_type" text,
	"file_name" text,
	"expected_question_count" integer,
	"distribution_mode" text DEFAULT 'external_link' NOT NULL,
	"source_policy" text DEFAULT 'metadata_only' NOT NULL,
	"checksum_sha256" text,
	"storage_key" text,
	"byte_length" integer,
	"rights_holder" text,
		"license_basis" text,
		"license_reference" text,
		"license_evidence_checksum_sha256" text,
		"license_evidence_checked_at" timestamp with time zone,
		"licensed_at" timestamp with time zone,
	"license_expires_at" timestamp with time zone,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"initiated_by_user_id" bigint NOT NULL,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_edition_documents_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "exam_edition_documents_public_id_check" CHECK ("exam_edition_documents"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "exam_edition_documents_type_check" CHECK ("exam_edition_documents"."document_type" in ('question_booklet', 'answer_key')),
	CONSTRAINT "exam_edition_documents_title_check" CHECK (char_length(btrim("exam_edition_documents"."title")) between 3 and 500),
	CONSTRAINT "exam_edition_documents_url_check" CHECK (
		char_length("exam_edition_documents"."source_url") between 12 and 4096
		and "exam_edition_documents"."source_url" ~* '^https://[a-z0-9.-]+(?:/|$)'
	),
	CONSTRAINT "exam_edition_documents_host_check" CHECK (
		char_length("exam_edition_documents"."source_host") between 1 and 253
		and "exam_edition_documents"."source_host" = lower("exam_edition_documents"."source_host")
		and "exam_edition_documents"."source_host" ~ '^[a-z0-9.-]+$'
		and "exam_edition_documents"."source_host" = lower(substring("exam_edition_documents"."source_url" from '^https://([^/:?#]+)'))
	),
	CONSTRAINT "exam_edition_documents_http_check" CHECK ("exam_edition_documents"."http_status" between 100 and 599),
	CONSTRAINT "exam_edition_documents_content_type_check" CHECK (
		"exam_edition_documents"."content_type" is null
		or (
			char_length("exam_edition_documents"."content_type") between 3 and 255
			and "exam_edition_documents"."content_type" ~* '^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+(?:[[:space:]]*;.*)?$'
		)
	),
	CONSTRAINT "exam_edition_documents_file_name_check" CHECK (
		"exam_edition_documents"."file_name" is null
		or char_length(btrim("exam_edition_documents"."file_name")) between 1 and 255
	),
	CONSTRAINT "exam_edition_documents_expected_questions_check" CHECK (
		(
			"exam_edition_documents"."document_type" = 'question_booklet'
			and "exam_edition_documents"."expected_question_count" is not null
			and "exam_edition_documents"."expected_question_count" between 1 and 300
		) or (
			"exam_edition_documents"."document_type" = 'answer_key'
			and "exam_edition_documents"."expected_question_count" is null
		)
	),
	CONSTRAINT "exam_edition_documents_distribution_check" CHECK ("exam_edition_documents"."distribution_mode" in ('external_link', 'hosted_copy')),
	CONSTRAINT "exam_edition_documents_policy_check" CHECK ("exam_edition_documents"."source_policy" in ('metadata_only', 'licensed_content')),
	CONSTRAINT "exam_edition_documents_checksum_check" CHECK (
		"exam_edition_documents"."checksum_sha256" is null
		or "exam_edition_documents"."checksum_sha256" ~ '^[0-9a-f]{64}$'
	),
	CONSTRAINT "exam_edition_documents_storage_key_check" CHECK (
		"exam_edition_documents"."storage_key" is null
		or (
			char_length("exam_edition_documents"."storage_key") between 3 and 1024
			and "exam_edition_documents"."storage_key" !~ '^/'
			and "exam_edition_documents"."storage_key" !~ '(^|/)\.\.(/|$)'
		)
	),
	CONSTRAINT "exam_edition_documents_source_policy_evidence_check" CHECK (
		(
			"exam_edition_documents"."source_policy" = 'metadata_only'
			and "exam_edition_documents"."rights_holder" is null
			and "exam_edition_documents"."license_basis" is null
			and "exam_edition_documents"."license_reference" is null
			and "exam_edition_documents"."license_evidence_checksum_sha256" is null
			and "exam_edition_documents"."license_evidence_checked_at" is null
			and "exam_edition_documents"."licensed_at" is null
			and "exam_edition_documents"."license_expires_at" is null
		) or (
			"exam_edition_documents"."source_policy" = 'licensed_content'
			and nullif(btrim("exam_edition_documents"."rights_holder"), '') is not null
			and char_length(btrim("exam_edition_documents"."rights_holder")) between 2 and 500
			and nullif(btrim("exam_edition_documents"."license_basis"), '') is not null
			and char_length(btrim("exam_edition_documents"."license_basis")) between 3 and 2000
			and nullif(btrim("exam_edition_documents"."license_reference"), '') is not null
			and char_length(btrim("exam_edition_documents"."license_reference")) between 3 and 2000
			and "exam_edition_documents"."license_evidence_checksum_sha256" is not null
			and "exam_edition_documents"."license_evidence_checksum_sha256" ~ '^[0-9a-f]{64}$'
			and "exam_edition_documents"."license_evidence_checked_at" is not null
			and "exam_edition_documents"."license_evidence_checked_at" <= "exam_edition_documents"."created_at"
			and "exam_edition_documents"."licensed_at" is not null
		)
	),
	CONSTRAINT "exam_edition_documents_storage_check" CHECK (
		(
			"exam_edition_documents"."distribution_mode" = 'external_link'
			and "exam_edition_documents"."storage_key" is null
			and "exam_edition_documents"."byte_length" is null
		) or (
			"exam_edition_documents"."distribution_mode" = 'hosted_copy'
			and "exam_edition_documents"."source_policy" = 'licensed_content'
			and "exam_edition_documents"."storage_key" is not null
			and "exam_edition_documents"."checksum_sha256" is not null
			and "exam_edition_documents"."byte_length" is not null
			and "exam_edition_documents"."byte_length" between 5 and 104857600
			and nullif(btrim("exam_edition_documents"."file_name"), '') is not null
			and "exam_edition_documents"."content_type" is not null
			and lower(split_part("exam_edition_documents"."content_type", ';', 1)) = 'application/pdf'
		)
	),
	CONSTRAINT "exam_edition_documents_license_period_check" CHECK (
		"exam_edition_documents"."license_expires_at" is null
		or (
			"exam_edition_documents"."licensed_at" is not null
			and "exam_edition_documents"."license_expires_at" > "exam_edition_documents"."licensed_at"
		)
	),
	CONSTRAINT "exam_edition_documents_status_check" CHECK ("exam_edition_documents"."status" in ('pending_review', 'approved', 'superseded', 'rejected')),
	CONSTRAINT "exam_edition_documents_review_check" CHECK (
		(
			"exam_edition_documents"."status" = 'pending_review'
			and "exam_edition_documents"."reviewed_by_user_id" is null
			and "exam_edition_documents"."reviewed_at" is null
			and "exam_edition_documents"."review_notes" is null
		) or (
			"exam_edition_documents"."status" <> 'pending_review'
			and "exam_edition_documents"."reviewed_by_user_id" is not null
			and "exam_edition_documents"."reviewed_at" is not null
			and "exam_edition_documents"."reviewed_at" >= "exam_edition_documents"."source_checked_at"
			and nullif(btrim("exam_edition_documents"."review_notes"), '') is not null
			and char_length(btrim("exam_edition_documents"."review_notes")) between 20 and 2000
		)
	),
	CONSTRAINT "exam_edition_documents_approval_check" CHECK (
		"exam_edition_documents"."status" <> 'approved'
		or (
			"exam_edition_documents"."http_status" between 200 and 399
			and "exam_edition_documents"."content_type" is not null
			and lower(split_part("exam_edition_documents"."content_type", ';', 1)) = 'application/pdf'
			and (
				"exam_edition_documents"."source_policy" <> 'licensed_content'
				or (
					"exam_edition_documents"."licensed_at" <= "exam_edition_documents"."reviewed_at"
					and "exam_edition_documents"."license_evidence_checked_at" <= "exam_edition_documents"."reviewed_at"
				)
			)
			and (
				"exam_edition_documents"."license_expires_at" is null
				or "exam_edition_documents"."license_expires_at" > "exam_edition_documents"."reviewed_at"
			)
		)
	),
	CONSTRAINT "exam_edition_documents_independent_review_check" CHECK (
		"exam_edition_documents"."status" <> 'approved'
		or (
			"exam_edition_documents"."initiated_by_user_id" is not null
			and "exam_edition_documents"."reviewed_by_user_id" <> "exam_edition_documents"."initiated_by_user_id"
		)
	)
);
--> statement-breakpoint
ALTER TABLE "exam_edition_documents" ADD CONSTRAINT "exam_edition_documents_exam_edition_id_exam_editions_id_fk" FOREIGN KEY ("exam_edition_id") REFERENCES "public"."exam_editions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_edition_documents" ADD CONSTRAINT "exam_edition_documents_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_edition_documents" ADD CONSTRAINT "exam_edition_documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "exam_edition_documents_identity_scope_uidx" ON "exam_edition_documents" USING btree ("id", "exam_edition_id", "document_type");
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_edition_document_id_exam_edition_documents_id_fk" FOREIGN KEY ("exam_edition_document_id") REFERENCES "public"."exam_edition_documents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_answer_key_document_scope_fk" FOREIGN KEY ("exam_edition_answer_key_document_id", "exam_edition_id", "exam_edition_answer_key_document_type") REFERENCES "public"."exam_edition_documents"("id", "exam_edition_id", "document_type") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "questions_exam_edition_document_id_idx" ON "questions" USING btree ("exam_edition_document_id");
--> statement-breakpoint
CREATE INDEX "questions_exam_answer_key_document_scope_idx" ON "questions" USING btree ("exam_edition_answer_key_document_id", "exam_edition_id", "exam_edition_answer_key_document_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "exam_edition_documents_pending_scope_uidx" ON "exam_edition_documents" USING btree ("exam_edition_id", "document_type", "source_url") WHERE "status" = 'pending_review';
--> statement-breakpoint
CREATE UNIQUE INDEX "exam_edition_documents_approved_scope_uidx" ON "exam_edition_documents" USING btree ("exam_edition_id", "document_type", "source_url") WHERE "status" = 'approved';
--> statement-breakpoint
CREATE UNIQUE INDEX "exam_edition_documents_storage_key_uidx" ON "exam_edition_documents" USING btree ("storage_key") WHERE "storage_key" is not null;
--> statement-breakpoint
CREATE INDEX "exam_edition_documents_edition_status_idx" ON "exam_edition_documents" USING btree ("exam_edition_id", "status", "document_type");
--> statement-breakpoint
CREATE INDEX "exam_edition_documents_initiated_by_idx" ON "exam_edition_documents" USING btree ("initiated_by_user_id");
--> statement-breakpoint
CREATE INDEX "exam_edition_documents_reviewed_by_idx" ON "exam_edition_documents" USING btree ("reviewed_by_user_id");
--> statement-breakpoint
CREATE FUNCTION public.guard_exam_document_license_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW."license_evidence_checksum_sha256" IS DISTINCT FROM OLD."license_evidence_checksum_sha256"
    OR NEW."license_evidence_checked_at" IS DISTINCT FROM OLD."license_evidence_checked_at" THEN
    RAISE EXCEPTION 'A versão da evidência jurídica é imutável; rejeite e registre nova proposta.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.guard_exam_document_license_evidence_immutable() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER "exam_document_license_evidence_immutable_guard"
BEFORE UPDATE ON "exam_edition_documents"
FOR EACH ROW
EXECUTE FUNCTION public.guard_exam_document_license_evidence_immutable();
--> statement-breakpoint
CREATE TABLE "contest_product_exam_references" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contest_product_exam_references_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"product_slug" text NOT NULL,
	"exam_edition_id" bigint NOT NULL,
	"primary_document_id" bigint NOT NULL,
	"primary_document_type" text DEFAULT 'question_booklet' NOT NULL,
	"answer_key_document_id" bigint NOT NULL,
	"answer_key_document_type" text DEFAULT 'answer_key' NOT NULL,
	"relationship" text DEFAULT 'latest_previous_exam' NOT NULL,
	"selection_verified_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"initiated_by_user_id" bigint NOT NULL,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_product_exam_references_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "contest_product_exam_references_public_id_check" CHECK ("contest_product_exam_references"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "contest_product_exam_references_document_type_check" CHECK (
		"contest_product_exam_references"."primary_document_type" = 'question_booklet'
		and "contest_product_exam_references"."answer_key_document_type" = 'answer_key'
		and "contest_product_exam_references"."answer_key_document_id" <> "contest_product_exam_references"."primary_document_id"
	),
	CONSTRAINT "contest_product_exam_references_relationship_check" CHECK ("contest_product_exam_references"."relationship" = 'latest_previous_exam'),
	CONSTRAINT "contest_product_exam_references_status_check" CHECK ("contest_product_exam_references"."status" in ('pending_review', 'approved', 'superseded', 'rejected')),
	CONSTRAINT "contest_product_exam_references_review_check" CHECK (
		(
			"contest_product_exam_references"."status" = 'pending_review'
			and "contest_product_exam_references"."reviewed_by_user_id" is null
			and "contest_product_exam_references"."reviewed_at" is null
			and "contest_product_exam_references"."review_notes" is null
		) or (
			"contest_product_exam_references"."status" <> 'pending_review'
			and "contest_product_exam_references"."reviewed_by_user_id" is not null
			and "contest_product_exam_references"."reviewed_at" is not null
			and "contest_product_exam_references"."reviewed_at" >= "contest_product_exam_references"."selection_verified_at"
			and nullif(btrim("contest_product_exam_references"."review_notes"), '') is not null
			and char_length(btrim("contest_product_exam_references"."review_notes")) between 20 and 2000
		)
	),
	CONSTRAINT "contest_product_exam_references_independent_review_check" CHECK (
		"contest_product_exam_references"."status" <> 'approved'
		or (
			"contest_product_exam_references"."initiated_by_user_id" is not null
			and "contest_product_exam_references"."reviewed_by_user_id" <> "contest_product_exam_references"."initiated_by_user_id"
		)
	)
);
--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_product_slug_contest_store_products_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."contest_store_products"("slug") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_exam_edition_id_exam_editions_id_fk" FOREIGN KEY ("exam_edition_id") REFERENCES "public"."exam_editions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_document_scope_fk" FOREIGN KEY ("primary_document_id", "exam_edition_id", "primary_document_type") REFERENCES "public"."exam_edition_documents"("id", "exam_edition_id", "document_type") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_answer_key_scope_fk" FOREIGN KEY ("answer_key_document_id", "exam_edition_id", "answer_key_document_type") REFERENCES "public"."exam_edition_documents"("id", "exam_edition_id", "document_type") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "contest_product_exam_references_active_identity_uidx" ON "contest_product_exam_references" USING btree ("product_slug", "exam_edition_id", "primary_document_id", "answer_key_document_id", "relationship") WHERE "status" in ('pending_review', 'approved');
--> statement-breakpoint
CREATE UNIQUE INDEX "contest_product_exam_references_approved_uidx" ON "contest_product_exam_references" USING btree ("product_slug", "relationship") WHERE "status" = 'approved';
--> statement-breakpoint
CREATE INDEX "contest_product_exam_references_product_status_idx" ON "contest_product_exam_references" USING btree ("product_slug", "status", "relationship");
--> statement-breakpoint
CREATE INDEX "contest_product_exam_references_edition_idx" ON "contest_product_exam_references" USING btree ("exam_edition_id");
--> statement-breakpoint
CREATE INDEX "contest_product_exam_references_document_scope_idx" ON "contest_product_exam_references" USING btree ("primary_document_id", "exam_edition_id", "primary_document_type");
--> statement-breakpoint
CREATE INDEX "contest_product_exam_references_answer_key_scope_idx" ON "contest_product_exam_references" USING btree ("answer_key_document_id", "exam_edition_id", "answer_key_document_type");
--> statement-breakpoint
CREATE INDEX "contest_product_exam_references_initiated_by_idx" ON "contest_product_exam_references" USING btree ("initiated_by_user_id");
--> statement-breakpoint
CREATE INDEX "contest_product_exam_references_reviewed_by_idx" ON "contest_product_exam_references" USING btree ("reviewed_by_user_id");
--> statement-breakpoint
CREATE FUNCTION public.guard_previous_exam_question_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  option_count integer;
  correct_count integer;
  blank_text_count integer;
  blank_rationale_count integer;
  document_row record;
  answer_key_row record;
BEGIN
  IF TG_OP = 'INSERT'
    AND NEW."quiz_mode" = 'previous_exam'
    AND NEW."editorial_status" = 'reviewed' THEN
    RAISE EXCEPTION 'Questão de prova anterior deve nascer em rascunho e passar por revisão independente.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."quiz_mode" = 'previous_exam' THEN
    IF NEW."exam_edition_document_id" is null
      OR NEW."exam_edition_answer_key_document_id" is null
      OR NEW."exam_edition_answer_key_document_type" IS DISTINCT FROM 'answer_key'
      OR NEW."exam_edition_answer_key_document_id" = NEW."exam_edition_document_id" THEN
      RAISE EXCEPTION 'Questão real exige as versões exatas do caderno e do gabarito licenciados.'
        USING ERRCODE = '23514';
    END IF;

    PERFORM document."id"
    FROM public.exam_edition_documents document
    WHERE document."id" in (
      NEW."exam_edition_document_id",
      NEW."exam_edition_answer_key_document_id"
    )
    ORDER BY document."id"
    FOR SHARE;

    SELECT
      document."id",
      document."exam_edition_id",
      document."document_type",
      document."title",
      document."source_url",
      document."source_policy",
      document."rights_holder",
      document."license_basis",
      document."license_reference",
      document."license_evidence_checksum_sha256",
      document."license_evidence_checked_at",
      document."licensed_at",
      document."license_expires_at",
      document."status"
    INTO document_row
    FROM public.exam_edition_documents document
    WHERE document."id" = NEW."exam_edition_document_id";

    SELECT
      document."id",
      document."exam_edition_id",
      document."document_type",
      document."source_policy",
      document."rights_holder",
      document."license_basis",
      document."license_reference",
      document."license_evidence_checksum_sha256",
      document."license_evidence_checked_at",
      document."licensed_at",
      document."license_expires_at",
      document."status"
    INTO answer_key_row
    FROM public.exam_edition_documents document
    WHERE document."id" = NEW."exam_edition_answer_key_document_id";

    IF document_row."id" is null
      OR document_row."exam_edition_id" IS DISTINCT FROM NEW."exam_edition_id"
      OR document_row."document_type" <> 'question_booklet'
      OR document_row."source_policy" <> 'licensed_content'
      OR document_row."title" IS DISTINCT FROM NEW."source_title"
      OR document_row."source_url" IS DISTINCT FROM NEW."source_url"
      OR document_row."rights_holder" IS DISTINCT FROM NEW."source_rights_holder"
      OR document_row."license_basis" IS DISTINCT FROM NEW."license_basis"
      OR document_row."license_reference" IS DISTINCT FROM NEW."license_reference"
	      OR document_row."license_evidence_checksum_sha256" is null
	      OR document_row."license_evidence_checksum_sha256" !~ '^[0-9a-f]{64}$'
      OR document_row."license_evidence_checked_at" is null
      OR document_row."licensed_at" IS DISTINCT FROM NEW."licensed_at"
      OR document_row."license_expires_at" IS DISTINCT FROM NEW."license_expires_at" THEN
      RAISE EXCEPTION 'Questão real não corresponde ao caderno e à licença selecionados.'
        USING ERRCODE = '23514';
    END IF;

    IF answer_key_row."id" is null
      OR answer_key_row."exam_edition_id" IS DISTINCT FROM NEW."exam_edition_id"
      OR answer_key_row."document_type" <> 'answer_key'
      OR answer_key_row."source_policy" <> 'licensed_content'
      OR nullif(btrim(answer_key_row."rights_holder"), '') is null
      OR nullif(btrim(answer_key_row."license_basis"), '') is null
      OR nullif(btrim(answer_key_row."license_reference"), '') is null
	      OR answer_key_row."license_evidence_checksum_sha256" is null
	      OR answer_key_row."license_evidence_checksum_sha256" !~ '^[0-9a-f]{64}$'
      OR answer_key_row."license_evidence_checked_at" is null
      OR answer_key_row."licensed_at" is null THEN
      RAISE EXCEPTION 'Questão real não corresponde ao gabarito oficial licenciado selecionado.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW."editorial_status" <> 'suspended'
      AND (
        document_row."status" <> 'approved'
        OR answer_key_row."status" <> 'approved'
      ) THEN
      RAISE EXCEPTION 'Questão real ativa exige caderno e gabarito licenciados aprovados.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."quiz_mode" = 'previous_exam'
      AND OLD."editorial_status" in ('reviewed', 'suspended')
      AND OLD."reviewed_by_user_id" is not null THEN
      IF (
        (OLD."editorial_status" = 'reviewed' AND NEW."editorial_status" not in ('reviewed', 'suspended'))
        OR (OLD."editorial_status" = 'suspended' AND NEW."editorial_status" <> 'suspended')
        OR (
          to_jsonb(NEW) - 'editorial_status' - 'updated_at'
          IS DISTINCT FROM
          to_jsonb(OLD) - 'editorial_status' - 'updated_at'
        )
      ) THEN
        RAISE EXCEPTION 'Questão real revisada está selada; somente sua suspensão é permitida.'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW."quiz_mode" = 'previous_exam'
      AND NEW."editorial_status" = 'reviewed'
      AND (
        OLD."quiz_mode" IS DISTINCT FROM 'previous_exam'
        OR OLD."editorial_status" IS DISTINCT FROM 'reviewed'
      ) THEN
      IF NEW."created_by_user_id" is null
        OR NEW."reviewed_by_user_id" is null
        OR NEW."reviewed_by_user_id" = NEW."created_by_user_id" THEN
        RAISE EXCEPTION 'Questão real exige autor e revisor humano distintos.'
          USING ERRCODE = '23514';
      END IF;

      IF NEW."submitted_at" is null
        OR nullif(btrim(NEW."review_notes"), '') is null
        OR char_length(btrim(NEW."review_notes")) not between 20 and 1500 THEN
        RAISE EXCEPTION 'Questão real exige submissão e nota de revisão entre 20 e 1500 caracteres.'
          USING ERRCODE = '23514';
      END IF;

      IF NEW."type" not in ('true_false', 'multiple_choice') THEN
        RAISE EXCEPTION 'Questão real revisada deve ser certo/errado ou múltipla escolha.'
          USING ERRCODE = '23514';
      END IF;

      SELECT
        count(*)::integer,
        count(*) FILTER (WHERE option_row."is_correct")::integer,
        count(*) FILTER (WHERE nullif(btrim(option_row."text"), '') is null)::integer,
        count(*) FILTER (WHERE nullif(btrim(option_row."rationale"), '') is null)::integer
      INTO option_count, correct_count, blank_text_count, blank_rationale_count
      FROM public.question_options option_row
      WHERE option_row."question_id" = NEW."id";

      IF (NEW."type" = 'true_false' AND option_count <> 2)
        OR (NEW."type" = 'multiple_choice' AND option_count not between 4 and 5) THEN
        RAISE EXCEPTION 'Quantidade de alternativas incompatível com o tipo da questão real.'
          USING ERRCODE = '23514';
      END IF;

      IF blank_text_count <> 0 OR blank_rationale_count <> 0 THEN
        RAISE EXCEPTION 'Toda alternativa da questão real precisa de texto e justificativa.'
          USING ERRCODE = '23514';
      END IF;

      IF correct_count <> 1 THEN
        RAISE EXCEPTION 'Questão real revisada precisa ter exatamente uma alternativa correta.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.guard_previous_exam_question_review() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER "previous_exam_question_review_guard"
BEFORE INSERT OR UPDATE ON "questions"
FOR EACH ROW
EXECUTE FUNCTION public.guard_previous_exam_question_review();
--> statement-breakpoint
CREATE FUNCTION public.guard_previous_exam_question_options()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  old_question_id bigint;
  new_question_id bigint;
  question_row record;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_question_id := OLD."question_id";
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_question_id := NEW."question_id";
  END IF;

  FOR question_row IN
    SELECT
      question."id",
      question."quiz_mode",
      question."editorial_status",
      question."reviewed_by_user_id"
    FROM public.questions question
    WHERE question."id" = old_question_id
      OR question."id" = new_question_id
    ORDER BY question."id"
    FOR UPDATE
  LOOP
    IF question_row."quiz_mode" = 'previous_exam'
      AND question_row."editorial_status" in ('reviewed', 'suspended')
      AND question_row."reviewed_by_user_id" is not null THEN
      RAISE EXCEPTION 'Alternativas de questão real revisada estão seladas.'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.guard_previous_exam_question_options() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER "previous_exam_question_option_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "question_options"
FOR EACH ROW
EXECUTE FUNCTION public.guard_previous_exam_question_options();
--> statement-breakpoint
CREATE FUNCTION public.lock_exam_document_review_edition(edition_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET lock_timeout = '5s'
AS $$
BEGIN
  IF edition_id IS NULL OR edition_id <= 0 THEN
    RAISE EXCEPTION 'Escopo de edição inválido' USING ERRCODE = '22023';
  END IF;
  PERFORM e.id FROM public.exam_editions e
    WHERE e.id = edition_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Edição do escopo não encontrada' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lock_exam_document_review_edition(bigint) FROM PUBLIC;
