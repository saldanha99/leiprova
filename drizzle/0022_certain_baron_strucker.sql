CREATE TABLE "opportunity_document_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "opportunity_document_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" text NOT NULL,
	"source_document_id" bigint NOT NULL,
	"document_url" text NOT NULL,
	"source_host" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"document_bytes" "bytea" NOT NULL,
	"checksum_sha256" text NOT NULL,
	"byte_length" integer NOT NULL,
	"page_count" integer NOT NULL,
	"extracted_text" text NOT NULL,
	"page_texts" jsonb NOT NULL,
	"text_length" integer NOT NULL,
	"extraction_method" text DEFAULT 'pdfjs' NOT NULL,
	"parser_version" text NOT NULL,
	"source_policy" text DEFAULT 'official_document' NOT NULL,
	"authorization_scope" text NOT NULL,
	"authorized_at" timestamp with time zone NOT NULL,
	"authorized_by_user_id" bigint,
	"initiated_by_user_id" bigint,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_document_snapshots_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "opportunity_document_snapshots_public_id_check" CHECK ("opportunity_document_snapshots"."public_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "opportunity_document_snapshots_url_check" CHECK ("opportunity_document_snapshots"."document_url" ~* '^https://[a-z0-9.-]+(?:/|$)'),
	CONSTRAINT "opportunity_document_snapshots_host_check" CHECK ("opportunity_document_snapshots"."source_host" = lower("opportunity_document_snapshots"."source_host")
        and "opportunity_document_snapshots"."source_host" ~ '^[a-z0-9.-]+$'
        and "opportunity_document_snapshots"."source_host" = lower(substring("opportunity_document_snapshots"."document_url" from '^https://([^/:?#]+)'))),
	CONSTRAINT "opportunity_document_snapshots_checksum_check" CHECK ("opportunity_document_snapshots"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "opportunity_document_snapshots_size_check" CHECK ("opportunity_document_snapshots"."byte_length" between 5 and 15728640 and octet_length("opportunity_document_snapshots"."document_bytes") = "opportunity_document_snapshots"."byte_length"),
	CONSTRAINT "opportunity_document_snapshots_pages_check" CHECK ("opportunity_document_snapshots"."page_count" between 1 and 250),
	CONSTRAINT "opportunity_document_snapshots_text_check" CHECK ("opportunity_document_snapshots"."text_length" between 100 and 2000000 and char_length("opportunity_document_snapshots"."extracted_text") = "opportunity_document_snapshots"."text_length"),
	CONSTRAINT "opportunity_document_snapshots_policy_check" CHECK ("opportunity_document_snapshots"."source_policy" = 'official_document'),
	CONSTRAINT "opportunity_document_snapshots_authorization_check" CHECK ("opportunity_document_snapshots"."authorization_scope" = 'owner-approval-2026-09-01'),
	CONSTRAINT "opportunity_document_snapshots_status_check" CHECK ("opportunity_document_snapshots"."status" in ('pending_review', 'approved', 'superseded', 'rejected')),
	CONSTRAINT "opportunity_document_snapshots_review_check" CHECK ("opportunity_document_snapshots"."status" <> 'approved' or ("opportunity_document_snapshots"."reviewed_by_user_id" is not null and "opportunity_document_snapshots"."reviewed_at" is not null)),
	CONSTRAINT "opportunity_document_snapshots_independent_review_check" CHECK ("opportunity_document_snapshots"."status" <> 'approved'
        or "opportunity_document_snapshots"."initiated_by_user_id" is null
        or "opportunity_document_snapshots"."reviewed_by_user_id" <> "opportunity_document_snapshots"."initiated_by_user_id"),
	CONSTRAINT "opportunity_document_snapshots_review_notes_check" CHECK ("opportunity_document_snapshots"."review_notes" is null or char_length("opportunity_document_snapshots"."review_notes") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD COLUMN "source_snapshot_id" bigint;--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" ADD CONSTRAINT "opportunity_document_snapshots_source_document_id_opportunity_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."opportunity_source_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" ADD CONSTRAINT "opportunity_document_snapshots_authorized_by_user_id_users_id_fk" FOREIGN KEY ("authorized_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" ADD CONSTRAINT "opportunity_document_snapshots_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" ADD CONSTRAINT "opportunity_document_snapshots_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_document_snapshots_source_checksum_uidx" ON "opportunity_document_snapshots" USING btree ("source_document_id","checksum_sha256");--> statement-breakpoint
CREATE INDEX "opportunity_document_snapshots_source_status_idx" ON "opportunity_document_snapshots" USING btree ("source_document_id","status","created_at");--> statement-breakpoint
CREATE INDEX "opportunity_document_snapshots_initiated_by_idx" ON "opportunity_document_snapshots" USING btree ("initiated_by_user_id");--> statement-breakpoint
CREATE INDEX "opportunity_document_snapshots_reviewed_by_idx" ON "opportunity_document_snapshots" USING btree ("reviewed_by_user_id");--> statement-breakpoint
ALTER TABLE "opportunity_requirements" ADD CONSTRAINT "opportunity_requirements_source_snapshot_id_opportunity_document_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."opportunity_document_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_requirements_snapshot_idx" ON "opportunity_requirements" USING btree ("source_snapshot_id");--> statement-breakpoint
ALTER TABLE "opportunity_document_snapshots" ADD CONSTRAINT "opportunity_document_snapshots_pdf_check" CHECK (
  "mime_type" = 'application/pdf'
  AND "extraction_method" = 'pdfjs'
  AND jsonb_typeof("page_texts") = 'array'
  AND jsonb_array_length("page_texts") = "page_count"
);--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_opportunity_document_snapshot_context"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_status text;
BEGIN
  SELECT source."status"
    INTO source_status
  FROM "opportunity_source_documents" source
  WHERE source."id" = NEW."source_document_id";

  IF source_status IS NULL OR source_status <> 'approved' THEN
    RAISE EXCEPTION 'A captura integral exige uma fonte oficial aprovada.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD."status" = 'approved'
    AND NEW."status" = 'approved'
    AND (
      NEW."source_document_id" IS DISTINCT FROM OLD."source_document_id"
      OR NEW."document_url" IS DISTINCT FROM OLD."document_url"
      OR NEW."document_bytes" IS DISTINCT FROM OLD."document_bytes"
      OR NEW."checksum_sha256" IS DISTINCT FROM OLD."checksum_sha256"
      OR NEW."page_count" IS DISTINCT FROM OLD."page_count"
      OR NEW."extracted_text" IS DISTINCT FROM OLD."extracted_text"
      OR NEW."page_texts" IS DISTINCT FROM OLD."page_texts"
      OR NEW."authorization_scope" IS DISTINCT FROM OLD."authorization_scope"
      OR NEW."reviewed_by_user_id" IS DISTINCT FROM OLD."reviewed_by_user_id"
      OR NEW."reviewed_at" IS DISTINCT FROM OLD."reviewed_at"
    ) THEN
    RAISE EXCEPTION 'Alterações materiais exigem uma nova captura e revisão.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "opportunity_document_snapshot_context_guard"
BEFORE INSERT OR UPDATE ON "opportunity_document_snapshots"
FOR EACH ROW
EXECUTE FUNCTION "validate_opportunity_document_snapshot_context"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_opportunity_requirement_snapshot_context"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  snapshot_source_document_id bigint;
  snapshot_status text;
BEGIN
  IF NEW."source_snapshot_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT snapshot."source_document_id", snapshot."status"
    INTO snapshot_source_document_id, snapshot_status
  FROM "opportunity_document_snapshots" snapshot
  WHERE snapshot."id" = NEW."source_snapshot_id";

  IF snapshot_source_document_id IS NULL
    OR snapshot_source_document_id <> NEW."source_document_id" THEN
    RAISE EXCEPTION 'A captura do requisito deve pertencer à mesma fonte oficial.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."editorial_status" = 'reviewed' AND snapshot_status <> 'approved' THEN
    RAISE EXCEPTION 'Conteúdo programático revisado exige captura oficial aprovada.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "opportunity_requirement_snapshot_context_guard"
BEFORE INSERT OR UPDATE ON "opportunity_requirements"
FOR EACH ROW
EXECUTE FUNCTION "validate_opportunity_requirement_snapshot_context"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_approved_snapshot_dependency_gap"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "opportunity_requirements" requirement
    WHERE requirement."source_snapshot_id" = OLD."id"
      AND requirement."editorial_status" = 'reviewed'
      AND (TG_OP = 'DELETE' OR NEW."status" <> 'approved')
  ) THEN
    RAISE EXCEPTION 'Uma captura usada por requisito revisado precisa continuar aprovada.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "opportunity_document_snapshot_publication_guard"
AFTER UPDATE OR DELETE ON "opportunity_document_snapshots"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "prevent_approved_snapshot_dependency_gap"();
