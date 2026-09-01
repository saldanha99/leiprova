ALTER TABLE "contest_opportunities" DROP CONSTRAINT "contest_opportunities_url_check";--> statement-breakpoint
ALTER TABLE "contest_opportunities" DROP CONSTRAINT "contest_opportunities_review_check";--> statement-breakpoint
ALTER TABLE "opportunity_analysis_snapshots" DROP CONSTRAINT "opportunity_analysis_snapshots_window_check";--> statement-breakpoint
ALTER TABLE "opportunity_organizer_assignments" DROP CONSTRAINT "opportunity_organizer_assignments_bank_check";--> statement-breakpoint
ALTER TABLE "opportunity_source_documents" DROP CONSTRAINT "opportunity_source_documents_url_check";--> statement-breakpoint
ALTER TABLE "opportunity_source_documents" DROP CONSTRAINT "opportunity_source_documents_host_check";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_reviewed_provenance_check";--> statement-breakpoint
DROP INDEX "contest_opportunities_identity_uidx";--> statement-breakpoint
ALTER TABLE "legal_articles" ALTER COLUMN "editorial_status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "editorial_status" SET DEFAULT 'draft';--> statement-breakpoint
UPDATE "questions"
SET "editorial_status" = 'pending_review', "updated_at" = now()
WHERE "editorial_status" = 'reviewed'
  AND "reviewed_by_user_id" IS NULL;--> statement-breakpoint
UPDATE "legal_articles" article
SET "editorial_status" = 'pending_review', "updated_at" = now()
WHERE article."editorial_status" = 'reviewed'
  AND EXISTS (
    SELECT 1
    FROM "questions" question
    WHERE question."legal_article_id" = article."id"
      AND question."editorial_status" = 'pending_review'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "questions" question
    WHERE question."legal_article_id" = article."id"
      AND question."editorial_status" = 'reviewed'
      AND question."reviewed_by_user_id" IS NOT NULL
  );--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_category_career_fk" FOREIGN KEY ("category_id","career_track_id") REFERENCES "public"."contest_category_careers"("category_id","career_track_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contest_opportunities_pre_notice_identity_uidx" ON "contest_opportunities" USING btree ("institution_acronym","cycle_year","role_name","jurisdiction_code") WHERE "contest_opportunities"."official_notice_number" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_organizer_assignments_exam_provider_active_uidx" ON "opportunity_organizer_assignments" USING btree ("opportunity_id") WHERE "opportunity_organizer_assignments"."role" = 'examination_provider' and "opportunity_organizer_assignments"."status" = 'reviewed' and "opportunity_organizer_assignments"."valid_until" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "contest_opportunities_identity_uidx" ON "contest_opportunities" USING btree ("institution_acronym","official_notice_number","cycle_year","role_name") WHERE "contest_opportunities"."official_notice_number" is not null;--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_url_check" CHECK ("contest_opportunities"."official_url" is null or "contest_opportunities"."official_url" ~* '^https://[a-z0-9.-]+(?:/|$)');--> statement-breakpoint
ALTER TABLE "contest_opportunities" ADD CONSTRAINT "contest_opportunities_review_check" CHECK ("contest_opportunities"."editorial_status" <> 'reviewed' or (
        "contest_opportunities"."official_url" is not null
        and "contest_opportunities"."source_checked_at" is not null
        and "contest_opportunities"."reviewed_by_user_id" is not null
        and "contest_opportunities"."reviewed_at" is not null
        and "contest_opportunities"."reviewed_at" >= "contest_opportunities"."source_checked_at"
        and "contest_opportunities"."published_at" is not null
      ));--> statement-breakpoint
ALTER TABLE "opportunity_analysis_snapshots" ADD CONSTRAINT "opportunity_analysis_snapshots_window_check" CHECK ("opportunity_analysis_snapshots"."window_start_year" between 2000 and 2200
        and "opportunity_analysis_snapshots"."window_end_year" between "opportunity_analysis_snapshots"."window_start_year" and 2200
        and "opportunity_analysis_snapshots"."window_end_year" - "opportunity_analysis_snapshots"."window_start_year" + 1 = "opportunity_analysis_snapshots"."lookback_years");--> statement-breakpoint
