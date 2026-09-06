\set ON_ERROR_STOP on

-- Complemento isolado para publicação controlada após a migration 0034.
-- grant-app-role.sql também inclui estes grants para preservá-los em deploys futuros.
-- Passe app_user como identificador de papel existente; nunca use owner/superuser na aplicação.
begin;

grant select, insert, update on public.purchase_delivery_outbox to :"app_user";
grant select, insert on public.purchase_delivery_events to :"app_user";

-- Sem DELETE, UPDATE de histórico, sequences, criação de objetos ou ampliação em outras tabelas.
commit;
