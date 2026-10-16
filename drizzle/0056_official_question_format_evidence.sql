-- Evidência de formato separada do edital: guarda fatos tipados e hashes, nunca PDF ou texto extraído.
CREATE TABLE official_question_format_evidence (
  id text PRIMARY KEY,
  opportunity_id bigint NOT NULL REFERENCES contest_opportunities(id) ON DELETE RESTRICT,
  exam_edition_id bigint NOT NULL REFERENCES exam_editions(id) ON DELETE RESTRICT,
  bank_id bigint NOT NULL REFERENCES quiz_banks(id) ON DELETE RESTRICT,
  role_name text NOT NULL,
  institution_acronym text NOT NULL,
  jurisdiction_code text NOT NULL,
  exam_edition_document_id bigint NOT NULL,
  document_type text NOT NULL,
  document_public_id text NOT NULL,
  source_url text NOT NULL,
  document_updated_at timestamptz NOT NULL,
  opportunity_updated_at timestamptz NOT NULL,
  edition_updated_at timestamptz NOT NULL,
  verification_date date NOT NULL,
  expires_at timestamptz NOT NULL,
  source_sha256 text NOT NULL,
  robots_sha256 text NOT NULL,
  page_number smallint NOT NULL,
  page_text_sha256 text NOT NULL,
  parser_version text NOT NULL,
  format text NOT NULL,
  option_count smallint NOT NULL,
  single_correct boolean NOT NULL,
  question_count integer NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  approval_reference text NOT NULL,
  approval_basis text NOT NULL DEFAULT 'owner_standing_authorization',
  human_review boolean NOT NULL DEFAULT false,
  reviewed_by_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT official_question_format_evidence_document_scope_fk
    FOREIGN KEY (exam_edition_document_id, exam_edition_id, document_type)
    REFERENCES exam_edition_documents(id, exam_edition_id, document_type) ON DELETE RESTRICT,
  CONSTRAINT official_question_format_evidence_identity_check CHECK (
    opportunity_id = 20 AND exam_edition_id = 41 AND role_name = 'Promotor de Justiça Substituto'
    AND institution_acronym = 'MPRJ' AND jurisdiction_code = 'RJ'
  ),
  CONSTRAINT official_question_format_evidence_hash_check CHECK (
    id ~ '^[a-f0-9]{64}$' AND source_sha256 ~ '^[a-f0-9]{64}$'
    AND robots_sha256 ~ '^[a-f0-9]{64}$' AND page_text_sha256 ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT official_question_format_evidence_facts_check CHECK (
    document_type = 'question_booklet' AND document_public_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND source_url = 'https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substituto-cns001-tipo-1.pdf'
    AND page_number = 1 AND parser_version = 'mprj-type1-cover-mc5-v1'
    AND format = 'multiple_choice' AND option_count = 5 AND single_correct AND question_count = 100
  ),
  CONSTRAINT official_question_format_evidence_status_check CHECK (status IN ('approved','suspended','superseded')),
  CONSTRAINT official_question_format_evidence_authorization_check CHECK (
    expires_at = (verification_date + 2)::timestamp AT TIME ZONE 'UTC'
    AND reviewed_at >= verification_date::timestamp AT TIME ZONE 'UTC'
    AND reviewed_at < (verification_date + 1)::timestamp AT TIME ZONE 'UTC'
    AND approval_reference = 'owner-standing-2026-10-12:official-sources-programs'
    AND approval_basis = 'owner_standing_authorization' AND NOT human_review
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX official_question_format_evidence_active_document_uidx
  ON official_question_format_evidence(exam_edition_document_id) WHERE status = 'approved';
CREATE INDEX official_question_format_evidence_scope_idx
  ON official_question_format_evidence(opportunity_id, exam_edition_id, bank_id, status);
CREATE INDEX official_question_format_evidence_reviewer_idx
  ON official_question_format_evidence(reviewed_by_user_id);
--> statement-breakpoint
CREATE INDEX official_question_format_evidence_document_idx ON official_question_format_evidence(exam_edition_document_id);
CREATE INDEX official_question_format_evidence_edition_idx ON official_question_format_evidence(exam_edition_id);
CREATE INDEX official_question_format_evidence_bank_idx ON official_question_format_evidence(bank_id);
ALTER TABLE official_question_format_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON official_question_format_evidence FROM PUBLIC;
CREATE POLICY official_question_format_evidence_read_approved ON official_question_format_evidence
  FOR SELECT TO PUBLIC USING (status='approved' AND expires_at>now() AND EXISTS (
    SELECT 1 FROM exam_edition_documents d
    JOIN exam_editions e ON e.id=d.exam_edition_id
    JOIN contest_opportunities o ON o.id=official_question_format_evidence.opportunity_id
    JOIN quiz_banks b ON b.id=official_question_format_evidence.bank_id
    WHERE d.id=official_question_format_evidence.exam_edition_document_id
      AND d.exam_edition_id=official_question_format_evidence.exam_edition_id
      AND d.document_type=official_question_format_evidence.document_type
      AND d.public_id=official_question_format_evidence.document_public_id
      AND d.source_url=official_question_format_evidence.source_url AND d.status='approved'
      AND d.updated_at=official_question_format_evidence.document_updated_at
      AND d.source_policy='metadata_only' AND d.distribution_mode='external_link'
      AND d.storage_key IS NULL AND d.byte_length IS NULL
      AND d.http_status=200 AND split_part(d.content_type,';',1)='application/pdf'
      AND d.expected_question_count=100
      AND d.title='MPRJ XXXIX/2026 — prova preambular — caderno Tipo 1'
      AND d.source_host='conhecimento.fgv.br'
      AND (d.published_at AT TIME ZONE 'UTC')::date='2026-06-01'::date
      AND (d.checksum_sha256 IS NULL OR d.checksum_sha256=official_question_format_evidence.source_sha256)
      AND e.bank_id=b.id AND b.slug='fgv' AND b.is_active
      AND e.id=41 AND e.public_id='mprj-promotor-substituto-xxxix-2026-preambular' AND e.institution_acronym='MPRJ' AND e.jurisdiction_code='RJ'
      AND e.status NOT IN ('draft','canceled','archived')
      AND e.source_policy='metadata_only' AND NOT e.source_content_stored
      AND e.updated_at=official_question_format_evidence.edition_updated_at
      AND o.public_id='31739f51-3b4b-4984-a272-54fb549c034d' AND o.exam_edition_id=e.id AND o.role_name=official_question_format_evidence.role_name
      AND o.institution_acronym='MPRJ' AND o.jurisdiction_code='RJ' AND o.cycle_year=2026
      AND o.official_notice_number='XXXIX/2026' AND o.specialization_id IS NULL
      AND o.editorial_status='reviewed' AND o.updated_at=official_question_format_evidence.opportunity_updated_at
      AND e.career_track_id=o.career_track_id AND e.specialization_id IS NULL
  ));
--> statement-breakpoint
CREATE FUNCTION preserve_official_question_format_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at']) THEN
    RAISE EXCEPTION 'Evidência de formato imutável; criar uma nova observação oficial';
  END IF;
  IF OLD.status <> 'approved' AND NEW.status = 'approved' THEN
    RAISE EXCEPTION 'Evidência de formato encerrada não pode ser reaberta';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER preserve_official_question_format_evidence BEFORE UPDATE ON official_question_format_evidence
  FOR EACH ROW EXECUTE FUNCTION preserve_official_question_format_evidence();

--> statement-breakpoint
-- App gates need a boolean lookup, not access to the evidence table. This survives the
-- deployment's table privilege reset without granting any write access to the app.
CREATE FUNCTION public.mprj_question_format_evidence_current(contract_payload jsonb, opportunity bigint, edition bigint, bank bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT opportunity=20 AND edition=41 AND EXISTS (
    SELECT 1 FROM public.official_question_format_evidence f
    JOIN public.official_question_format_evidence admitted
      ON admitted.id=contract_payload->'formatEvidence'->>'evidenceId'
    WHERE admitted.status IN ('approved','superseded')
      AND f.opportunity_id=opportunity AND f.exam_edition_id=edition AND f.bank_id=bank
      AND f.status='approved' AND f.expires_at>now()
      AND f.opportunity_id=admitted.opportunity_id AND f.exam_edition_id=admitted.exam_edition_id
      AND f.bank_id=admitted.bank_id AND f.exam_edition_document_id=admitted.exam_edition_document_id
      AND f.document_public_id=admitted.document_public_id AND f.source_url=admitted.source_url
      AND f.source_sha256=admitted.source_sha256 AND f.page_text_sha256=admitted.page_text_sha256
      AND f.parser_version=admitted.parser_version AND f.page_number=admitted.page_number
      AND f.format=admitted.format AND f.option_count=admitted.option_count
      AND f.single_correct=admitted.single_correct AND f.question_count=admitted.question_count
      AND contract_payload->'formatEvidence'=jsonb_build_object(
        'evidenceId',admitted.id,'documentPublicId',admitted.document_public_id,'sourceUrl',admitted.source_url,
        'sourceSha256',admitted.source_sha256,'robotsSha256',admitted.robots_sha256,'pageTextSha256',admitted.page_text_sha256,
        'pageNumber',admitted.page_number,'parserVersion',admitted.parser_version,'format',admitted.format,
        'optionCount',admitted.option_count,'singleCorrect',admitted.single_correct,'questionCount',admitted.question_count,
        'verificationDate',admitted.verification_date::text)
      AND EXISTS (SELECT 1 FROM public.exam_edition_documents d
    JOIN public.exam_editions e ON e.id=d.exam_edition_id
    JOIN public.contest_opportunities o ON o.id=f.opportunity_id
    JOIN public.quiz_banks b ON b.id=f.bank_id
    WHERE d.id=f.exam_edition_document_id
      AND d.exam_edition_id=f.exam_edition_id
      AND d.document_type=f.document_type
      AND d.public_id=f.document_public_id
      AND d.source_url=f.source_url AND d.status='approved'
      AND d.updated_at=f.document_updated_at
      AND d.source_policy='metadata_only' AND d.distribution_mode='external_link'
      AND d.storage_key IS NULL AND d.byte_length IS NULL
      AND d.http_status=200 AND split_part(d.content_type,';',1)='application/pdf'
      AND d.expected_question_count=100
      AND d.title='MPRJ XXXIX/2026 — prova preambular — caderno Tipo 1'
      AND d.source_host='conhecimento.fgv.br'
      AND (d.published_at AT TIME ZONE 'UTC')::date='2026-06-01'::date
      AND (d.checksum_sha256 IS NULL OR d.checksum_sha256=f.source_sha256)
      AND e.bank_id=b.id AND b.slug='fgv' AND b.is_active
      AND e.id=41 AND e.public_id='mprj-promotor-substituto-xxxix-2026-preambular' AND e.institution_acronym='MPRJ' AND e.jurisdiction_code='RJ'
      AND e.status NOT IN ('draft','canceled','archived')
      AND e.source_policy='metadata_only' AND NOT e.source_content_stored
      AND e.updated_at=f.edition_updated_at
      AND o.public_id='31739f51-3b4b-4984-a272-54fb549c034d' AND o.exam_edition_id=e.id AND o.role_name=f.role_name
      AND o.institution_acronym='MPRJ' AND o.jurisdiction_code='RJ' AND o.cycle_year=2026
      AND o.official_notice_number='XXXIX/2026' AND o.specialization_id IS NULL
      AND o.editorial_status='reviewed' AND o.updated_at=f.opportunity_updated_at
      AND e.career_track_id=o.career_track_id AND e.specialization_id IS NULL)
  )
$$;
REVOKE ALL ON FUNCTION public.mprj_question_format_evidence_current(jsonb,bigint,bigint,bigint) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='leiprova_app') THEN
    GRANT EXECUTE ON FUNCTION public.mprj_question_format_evidence_current(jsonb,bigint,bigint,bigint) TO leiprova_app;
    REVOKE ALL ON public.official_question_format_evidence FROM leiprova_app;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='leiprova_qa_app') THEN
    GRANT EXECUTE ON FUNCTION public.mprj_question_format_evidence_current(jsonb,bigint,bigint,bigint) TO leiprova_qa_app;
    REVOKE ALL ON public.official_question_format_evidence FROM leiprova_qa_app;
  END IF;
END $$;