ALTER TABLE "opportunity_organizer_assignments" ADD CONSTRAINT "opportunity_organizer_assignments_bank_check" CHECK (("opportunity_organizer_assignments"."responsible_type" <> 'institutional_commission' or "opportunity_organizer_assignments"."quiz_bank_id" is null)
        and ("opportunity_organizer_assignments"."role" <> 'logistics_provider' or "opportunity_organizer_assignments"."quiz_bank_id" is null));--> statement-breakpoint
ALTER TABLE "opportunity_source_documents" ADD CONSTRAINT "opportunity_source_documents_url_check" CHECK ("opportunity_source_documents"."source_url" ~* '^https://[a-z0-9.-]+(?:/|$)');--> statement-breakpoint
ALTER TABLE "opportunity_source_documents" ADD CONSTRAINT "opportunity_source_documents_host_check" CHECK ("opportunity_source_documents"."source_host" = lower("opportunity_source_documents"."source_host")
        and "opportunity_source_documents"."source_host" ~ '^[a-z0-9.-]+$'
        and "opportunity_source_documents"."source_host" = lower(substring("opportunity_source_documents"."source_url" from '^https://([^/:?#]+)')));--> statement-breakpoint
ALTER TABLE "question_opportunities" ADD CONSTRAINT "question_opportunities_statistical_snapshot_check" CHECK ("question_opportunities"."relationship" <> 'statistical_priority' or "question_opportunities"."analysis_snapshot_id" is not null);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewed_provenance_check" CHECK ("questions"."editorial_status" <> 'reviewed' or "questions"."reviewed_by_user_id" is not null);--> statement-breakpoint
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
        AND source."source_url" = NEW."official_url"
    ) THEN
      RAISE EXCEPTION 'A URL pública da oportunidade exige uma fonte oficial aprovada correspondente.'
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
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_reviewed_contest_opportunity_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."editorial_status" = 'reviewed'
    AND NEW."editorial_status" = 'reviewed'
    AND (
      NEW."category_id" IS DISTINCT FROM OLD."category_id"
      OR NEW."career_track_id" IS DISTINCT FROM OLD."career_track_id"
      OR NEW."specialization_id" IS DISTINCT FROM OLD."specialization_id"
      OR NEW."jurisdiction_code" IS DISTINCT FROM OLD."jurisdiction_code"
      OR NEW."scope" IS DISTINCT FROM OLD."scope"
      OR NEW."cycle_year" IS DISTINCT FROM OLD."cycle_year"
      OR NEW."institution_acronym" IS DISTINCT FROM OLD."institution_acronym"
      OR NEW."institution_name" IS DISTINCT FROM OLD."institution_name"
      OR NEW."role_name" IS DISTINCT FROM OLD."role_name"
      OR NEW."official_notice_number" IS DISTINCT FROM OLD."official_notice_number"
      OR NEW."title" IS DISTINCT FROM OLD."title"
      OR NEW."summary" IS DISTINCT FROM OLD."summary"
      OR NEW."lifecycle_status" IS DISTINCT FROM OLD."lifecycle_status"
      OR NEW."status_as_of" IS DISTINCT FROM OLD."status_as_of"
      OR NEW."official_url" IS DISTINCT FROM OLD."official_url"
      OR NEW."announced_at" IS DISTINCT FROM OLD."announced_at"
      OR NEW."notice_published_at" IS DISTINCT FROM OLD."notice_published_at"
      OR NEW."registration_starts_at" IS DISTINCT FROM OLD."registration_starts_at"
      OR NEW."registration_ends_at" IS DISTINCT FROM OLD."registration_ends_at"
      OR NEW."exam_date" IS DISTINCT FROM OLD."exam_date"
      OR NEW."source_checked_at" IS DISTINCT FROM OLD."source_checked_at"
      OR NEW."reviewed_by_user_id" IS DISTINCT FROM OLD."reviewed_by_user_id"
      OR NEW."reviewed_at" IS DISTINCT FROM OLD."reviewed_at"
    ) THEN
      RAISE EXCEPTION 'Alterações materiais exigem retornar a oportunidade para revisão.'
        USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "contest_opportunity_reviewed_mutation_guard"
