#!/bin/sh
# Renova a evidência de formato do MPRJ (vale 2 dias; vencida, o produto cai para 0 questões válidas).
# Rodado pelo leiprova-mprj-format-refresh.timer, 1x por dia às 02h40 de Brasília. Manual: sh deploy/mprj-format-refresh.sh
# Usa o serviço opportunity-approver (conexão de dono do banco). O script vem montado do repositório,
# então não depende de rebuild da imagem. Falha = código 1 e nada aplicado (ver scripts/refresh-mprj-format-evidence.ts).
set -eu
cd "${LEIPROVA_DIR:-/opt/leiprova}"
echo "$(date -u +%FT%TZ) mprj-format-refresh início"
set +e
timeout 300 docker compose --profile tools run --rm -T --pull never \
  -v "$PWD/scripts/refresh-mprj-format-evidence.ts:/app/scripts/refresh-mprj-format-evidence.ts:ro" \
  opportunity-approver timeout 240 pnpm -s exec tsx scripts/refresh-mprj-format-evidence.ts
status=$?
set -e
echo "$(date -u +%FT%TZ) mprj-format-refresh fim status=$status"
exit "$status"
