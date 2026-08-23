#!/bin/sh
set -eu

if [ -z "${APP_DB_USER:-}" ] || [ -z "${APP_DB_PASSWORD:-}" ]; then
  echo "APP_DB_USER e APP_DB_PASSWORD são obrigatórios."
  exit 1
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_user="$APP_DB_USER" \
  --set=app_password="$APP_DB_PASSWORD" <<'EOSQL'
select format('create role %I login password %L', :'app_user', :'app_password')
where not exists (select 1 from pg_roles where rolname = :'app_user')
\gexec

revoke create on schema public from public;
select format('revoke all on database %I from public', current_database())
\gexec
select format('grant connect on database %I to %I', current_database(), :'app_user')
\gexec
select format('grant usage on schema public to %I', :'app_user')
\gexec
EOSQL