BEFORE UPDATE ON "contest_opportunities"
FOR EACH ROW
EXECUTE FUNCTION "prevent_reviewed_contest_opportunity_mutation"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_approved_opportunity_source_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'approved'
    AND NEW."status" = 'approved'
    AND (
      NEW."opportunity_id" IS DISTINCT FROM OLD."opportunity_id"
      OR NEW."document_type" IS DISTINCT FROM OLD."document_type"
      OR NEW."source_external_id" IS DISTINCT FROM OLD."source_external_id"
      OR NEW."title" IS DISTINCT FROM OLD."title"
      OR NEW."source_url" IS DISTINCT FROM OLD."source_url"
      OR NEW."source_host" IS DISTINCT FROM OLD."source_host"
      OR NEW."published_at" IS DISTINCT FROM OLD."published_at"
      OR NEW."observed_at" IS DISTINCT FROM OLD."observed_at"
      OR NEW."checksum_sha256" IS DISTINCT FROM OLD."checksum_sha256"
      OR NEW."http_status" IS DISTINCT FROM OLD."http_status"
      OR NEW."content_type" IS DISTINCT FROM OLD."content_type"
      OR NEW."source_policy" IS DISTINCT FROM OLD."source_policy"
      OR NEW."source_content_stored" IS DISTINCT FROM OLD."source_content_stored"
      OR NEW."supersedes_public_id" IS DISTINCT FROM OLD."supersedes_public_id"
      OR NEW."reviewed_by_user_id" IS DISTINCT FROM OLD."reviewed_by_user_id"
      OR NEW."reviewed_at" IS DISTINCT FROM OLD."reviewed_at"
    ) THEN
      RAISE EXCEPTION 'Alterações materiais exigem nova revisão da fonte oficial.'
        USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "opportunity_source_document_approved_mutation_guard"
BEFORE UPDATE ON "opportunity_source_documents"
FOR EACH ROW
EXECUTE FUNCTION "prevent_approved_opportunity_source_mutation"();--> statement-breakpoint
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
    FROM "opportunity_requirements" requirement
    LEFT JOIN "opportunity_source_documents" source
      ON source."id" = requirement."source_document_id"
    WHERE requirement."source_document_id" = OLD."id"
      AND requirement."editorial_status" = 'reviewed'
      AND (source."id" IS NULL OR source."status" <> 'approved')
  ) THEN
    RAISE EXCEPTION 'Um conteúdo programático revisado não pode perder sua fonte oficial aprovada.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "contest_opportunities" opportunity
    WHERE opportunity."id" = affected_opportunity_id
      AND opportunity."editorial_status" = 'reviewed'
  ) AND NOT EXISTS (
    SELECT 1
    FROM "contest_opportunities" opportunity
    JOIN "opportunity_source_documents" source
      ON source."opportunity_id" = opportunity."id"
      AND source."source_url" = opportunity."official_url"
      AND source."status" = 'approved'
    WHERE opportunity."id" = affected_opportunity_id
  ) THEN
    RAISE EXCEPTION 'Uma oportunidade pública não pode perder a fonte aprovada de sua URL oficial.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_opportunity_organizer_assignment"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_opportunity_id bigint;
  source_status text;
BEGIN
  PERFORM 1
  FROM "contest_opportunities"
  WHERE "id" = NEW."opportunity_id"
  FOR UPDATE;

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

  IF NEW."status" = 'reviewed'
    AND NEW."valid_until" IS NULL
    AND NEW."quiz_bank_id" IS NOT NULL
    AND NEW."role" IN ('primary_responsible', 'examination_provider')
    AND EXISTS (
      SELECT 1
      FROM "opportunity_organizer_assignments" assignment
      WHERE assignment."opportunity_id" = NEW."opportunity_id"
        AND assignment."id" <> NEW."id"
        AND assignment."status" = 'reviewed'
        AND assignment."valid_until" IS NULL
        AND assignment."role" IN ('primary_responsible', 'examination_provider')
        AND assignment."quiz_bank_id" IS NOT NULL
        AND assignment."quiz_bank_id" <> NEW."quiz_bank_id"
    ) THEN
      RAISE EXCEPTION 'Uma edição não pode ter perfis de banca vigentes conflitantes.'
        USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_reviewed_organizer_assignment_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'reviewed'
    AND NEW."status" = 'reviewed'
    AND (
      NEW."opportunity_id" IS DISTINCT FROM OLD."opportunity_id"
      OR NEW."quiz_bank_id" IS DISTINCT FROM OLD."quiz_bank_id"
      OR NEW."source_document_id" IS DISTINCT FROM OLD."source_document_id"
      OR NEW."responsible_type" IS DISTINCT FROM OLD."responsible_type"
      OR NEW."role" IS DISTINCT FROM OLD."role"
      OR NEW."organizer_slug" IS DISTINCT FROM OLD."organizer_slug"
      OR NEW."organizer_name" IS DISTINCT FROM OLD."organizer_name"
      OR NEW."valid_from" IS DISTINCT FROM OLD."valid_from"
      OR NEW."valid_until" IS DISTINCT FROM OLD."valid_until"
      OR NEW."reviewed_by_user_id" IS DISTINCT FROM OLD."reviewed_by_user_id"
      OR NEW."reviewed_at" IS DISTINCT FROM OLD."reviewed_at"
    ) THEN
      RAISE EXCEPTION 'Alterações materiais exigem nova revisão do responsável da edição.'
        USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "opportunity_organizer_assignment_reviewed_mutation_guard"
