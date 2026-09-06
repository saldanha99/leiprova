\set ON_ERROR_STOP on

-- Complemento isolado após 0036; não reatribui os demais privilégios da aplicação.
begin;
grant execute on function public.lock_product_binding_review_product(text) to :"app_user";
grant update (
  status, reviewed_by_user_id, reviewed_at, review_notes, updated_at
) on public.contest_product_question_bindings to :"app_user";
-- Nenhum UPDATE no catálogo, identidade, fontes ou evidências do vínculo.
commit;
