CREATE TABLE editorial_agent_work (
  job_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('discovery','legal_mapping','authoring','legal_change')),
  input_hash text NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 524288),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','prepared','blocked','failed','superseded')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  lease_token uuid,
  lease_expires_at timestamptz,
  result jsonb CHECK (result IS NULL OR (octet_length(result::text) <= 262144 AND coalesce(result->>'publicationAllowed' = 'false', false))),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'running' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'running' AND lease_token IS NULL AND lease_expires_at IS NULL))
);
--> statement-breakpoint
CREATE INDEX editorial_agent_work_due_idx ON editorial_agent_work(status, created_at);
--> statement-breakpoint
CREATE TABLE editorial_agent_runs (
  lease_token uuid PRIMARY KEY,
  job_key text NOT NULL CONSTRAINT editorial_agent_runs_job_key_editorial_agent_work_job_key_fk REFERENCES editorial_agent_work(job_key),
  started_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX editorial_agent_runs_started_idx ON editorial_agent_runs(started_at);
--> statement-breakpoint
-- Bloqueios delimitados: não conceder UPDATE de leis ao papel da aplicação.
CREATE FUNCTION public.lock_editorial_agent_context(requirement_id bigint, article_ids bigint[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET lock_timeout = '5s'
AS $$
DECLARE opportunity_key bigint;
BEGIN
  IF (requirement_id IS NOT NULL AND requirement_id <= 0) OR article_ids IS NULL
    OR cardinality(article_ids) > 20 OR EXISTS (SELECT 1 FROM unnest(article_ids) x WHERE x IS NULL OR x <= 0) THEN
    RAISE EXCEPTION 'Escopo editorial inválido' USING ERRCODE = '22023';
  END IF;
  IF requirement_id IS NOT NULL THEN
    SELECT r.opportunity_id INTO opportunity_key FROM public.opportunity_requirements r
      WHERE r.id=requirement_id FOR SHARE;
    -- FOR UPDATE também impede inserir outra atribuição de banca durante a confirmação.
    PERFORM o.id FROM public.contest_opportunities o WHERE o.id=opportunity_key FOR UPDATE;
    PERFORM a.id FROM public.opportunity_organizer_assignments a WHERE a.opportunity_id=opportunity_key ORDER BY a.id FOR SHARE;
    PERFORM d.id FROM public.opportunity_source_documents d JOIN public.opportunity_requirements r ON r.source_document_id=d.id
      WHERE r.id=requirement_id FOR SHARE OF d;
    PERFORM s.id FROM public.opportunity_document_snapshots s JOIN public.opportunity_requirements r ON r.source_snapshot_id=s.id
      WHERE r.id=requirement_id FOR SHARE OF s;
  END IF;
  PERFORM l.id FROM public.legal_acts l WHERE l.id IN
    (SELECT v.legal_act_id FROM public.legal_versions v JOIN public.legal_articles a ON a.legal_version_id=v.id WHERE a.id=ANY(article_ids))
    ORDER BY l.id FOR SHARE;
  PERFORM v.id FROM public.legal_versions v WHERE v.id IN
    (SELECT a.legal_version_id FROM public.legal_articles a WHERE a.id=ANY(article_ids)) ORDER BY v.id FOR SHARE;
  PERFORM a.id FROM public.legal_articles a WHERE a.id=ANY(article_ids) ORDER BY a.id FOR SHARE;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lock_editorial_agent_context(bigint,bigint[]) FROM PUBLIC;