BEFORE UPDATE ON "opportunity_organizer_assignments"
FOR EACH ROW
EXECUTE FUNCTION "prevent_reviewed_organizer_assignment_mutation"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_reviewed_analysis_assignment_gap"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "opportunity_analysis_snapshots" analysis
    LEFT JOIN "opportunity_organizer_assignments" assignment
      ON assignment."id" = analysis."organizer_assignment_id"
    WHERE analysis."organizer_assignment_id" = OLD."id"
      AND analysis."status" = 'reviewed'
      AND (
        assignment."id" IS NULL
        OR assignment."status" <> 'reviewed'
        OR assignment."valid_until" IS NOT NULL
        OR assignment."role" = 'logistics_provider'
      )
  ) THEN
    RAISE EXCEPTION 'Uma análise revisada não pode perder seu responsável de prova vigente.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "opportunity_analysis_assignment_publication_guard"
AFTER UPDATE OR DELETE ON "opportunity_organizer_assignments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "prevent_reviewed_analysis_assignment_gap"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_opportunity_analysis_context"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_opportunity_id bigint;
  assignment_status text;
  assignment_role text;
  assignment_valid_until date;
BEGIN
  SELECT assignment."opportunity_id", assignment."status", assignment."role", assignment."valid_until"
    INTO assignment_opportunity_id, assignment_status, assignment_role, assignment_valid_until
  FROM "opportunity_organizer_assignments" assignment
  WHERE assignment."id" = NEW."organizer_assignment_id";

  IF assignment_opportunity_id IS NULL
    OR assignment_opportunity_id <> NEW."opportunity_id" THEN
    RAISE EXCEPTION 'A análise deve usar um responsável da mesma oportunidade.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."status" = 'reviewed' AND (
    assignment_status <> 'reviewed'
    OR assignment_role = 'logistics_provider'
    OR assignment_valid_until IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Uma análise revisada exige responsável de prova vigente e revisado.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_reviewed_opportunity_analysis_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'reviewed'
    AND NEW."status" = 'reviewed'
    AND (
      NEW."opportunity_id" IS DISTINCT FROM OLD."opportunity_id"
      OR NEW."organizer_assignment_id" IS DISTINCT FROM OLD."organizer_assignment_id"
      OR NEW."analysis_kind" IS DISTINCT FROM OLD."analysis_kind"
      OR NEW."methodology_version" IS DISTINCT FROM OLD."methodology_version"
      OR NEW."lookback_years" IS DISTINCT FROM OLD."lookback_years"
      OR NEW."window_start_year" IS DISTINCT FROM OLD."window_start_year"
      OR NEW."window_end_year" IS DISTINCT FROM OLD."window_end_year"
      OR NEW."sample_size" IS DISTINCT FROM OLD."sample_size"
      OR NEW."corpus_basis" IS DISTINCT FROM OLD."corpus_basis"
      OR NEW."corpus_rights_reference" IS DISTINCT FROM OLD."corpus_rights_reference"
      OR NEW."methodology" IS DISTINCT FROM OLD."methodology"
      OR NEW."scores" IS DISTINCT FROM OLD."scores"
      OR NEW."confidence_bps" IS DISTINCT FROM OLD."confidence_bps"
      OR NEW."limitations" IS DISTINCT FROM OLD."limitations"
      OR NEW."reviewed_by_user_id" IS DISTINCT FROM OLD."reviewed_by_user_id"
      OR NEW."reviewed_at" IS DISTINCT FROM OLD."reviewed_at"
    ) THEN
      RAISE EXCEPTION 'Alterações materiais exigem nova revisão da análise estatística.'
        USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "opportunity_analysis_reviewed_mutation_guard"
