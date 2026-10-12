#!/usr/bin/env bash
# One bounded owner verification on the authorized VPS. No cron installation.
set -euo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/procurement-monitor-common.sh"

cp_verification_receipt() {
  python3 - "$1" <<'PY'
import json, sys
try:
    r=json.load(open(sys.argv[1],encoding='utf-8'))
    if not isinstance(r,dict) or r.get('humanReview') is not False:
        raise ValueError()
    if not isinstance(r.get('auditId'),int) or isinstance(r['auditId'],bool) or r['auditId']<=0:
        raise ValueError()
    if not isinstance(r.get('versionId'),int) or isinstance(r['versionId'],bool) or r['versionId']<=63:
        raise ValueError()
    if r.get('mode')=='suspended' and r.get('sourceVerificationSucceeded') is False:
        print('CP suspenso com auditoria; exige reconciliacao, sem restauracao.',file=sys.stderr)
        sys.exit(10)
    if r.get('mode')!='verified' or r.get('sourceVerificationSucceeded') is not True:
        raise ValueError()
except (ValueError,TypeError,KeyError,OSError):
    print('CP sem recibo real de verificacao.',file=sys.stderr)
    sys.exit(11)
PY
}

cp_verification_main() (
  set -euo pipefail
  [[ $# == 0 ]] || { echo 'Wrapper CP não aceita argumentos.' >&2; exit 1; }
  cd /opt/leiprova
  procurement_monitor_guard
  local pin=/opt/leiprova/.local/editorial/cp-current-receipt.json
  [[ -f "$pin" && ! -L "$pin" && "$(stat -c '%a:%u' "$pin")" == 600:0 ]] || { echo 'Recibo real do corte CP ausente/root:600.' >&2; exit 1; }
  local fingerprint
  fingerprint=$(python3 - "$pin" <<'PY'
import json,re,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
if isinstance(r,dict) and isinstance(r.get('receipt'),dict):r=r['receipt']
if not isinstance(r,dict) or r.get('mode')!='applied' or r.get('humanReview') is not False or r.get('approvalReference')!='owner-standing-2026-10-12:official-sources-programs' or not re.fullmatch('[a-f0-9]{64}',r.get('fingerprint','')):sys.exit(1)
if not isinstance(r.get('versionId'),int) or isinstance(r['versionId'],bool) or r['versionId']<=63 or not isinstance(r.get('auditId'),int) or isinstance(r['auditId'],bool) or r['auditId']<=0:sys.exit(1)
print(r['fingerprint'])
PY
  ) || { echo 'Recibo CP não comprova corte aprovado; nenhuma fonte ativada.' >&2; exit 1; }
  umask 077
  # Share the existing supplementary lock: never overlap two constrained owner jobs.
  exec 9>/run/lock/leiprova-supplementary-monitor.lock
  flock -n 9 || { echo 'Monitor complementar já em execução; CP não verificado nesta chamada.'; exit 0; }
  local container=leiprova-cp-source-verifier marker=cp-camara402-verifier-v1 receipt='' attempted=false
  cleanup() {
    local status=$?
    trap - EXIT TERM INT
    if [[ "$attempted" == true && "$(timeout --kill-after=5s 15s docker inspect --format '{{index .Config.Labels "io.leiprova.supplementary-monitor"}}' "$container" 2>/dev/null || true)" == "$marker" ]]; then
      timeout --kill-after=5s 20s docker stop --time 10 "$container" >/dev/null 2>&1 || true
      timeout --kill-after=5s 10s docker rm "$container" >/dev/null 2>&1 || true
    fi
    [[ -z "$receipt" ]] || rm -f -- "$receipt"
    exit "$status"
  }
  trap cleanup EXIT
  trap 'exit 143' TERM
  trap 'exit 130' INT
  local existing
  existing=$(timeout --kill-after=5s 15s docker container ls -a --filter "name=^/${container}$" --format '{{.ID}}')
  [[ -z "$existing" ]] || { echo 'Contêiner CP preexistente; nenhuma sobreposição/remoção.' >&2; attempted=false; exit 1; }
  timeout --kill-after=5s 15s docker image inspect leiprova-opportunity-approver >/dev/null
  receipt=$(mktemp /run/leiprova-cp-receipt.XXXXXX)
  local code=0
  attempted=true
  timeout --foreground --signal=TERM --kill-after=15s 240s \
    docker compose --project-directory /opt/leiprova --env-file /opt/leiprova/.env \
      -f /opt/leiprova/docker-compose.yml -f /opt/leiprova/deploy/docker-compose.supplementary-monitor.yml \
      --profile tools run --rm --no-deps -T --name "$container" \
      --label "io.leiprova.supplementary-monitor=$marker" \
      -e LEGAL_STANDING_REVIEW_REFERENCE=owner-standing-2026-10-12:official-sources-programs \
      opportunity-approver pnpm exec tsx --env-file-if-exists=.env \
      scripts/verify-cp-correction-source.ts "fingerprint=$fingerprint" --apply >"$receipt" || code=$?
  [[ $code == 0 ]] || { echo "$(date -u +%FT%TZ) verificação CP falhou código=$code; não presumir renovação." >&2; exit "$code"; }
  cat "$receipt"
  cp_verification_receipt "$receipt"
)
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then cp_verification_main "$@"; fi
