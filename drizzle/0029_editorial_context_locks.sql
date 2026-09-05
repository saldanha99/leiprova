-- Somente travamento: não concede escrita ampla em fontes ou bancas à aplicação.
CREATE FUNCTION public.lock_editorial_approval_context(question_ids bigint[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF cardinality(question_ids) IS NULL OR cardinality(question_ids) NOT BETWEEN 1 AND 250
    OR EXISTS (SELECT 1 FROM unnest(question_ids) id WHERE id IS NULL OR id < 1) THEN
    RAISE EXCEPTION 'Escopo editorial inválido';
  END IF;
  PERFORM q.id FROM public.questions q WHERE q.id = ANY(question_ids) ORDER BY q.id FOR UPDATE;
  -- O lock da questão também impede novas alternativas via FK durante a revisão.
  PERFORM o.id FROM public.question_options o WHERE o.question_id = ANY(question_ids) ORDER BY o.id FOR SHARE;
  PERFORM a.id FROM public.legal_articles a WHERE a.id IN
    (SELECT q.legal_article_id FROM public.questions q WHERE q.id = ANY(question_ids)) ORDER BY a.id FOR SHARE;
  PERFORM v.id FROM public.legal_versions v WHERE v.id IN
    (SELECT a.legal_version_id FROM public.legal_articles a JOIN public.questions q ON q.legal_article_id = a.id
      WHERE q.id = ANY(question_ids)) ORDER BY v.id FOR SHARE;
  PERFORM l.id FROM public.legal_acts l WHERE l.id IN
    (SELECT v.legal_act_id FROM public.legal_versions v JOIN public.legal_articles a ON a.legal_version_id = v.id
      JOIN public.questions q ON q.legal_article_id = a.id WHERE q.id = ANY(question_ids)) ORDER BY l.id FOR SHARE;
  PERFORM b.id FROM public.quiz_banks b WHERE b.id IN
    (SELECT q.style_bank_id FROM public.questions q WHERE q.id = ANY(question_ids)) ORDER BY b.id FOR SHARE;
  PERFORM p.id FROM public.question_style_profiles p WHERE p.quiz_bank_id IN
    (SELECT q.style_bank_id FROM public.questions q WHERE q.id = ANY(question_ids)) ORDER BY p.id FOR SHARE;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lock_editorial_approval_context(bigint[]) FROM PUBLIC;
