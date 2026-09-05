#!/bin/sh
set -eu

case "${LEIPROVA_SKIP_SEED:-0}" in
  0|1) ;;
  *) echo "LEIPROVA_SKIP_SEED deve ser 0 ou 1." >&2; exit 1 ;;
esac

docker compose build app migrate seed opportunity-approver legal-monitor editorial-automation editorial-operator
docker compose up -d db pooler
docker compose --profile tools run --rm migrate
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -v app_user="$APP_DB_USER" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < deploy/grant-app-role.sql
if [ "${LEIPROVA_SKIP_SEED:-0}" = "1" ]; then
  echo "Catálogo e conteúdo existentes preservados: carga seed não executada."
else
  docker compose --profile tools run --rm seed
fi
docker compose up -d --wait --wait-timeout 180 app legal-monitor editorial-automation
docker compose ps
