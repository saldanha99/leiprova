-- Bloqueio de UMA linha do catálogo, sem conceder UPDATE ao papel da aplicação.
-- A função não altera dados nem aprova questão, vínculo ou produto.
CREATE FUNCTION public.lock_product_binding_review_product(product_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET lock_timeout = '5s'
AS $$
BEGIN
  IF product_slug IS NULL OR length(product_slug) NOT BETWEEN 3 AND 160
    OR product_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Escopo de produto inválido' USING ERRCODE = '22023';
  END IF;
  PERFORM p.slug FROM public.contest_store_products p
    WHERE p.slug = product_slug FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto do escopo não encontrado' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lock_product_binding_review_product(text) FROM PUBLIC;
