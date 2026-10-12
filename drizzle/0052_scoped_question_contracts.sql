-- Sem backfill: fonte/cargo/etapa precisam de decisão auditada e preview exato.
CREATE TABLE opportunity_question_contracts (
  id text PRIMARY KEY,
  opportunity_id bigint NOT NULL REFERENCES contest_opportunities(id) ON DELETE RESTRICT,
  exam_edition_id bigint NOT NULL REFERENCES exam_editions(id) ON DELETE RESTRICT,
  bank_id bigint NOT NULL REFERENCES quiz_banks(id) ON DELETE RESTRICT,
  organizer_assignment_id bigint NOT NULL REFERENCES opportunity_organizer_assignments(id) ON DELETE RESTRICT,
  role_name text NOT NULL, specialization_id bigint, cycle_year integer NOT NULL, notice_number text NOT NULL,
  stage_key text NOT NULL, scope text NOT NULL,
  source_document_id bigint NOT NULL REFERENCES opportunity_source_documents(id) ON DELETE RESTRICT,
  source_snapshot_id bigint NOT NULL REFERENCES opportunity_document_snapshots(id) ON DELETE RESTRICT,
  source_snapshot_checksum text NOT NULL, source_url text NOT NULL,
  format text NOT NULL, option_keys jsonb NOT NULL, payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'approved', approval_reference text NOT NULL,
  approval_basis text NOT NULL DEFAULT 'owner_standing_authorization', human_review boolean NOT NULL DEFAULT false,
  reviewed_by_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_question_contracts_hash_check CHECK(id ~ '^[a-f0-9]{64}$' AND source_snapshot_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT opportunity_question_contracts_scope_check CHECK(stage_key='objective' AND scope='single_role'),
  CONSTRAINT opportunity_question_contracts_status_check CHECK(status IN ('approved','suspended','superseded')),
  CONSTRAINT opportunity_question_contracts_format_check CHECK((format='multiple_choice' AND option_keys='["A","B","C","D","E"]'::jsonb) OR (format='true_false' AND option_keys='["A","B"]'::jsonb)),
  CONSTRAINT opportunity_question_contracts_audit_check CHECK(approval_basis='owner_standing_authorization' AND NOT human_review AND char_length(approval_reference) BETWEEN 10 AND 250),
  CONSTRAINT opportunity_question_contracts_payload_check CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<65536 AND payload->>'format'=format AND payload->'optionKeys'=option_keys AND payload->>'sourceSnapshotChecksum'=source_snapshot_checksum)
);
--> statement-breakpoint
CREATE UNIQUE INDEX opportunity_question_contracts_active_scope_uidx ON opportunity_question_contracts(opportunity_id,stage_key) WHERE status='approved';
CREATE INDEX opportunity_question_contracts_edition_idx ON opportunity_question_contracts(exam_edition_id);
CREATE INDEX opportunity_question_contracts_bank_idx ON opportunity_question_contracts(bank_id);
CREATE INDEX opportunity_question_contracts_assignment_idx ON opportunity_question_contracts(organizer_assignment_id);
CREATE INDEX opportunity_question_contracts_source_idx ON opportunity_question_contracts(source_document_id);
CREATE INDEX opportunity_question_contracts_snapshot_idx ON opportunity_question_contracts(source_snapshot_id);
CREATE INDEX opportunity_question_contracts_reviewer_idx ON opportunity_question_contracts(reviewed_by_user_id);
--> statement-breakpoint
ALTER TABLE questions ADD COLUMN question_contract_id text REFERENCES opportunity_question_contracts(id) ON DELETE RESTRICT;
CREATE INDEX questions_question_contract_idx ON questions(question_contract_id);
--> statement-breakpoint
CREATE TABLE question_contract_certifications (
  binding_id text PRIMARY KEY REFERENCES contest_product_question_bindings(id) ON DELETE RESTRICT,
  contract_id text NOT NULL REFERENCES opportunity_question_contracts(id) ON DELETE RESTRICT,
  question_content_hash text NOT NULL, status text NOT NULL DEFAULT 'approved', approval_reference text NOT NULL,
  human_review boolean NOT NULL DEFAULT false, reviewed_by_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  CONSTRAINT question_contract_certifications_hash_check CHECK(question_content_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT question_contract_certifications_status_check CHECK(status IN ('approved','suspended')),
  CONSTRAINT question_contract_certifications_audit_check CHECK(NOT human_review AND char_length(approval_reference) BETWEEN 10 AND 250)
);
CREATE INDEX question_contract_certifications_contract_idx ON question_contract_certifications(contract_id);
CREATE INDEX question_contract_certifications_reviewer_idx ON question_contract_certifications(reviewed_by_user_id);
--> statement-breakpoint
CREATE FUNCTION preserve_question_contract_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at']) THEN
    RAISE EXCEPTION 'Contrato de formato é imutável; crie uma versão nova auditada';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER preserve_question_contract_evidence BEFORE UPDATE ON opportunity_question_contracts FOR EACH ROW EXECUTE FUNCTION preserve_question_contract_evidence();
--> statement-breakpoint
CREATE FUNCTION lock_question_contract_context(contract_ids text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF cardinality(contract_ids)>250 THEN RAISE EXCEPTION 'Escopo de contrato excedido'; END IF;
  PERFORM o.id FROM public.contest_opportunities o WHERE o.id IN (
    SELECT c.opportunity_id FROM public.opportunity_question_contracts c WHERE c.id=ANY(contract_ids)) ORDER BY o.id FOR UPDATE;
  PERFORM c.id FROM public.opportunity_question_contracts c WHERE c.id=ANY(contract_ids) ORDER BY c.id FOR SHARE;
  PERFORM e.id FROM public.exam_editions e WHERE e.id IN (
    SELECT c.exam_edition_id FROM public.opportunity_question_contracts c WHERE c.id=ANY(contract_ids)) ORDER BY e.id FOR SHARE;
  PERFORM b.id FROM public.quiz_banks b WHERE b.id IN (
    SELECT c.bank_id FROM public.opportunity_question_contracts c WHERE c.id=ANY(contract_ids)) ORDER BY b.id FOR SHARE;
  PERFORM a.id FROM public.opportunity_organizer_assignments a WHERE a.opportunity_id IN (
    SELECT c.opportunity_id FROM public.opportunity_question_contracts c WHERE c.id=ANY(contract_ids)) ORDER BY a.id FOR SHARE;
  PERFORM s.id FROM public.opportunity_source_documents s WHERE s.id IN (
    SELECT c.source_document_id FROM public.opportunity_question_contracts c WHERE c.id=ANY(contract_ids)) ORDER BY s.id FOR SHARE;
  PERFORM s.id FROM public.opportunity_document_snapshots s WHERE s.id IN (
    SELECT c.source_snapshot_id FROM public.opportunity_question_contracts c WHERE c.id=ANY(contract_ids)) ORDER BY s.id FOR SHARE;
END $$;
REVOKE ALL ON FUNCTION lock_question_contract_context(text[]) FROM PUBLIC;
