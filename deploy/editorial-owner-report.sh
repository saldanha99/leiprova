#!/usr/bin/env bash
# Relatório somente leitura; a transação do script proíbe escrita no banco.
set -euo pipefail
cd /opt/leiprova
exec 9>/tmp/leiprova-owner-report.lock
flock -w 5 9 || exit 1
exec timeout --kill-after=10s 120s docker compose --profile tools run --rm --no-deps -T \
  opportunity-approver sh -ec \
  'export DATABASE_URL="$MIGRATION_DATABASE_URL"; exec ./node_modules/.bin/tsx --env-file-if-exists=.env scripts/editorial-owner-report.ts --json'
