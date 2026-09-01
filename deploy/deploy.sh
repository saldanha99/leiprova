#!/bin/sh
set -eu

docker compose build app migrate seed opportunity-approver legal-monitor
docker compose up -d db pooler
docker compose --profile tools run --rm migrate
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -v app_user="$APP_DB_USER" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < deploy/grant-app-role.sql
docker compose --profile tools run --rm seed
docker compose up -d --wait --wait-timeout 180 app legal-monitor
docker compose ps
