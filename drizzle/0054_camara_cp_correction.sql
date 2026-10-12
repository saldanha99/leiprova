-- Exact scoped Câmara CP corpus admission. No data/backfill, no current-version switch.
ALTER TABLE legal_source_snapshots DROP CONSTRAINT legal_source_snapshots_url_check;
--> statement-breakpoint
ALTER TABLE legal_source_snapshots ADD CONSTRAINT legal_source_snapshots_url_check CHECK (
 source_url ~ '^https://legis\.senado\.leg\.br/norma/[0-9]+$'
 OR (source_url='https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html'
     AND legal_act_id=17 AND article_marker_count=402 AND checksum_sha256='7cd4ac2c76ca87f8032df0bd0c369dcfe7b1458038cd956bd01e5d7b68d8323d'
     AND checksum_sha256=encode(sha256(convert_to(normalized_content,'UTF8')),'hex'))
);
--> statement-breakpoint
ALTER TABLE legal_text_snapshots DROP CONSTRAINT legal_text_snapshots_url_check;
--> statement-breakpoint
ALTER TABLE legal_text_snapshots ADD CONSTRAINT legal_text_snapshots_url_check CHECK (
 source_url ~ '^https://legis\.senado\.leg\.br/norma/[0-9]+/publicacao/[0-9]+$'
 OR source_url IN (
 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm',
 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
 'https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html',
 'https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-normaatualizada-pl.pdf')
 OR (source_url='https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html'
     AND legal_act_id=17 AND article_count=402 AND parser_version='camara-cp-correction-preview-v1.0.0'
     AND checksum_sha256='7cd4ac2c76ca87f8032df0bd0c369dcfe7b1458038cd956bd01e5d7b68d8323d'
     AND checksum_sha256=encode(sha256(convert_to(normalized_content,'UTF8')),'hex'))
);
--> statement-breakpoint
-- Amendment proof has its own fields; it is not CP literal, a Senate monitor or a loaded standalone law.
CREATE TABLE legal_cp_correction_evidence (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, public_id text NOT NULL UNIQUE,
 legal_act_id bigint NOT NULL REFERENCES legal_acts(id) ON DELETE RESTRICT,
 monitor_snapshot_id bigint NOT NULL REFERENCES legal_source_snapshots(id) ON DELETE RESTRICT,
 text_snapshot_id bigint NOT NULL REFERENCES legal_text_snapshots(id) ON DELETE RESTRICT,
 legal_version_id bigint NOT NULL REFERENCES legal_versions(id) ON DELETE RESTRICT,
 cp_url text NOT NULL, cp_raw_sha256 text NOT NULL, canonical_sha256 text NOT NULL, parser_version text NOT NULL,
 amendment_url text NOT NULL, amendment_raw_sha256 text NOT NULL, amendment_html text NOT NULL,
 fetched_at timestamptz NOT NULL, amendment_fetched_at timestamptz NOT NULL, robots_sha256 text NOT NULL,
 fingerprint text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending_review',
 reviewed_by_user_id bigint REFERENCES users(id) ON DELETE RESTRICT, reviewed_at timestamptz,
 approval_audit_id bigint REFERENCES audit_logs(id) ON DELETE RESTRICT, approval_reference text, human_review boolean NOT NULL DEFAULT false,
 metadata jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT legal_cp_correction_evidence_scope CHECK(legal_act_id=17 AND parser_version='camara-cp-correction-preview-v1.0.0'
  AND cp_url='https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html'
  AND cp_raw_sha256='57547f371c5dd6e609f453397d2098e3930876b03f7233096b0dff907832b3e4'
  AND canonical_sha256='7cd4ac2c76ca87f8032df0bd0c369dcfe7b1458038cd956bd01e5d7b68d8323d'
  AND amendment_url='https://www2.camara.leg.br/legin/fed/lei/2026/lei-15517-22-setembro-2026-800012-publicacaooriginal-181458-pl.html'
  AND amendment_raw_sha256='44775d6c3fc157dfd63467295a6aa025285b304f762995577c8773eadc6ce596'),
 CONSTRAINT legal_cp_correction_evidence_content CHECK(octet_length(amendment_html) BETWEEN 1000 AND 131072 AND amendment_raw_sha256=encode(sha256(convert_to(amendment_html,'UTF8')),'hex')),
 CONSTRAINT legal_cp_correction_evidence_hash CHECK(fingerprint ~ '^[a-f0-9]{64}$' AND robots_sha256 ~ '^[a-f0-9]{64}$'),
 CONSTRAINT legal_cp_correction_evidence_status CHECK(status IN('pending_review','approved','suspended','rejected','superseded')),
 CONSTRAINT legal_cp_correction_evidence_public_id CHECK(public_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 CONSTRAINT legal_cp_correction_evidence_metadata CHECK(coalesce(jsonb_typeof(metadata)='object' AND metadata->>'policy'='cp63-camara402-enac5-v1' AND metadata->>'fingerprint'=fingerprint AND metadata->>'approvalMode'='owner_standing_authorization' AND metadata->'humanReview'='false'::jsonb AND jsonb_typeof(metadata->'corrections')='array' AND jsonb_array_length(metadata->'corrections')=5 AND jsonb_typeof(metadata->'articleMap')='array' AND jsonb_array_length(metadata->'articleMap')=402,false)),
 CONSTRAINT legal_cp_correction_evidence_approval CHECK(NOT human_review AND (status<>'approved' OR (approval_reference='owner-standing-2026-10-12:official-sources-programs' AND approval_reference IS NOT NULL AND approval_audit_id IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)))
);
--> statement-breakpoint
CREATE INDEX legal_cp_correction_evidence_monitor_idx ON legal_cp_correction_evidence(monitor_snapshot_id);
CREATE INDEX legal_cp_correction_evidence_text_idx ON legal_cp_correction_evidence(text_snapshot_id);
CREATE INDEX legal_cp_correction_evidence_version_idx ON legal_cp_correction_evidence(legal_version_id);
CREATE INDEX legal_cp_correction_evidence_reviewer_idx ON legal_cp_correction_evidence(reviewed_by_user_id);
CREATE INDEX legal_cp_correction_evidence_audit_idx ON legal_cp_correction_evidence(approval_audit_id);
ALTER TABLE legal_cp_correction_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legal_cp_correction_evidence FROM PUBLIC;
REVOKE ALL ON SEQUENCE legal_cp_correction_evidence_id_seq FROM PUBLIC;
CREATE POLICY legal_cp_correction_evidence_read_approved ON legal_cp_correction_evidence FOR SELECT TO PUBLIC USING(status='approved' AND EXISTS(SELECT 1 FROM legal_versions v JOIN legal_source_snapshots m ON m.id=monitor_snapshot_id JOIN legal_text_snapshots t ON t.id=text_snapshot_id WHERE v.id=legal_version_id AND v.legal_act_id=legal_cp_correction_evidence.legal_act_id AND m.legal_act_id=v.legal_act_id AND t.legal_act_id=v.legal_act_id AND t.monitor_snapshot_id=m.id AND v.status='current' AND m.status='approved' AND t.status='approved' AND v.checksum_sha256=canonical_sha256 AND t.checksum_sha256=canonical_sha256 AND m.checksum_sha256=canonical_sha256));
--> statement-breakpoint
CREATE FUNCTION preserve_cp_correction_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN RAISE EXCEPTION 'Recibo CP imutavel; nova reconciliacao exige outro perfil'; END IF;
 IF OLD.status<>'pending_review' AND NEW.status='approved' THEN RAISE EXCEPTION 'Nao restaurar recibo CP encerrado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_cp_correction_evidence BEFORE UPDATE ON legal_cp_correction_evidence FOR EACH ROW EXECUTE FUNCTION preserve_cp_correction_evidence();
--> statement-breakpoint
-- Existing APP grants for other acts remain intact. CP owner maintenance is explicit.
CREATE FUNCTION guard_cp_owner_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected boolean;
BEGIN
 IF TG_TABLE_NAME='legal_articles' THEN
  IF TG_OP='INSERT' THEN SELECT EXISTS(SELECT 1 FROM public.legal_versions WHERE id=NEW.legal_version_id AND legal_act_id=17) INTO affected;
  ELSIF TG_OP='DELETE' THEN SELECT EXISTS(SELECT 1 FROM public.legal_versions WHERE id=OLD.legal_version_id AND legal_act_id=17) INTO affected;
  ELSE SELECT EXISTS(SELECT 1 FROM public.legal_versions WHERE id IN(OLD.legal_version_id,NEW.legal_version_id) AND legal_act_id=17) INTO affected; END IF;
 ELSE
  IF TG_OP='INSERT' THEN affected:=NEW.legal_act_id=17;
  ELSIF TG_OP='DELETE' THEN affected:=OLD.legal_act_id=17;
  ELSE affected:=OLD.legal_act_id=17 OR NEW.legal_act_id=17; END IF;
 END IF;
 IF affected AND current_user<>'leiprova_owner' THEN RAISE EXCEPTION 'CP: manutencao exige owner e operador coordenado auditado'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER cp_source_owner_only BEFORE INSERT OR UPDATE OR DELETE ON legal_source_snapshots FOR EACH ROW EXECUTE FUNCTION guard_cp_owner_mutation();
CREATE TRIGGER cp_text_owner_only BEFORE INSERT OR UPDATE OR DELETE ON legal_text_snapshots FOR EACH ROW EXECUTE FUNCTION guard_cp_owner_mutation();
CREATE TRIGGER cp_version_owner_only BEFORE INSERT OR UPDATE OR DELETE ON legal_versions FOR EACH ROW EXECUTE FUNCTION guard_cp_owner_mutation();
CREATE TRIGGER cp_article_owner_only BEFORE INSERT OR UPDATE OR DELETE ON legal_articles FOR EACH ROW EXECUTE FUNCTION guard_cp_owner_mutation();
--> statement-breakpoint
CREATE FUNCTION guard_cp_correction_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user<>'leiprova_owner' THEN RAISE EXCEPTION 'Recibo CP exige manutencao owner'; END IF;
 IF NEW.status='approved' AND NOT EXISTS (
  SELECT 1 FROM public.legal_versions v JOIN public.legal_source_snapshots m ON m.id=NEW.monitor_snapshot_id JOIN public.legal_text_snapshots t ON t.id=NEW.text_snapshot_id JOIN public.audit_logs a ON a.id=NEW.approval_audit_id
  WHERE v.id=NEW.legal_version_id AND v.legal_act_id=17 AND m.legal_act_id=17 AND t.legal_act_id=17 AND t.monitor_snapshot_id=m.id
   AND v.status='current' AND m.status='approved' AND t.status='approved'
   AND v.source_url=NEW.cp_url AND m.source_url=NEW.cp_url AND t.source_url=NEW.cp_url
   AND v.checksum_sha256=NEW.canonical_sha256 AND m.checksum_sha256=NEW.canonical_sha256 AND t.checksum_sha256=NEW.canonical_sha256
   AND t.article_count=402 AND m.article_marker_count=402 AND t.parser_version=NEW.parser_version
   AND a.action='editorial.legal_cp.coordinated_cut' AND a.actor_user_id=NEW.reviewed_by_user_id
   AND jsonb_typeof(a.metadata)='object' AND a.metadata->>'fingerprint'=NEW.fingerprint
   AND a.metadata->>'approvalReference'=NEW.approval_reference AND a.metadata->'humanReview'='false'::jsonb
   AND (a.metadata->>'newVersionId')::bigint=v.id
 ) THEN RAISE EXCEPTION 'Recibo CP sem fonte/ato/versao/auditoria correspondentes'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_cp_correction_receipt BEFORE INSERT OR UPDATE ON legal_cp_correction_evidence FOR EACH ROW EXECUTE FUNCTION guard_cp_correction_receipt();
