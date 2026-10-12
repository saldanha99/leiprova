-- Evidência complementar delimitada: decreto anual e anexo em IDs próprios.
-- Vigência normativa e cobertura editorial são campos distintos. Sem backfill.
CREATE TABLE legal_complementary_sources (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, public_id text NOT NULL UNIQUE,
 legal_act_id bigint NOT NULL REFERENCES legal_acts(id) ON DELETE RESTRICT,
 source_key text NOT NULL, source_kind text NOT NULL, source_url text NOT NULL,
 source_act_type text NOT NULL, source_act_number text NOT NULL, source_act_year integer NOT NULL,
 parser_version text NOT NULL, raw_checksum_sha256 text NOT NULL,
 normalized_checksum_sha256 text NOT NULL, normalized_body text NOT NULL, evidence_fingerprint text NOT NULL,
 facts jsonb NOT NULL, source_validity_observation jsonb NOT NULL,
 normative_effective_from date NOT NULL, normative_valid_until date,
 editorial_coverage_from date NOT NULL, editorial_coverage_through date NOT NULL,
 status text NOT NULL DEFAULT 'pending_review', approval_audit_id bigint REFERENCES audit_logs(id) ON DELETE RESTRICT, approval_reference text, approval_mode text,
 human_review boolean NOT NULL DEFAULT false, reviewed_by_user_id bigint REFERENCES users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz, last_verified_at timestamptz, fetched_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT legal_complementary_sources_public_id_check CHECK(public_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 CONSTRAINT legal_complementary_sources_observation_check CHECK(coalesce(jsonb_typeof(source_validity_observation)='object' AND source_validity_observation->>'metadataUrl'='https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-norma-pe.html' AND source_validity_observation->>'metadataRawSha256'='64bba0bf0f12c09cd0ac59c686f1b35fb5e55a440cbc3a3527b2e79a5f3b5df6' AND source_validity_observation->'expressRevocationReported'='false'::jsonb AND source_validity_observation->>'observedAt' ~ '^2026-[0-9]{2}-[0-9]{2}T',false)),
 CONSTRAINT legal_complementary_sources_status_check CHECK(status IN ('pending_review','approved','rejected','suspended','superseded')),
 CONSTRAINT legal_complementary_sources_hash_check CHECK(raw_checksum_sha256 ~ '^[a-f0-9]{64}$' AND normalized_checksum_sha256 ~ '^[a-f0-9]{64}$' AND evidence_fingerprint ~ '^[a-f0-9]{64}$'),
 CONSTRAINT legal_complementary_sources_identity_check CHECK(source_act_type='decreto' AND source_act_number='12.807' AND source_act_year=2025 AND parser_version='camara-decree-12807-body-annex-v1'),
 CONSTRAINT legal_complementary_sources_dates_check CHECK(normative_effective_from='2026-01-01' AND normative_valid_until IS NULL AND editorial_coverage_from='2026-01-01' AND editorial_coverage_through='2026-12-31'),
 CONSTRAINT legal_complementary_sources_body_check CHECK(char_length(normalized_body) BETWEEN 100 AND 100000 AND normalized_checksum_sha256=encode(sha256(convert_to(normalized_body,'UTF8')),'hex')),
 CONSTRAINT legal_complementary_sources_facts_check CHECK(coalesce(jsonb_typeof(facts)='object' AND facts->>'policy'='decree-12807-applied-values-2026-v1' AND jsonb_typeof(facts->'amounts')='array' AND jsonb_array_length(facts->'amounts')=9,false)),
 CONSTRAINT legal_complementary_sources_approval_check CHECK(NOT human_review AND (status<>'approved' OR (approval_reference IS NOT NULL AND approval_mode IS NOT NULL AND approval_audit_id IS NOT NULL AND approval_reference='owner-standing-2026-10-12:official-sources-programs' AND approval_mode='owner_standing_authorization' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND last_verified_at IS NOT NULL))),
 CONSTRAINT legal_complementary_sources_url_check CHECK((source_kind='annual_decree_body' AND source_key='decree-12807-2025-body-2026' AND source_url='https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-publicacaooriginal-177646-pe.html') OR (source_kind='annual_decree_annex' AND source_key='decree-12807-2025-annex-2026' AND source_url='https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-anexo-pe.pdf'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX legal_complementary_sources_evidence_uidx ON legal_complementary_sources(legal_act_id,source_key,evidence_fingerprint);
CREATE UNIQUE INDEX legal_complementary_sources_approved_uidx ON legal_complementary_sources(legal_act_id,source_key) WHERE status='approved';
CREATE INDEX legal_complementary_sources_act_idx ON legal_complementary_sources(legal_act_id);
CREATE INDEX legal_complementary_sources_audit_idx ON legal_complementary_sources(approval_audit_id);
CREATE INDEX legal_complementary_sources_reviewer_idx ON legal_complementary_sources(reviewed_by_user_id);
--> statement-breakpoint
ALTER TABLE legal_complementary_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legal_complementary_sources FROM PUBLIC;
REVOKE ALL ON SEQUENCE legal_complementary_sources_id_seq FROM PUBLIC;
-- APP recebe somente SELECT. Manutenção usa o proprietário existente, sem SECURITY DEFINER.
CREATE POLICY legal_complementary_sources_read_approved ON legal_complementary_sources FOR SELECT TO PUBLIC USING(status='approved' AND last_verified_at>=now()-interval '6 hours' AND last_verified_at<=now()+interval '30 seconds');
--> statement-breakpoint
CREATE FUNCTION preserve_legal_complementary_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['status','approval_audit_id','approval_reference','approval_mode','reviewed_by_user_id','reviewed_at','last_verified_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','approval_audit_id','approval_reference','approval_mode','reviewed_by_user_id','reviewed_at','last_verified_at','updated_at']) THEN
  RAISE EXCEPTION 'Fonte complementar imutável; criar nova versão auditada';
 END IF;
 IF OLD.status<>'pending_review' AND (NEW.approval_audit_id,NEW.approval_reference,NEW.approval_mode,NEW.reviewed_by_user_id,NEW.reviewed_at) IS DISTINCT FROM (OLD.approval_audit_id,OLD.approval_reference,OLD.approval_mode,OLD.reviewed_by_user_id,OLD.reviewed_at) THEN
  RAISE EXCEPTION 'Recibo complementar aprovado é imutável';
 END IF;
 IF OLD.status IN ('rejected','suspended','superseded') AND NEW.status='approved' THEN
  RAISE EXCEPTION 'Não restaurar fonte complementar encerrada';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_legal_complementary_evidence BEFORE UPDATE ON legal_complementary_sources FOR EACH ROW EXECUTE FUNCTION preserve_legal_complementary_evidence();