BEFORE UPDATE ON "opportunity_analysis_snapshots"
FOR EACH ROW
EXECUTE FUNCTION "prevent_reviewed_opportunity_analysis_mutation"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_opportunity_requirement_context"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_opportunity_id bigint;
  source_status text;
  topic_subject_id bigint;
  article_legal_act_id bigint;
  article_editorial_status text;
BEGIN
  SELECT source."opportunity_id", source."status"
    INTO source_opportunity_id, source_status
  FROM "opportunity_source_documents" source
  WHERE source."id" = NEW."source_document_id";

  IF source_opportunity_id IS NULL OR source_opportunity_id <> NEW."opportunity_id" THEN
    RAISE EXCEPTION 'A fonte do conteúdo programático deve pertencer à mesma oportunidade.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."editorial_status" = 'reviewed' AND source_status <> 'approved' THEN
    RAISE EXCEPTION 'Conteúdo programático revisado exige fonte oficial aprovada.'
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
    SELECT version."legal_act_id", article."editorial_status"
      INTO article_legal_act_id, article_editorial_status
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

    IF NEW."editorial_status" = 'reviewed' AND article_editorial_status <> 'reviewed' THEN
      RAISE EXCEPTION 'Conteúdo programático revisado exige artigo jurídico revisado.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_statistical_question_analysis_gap"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "question_opportunities" relation
    LEFT JOIN "opportunity_analysis_snapshots" analysis
      ON analysis."id" = relation."analysis_snapshot_id"
    WHERE relation."analysis_snapshot_id" = OLD."id"
      AND relation."relationship" = 'statistical_priority'
      AND (analysis."id" IS NULL OR analysis."status" <> 'reviewed')
  ) THEN
    RAISE EXCEPTION 'Uma prioridade estatística não pode perder sua análise revisada.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "question_opportunity_analysis_publication_guard"
AFTER UPDATE OR DELETE ON "opportunity_analysis_snapshots"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "prevent_statistical_question_analysis_gap"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_reviewed_opportunity_requirement_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."editorial_status" = 'reviewed'
    AND NEW."editorial_status" = 'reviewed'
    AND (
      NEW."opportunity_id" IS DISTINCT FROM OLD."opportunity_id"
      OR NEW."source_document_id" IS DISTINCT FROM OLD."source_document_id"
      OR NEW."subject_id" IS DISTINCT FROM OLD."subject_id"
      OR NEW."topic_id" IS DISTINCT FROM OLD."topic_id"
      OR NEW."legal_act_id" IS DISTINCT FROM OLD."legal_act_id"
      OR NEW."legal_article_id" IS DISTINCT FROM OLD."legal_article_id"
      OR NEW."requirement_text" IS DISTINCT FROM OLD."requirement_text"
      OR NEW."source_locator" IS DISTINCT FROM OLD."source_locator"
      OR NEW."reviewed_by_user_id" IS DISTINCT FROM OLD."reviewed_by_user_id"
      OR NEW."reviewed_at" IS DISTINCT FROM OLD."reviewed_at"
    ) THEN
      RAISE EXCEPTION 'Alterações materiais exigem nova revisão do conteúdo programático.'
        USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "opportunity_requirement_reviewed_mutation_guard"
BEFORE UPDATE ON "opportunity_requirements"
FOR EACH ROW
EXECUTE FUNCTION "prevent_reviewed_opportunity_requirement_mutation"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_question_opportunity_context"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  analysis_opportunity_id bigint;
  analysis_status text;
BEGIN
  IF NEW."analysis_snapshot_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT analysis."opportunity_id", analysis."status"
    INTO analysis_opportunity_id, analysis_status
  FROM "opportunity_analysis_snapshots" analysis
  WHERE analysis."id" = NEW."analysis_snapshot_id";

  IF analysis_opportunity_id IS NULL
    OR analysis_opportunity_id <> NEW."opportunity_id" THEN
    RAISE EXCEPTION 'A questão deve usar uma análise da mesma oportunidade.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."relationship" = 'statistical_priority' AND analysis_status <> 'reviewed' THEN
    RAISE EXCEPTION 'Prioridade estatística exige uma análise revisada.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
