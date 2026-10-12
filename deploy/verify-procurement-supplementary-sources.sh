#!/usr/bin/env bash
# Uma execução auditada na VPS, sem build/pull, daemon ou aprovação de questões.
set -euo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/procurement-monitor-common.sh"

procurement_monitor_validate_receipt() {
  python3 - "$1" <<'PY'
import json, sys
try:
    result = json.load(open(sys.argv[1], encoding='utf-8'))
    if not isinstance(result, dict):
        raise ValueError('Recibo precisa ser objeto')
    ids = result.get('sourceIds')
    audited = isinstance(result.get('auditId'), int) and not isinstance(result['auditId'], bool) and result['auditId'] > 0
    pair = isinstance(ids, list) and len(ids) == 2 and len(set(ids)) == 2 and all(isinstance(i, int) and not isinstance(i, bool) and i > 0 for i in ids)
    if not audited or not pair or result.get('humanReview') is not False:
        raise ValueError('Sem recibo completo de verificação do par')
    if result.get('mode') == 'suspended':
        print('Par suspenso com auditoria; requer reconciliação explícita.', file=sys.stderr)
        sys.exit(10)
    if result.get('mode') != 'verified':
        raise ValueError('Resultado não é verificação aprovada')
except (ValueError, TypeError, KeyError, OSError):
    print('Monitor sem recibo válido; não alegar verificação ou renovação.', file=sys.stderr)
    sys.exit(11)
PY
}

procurement_monitor_main() (
  set -euo pipefail
  [[ $# == 0 ]] || { echo 'Este wrapper não aceita argumentos.' >&2; exit 1; }
  cd /opt/leiprova
  procurement_monitor_guard
  umask 077
  exec 9>/run/lock/leiprova-supplementary-monitor.lock
  flock -n 9 || { echo "$(date -u +%FT%TZ) monitor já em execução; nenhum segundo contêiner iniciado."; exit 0; }
  local container=leiprova-supplementary-source-verifier
  local marker=decree-12807-hourly-v1
  local receipt=''
  local attempted=false
  cleanup() {
    local code=$?
    trap - EXIT TERM INT
    # Só remove o contêiner marcado por este wrapper, nunca outro projeto.
    if [[ "$attempted" == true && "$(timeout --kill-after=5s 15s docker inspect --format '{{index .Config.Labels "io.leiprova.supplementary-monitor"}}' "$container" 2>/dev/null || true)" == "$marker" ]]; then
      timeout --kill-after=5s 20s docker stop --time 10 "$container" >/dev/null 2>&1 || true
      timeout --kill-after=5s 10s docker rm "$container" >/dev/null 2>&1 || true
    fi
    [[ -z "$receipt" ]] || rm -f -- "$receipt"
    exit "$code"
  }
  trap cleanup EXIT
  trap 'exit 143' TERM
  trap 'exit 130' INT
  # Não assumir que timeout anterior matou o processo Docker no servidor.
  local existing
  existing=$(timeout --kill-after=5s 15s docker container ls -a --filter "name=^/${container}$" --format '{{.ID}}')
  if [[ -n "$existing" ]]; then
    echo "$(date -u +%FT%TZ) contêiner já existe; operação bloqueada, sem sobreposição." >&2
    # Não tocar nele nesta execução; pode pertencer a execução ainda ativa.
    trap - EXIT
    exit 1
  fi
  local image_id
  image_id=$(timeout --kill-after=5s 15s docker image inspect --format '{{.Id}}' leiprova-opportunity-approver)
  echo "$(date -u +%FT%TZ) início monitor complementar; imagem=$image_id"
  receipt=$(mktemp /run/leiprova-supplementary-receipt.XXXXXX)
  local code=0
  attempted=true
  # timeout precisa de executável, portanto não recebe a função compose.
  timeout --foreground --signal=TERM --kill-after=15s 240s \
    docker compose --project-directory /opt/leiprova --env-file /opt/leiprova/.env \
      -f /opt/leiprova/docker-compose.yml -f /opt/leiprova/deploy/docker-compose.supplementary-monitor.yml \
      --profile tools run --rm --no-deps -T --name "$container" \
      -e LEGAL_STANDING_REVIEW_REFERENCE=owner-standing-2026-10-12:official-sources-programs \
      opportunity-approver pnpm exec tsx --env-file-if-exists=.env \
      scripts/verify-procurement-supplementary-sources.ts --apply >"$receipt" || code=$?
  if [[ $code != 0 ]]; then
    echo "$(date -u +%FT%TZ) falha operacional código=$code; sem renovação presumida nem recibo inventado." >&2
    exit "$code"
  fi
  cat "$receipt"
  # Suspensão auditada é um resultado que exige atenção; não anunciar sucesso.
  procurement_monitor_validate_receipt "$receipt"
  echo "$(date -u +%FT%TZ) verificação concluída com IDs e auditoria reais."
)

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then procurement_monitor_main "$@"; fi
