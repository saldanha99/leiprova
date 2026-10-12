#!/usr/bin/env bash
# Atualiza até seis páginas por rodada; não reserva IA, aprova ou publica conteúdo.
set -euo pipefail
cd /opt/leiprova
exec 9>/tmp/leiprova-prepare-queue.lock
flock -n 9 || exit 0
umask 077
mkdir -p .local/editorial/preparation-runs
run_dir=$(mktemp -d .local/editorial/preparation-runs/"$(date -u +%Y%m%dT%H%M%SZ)".XXXXXX)
echo "$(date -u +%FT%TZ) início; recibos=$run_dir"
for page in 1 2 3 4 5 6; do
  timeout --kill-after=10s 300s docker exec leiprova-editorial-automation \
    ./node_modules/.bin/tsx --env-file-if-exists=.env scripts/editorial-agent-work.ts --mode=prepare \
    >"$run_dir/$page.json" 2>"$run_dir/$page.err" || {
      echo "$(date -u +%FT%TZ) falha na página=$page; recibos=$run_dir"; exit 1;
    }
  cat "$run_dir/$page.json"
  more=$(python3 -c 'import json,sys
data=json.load(sys.stdin)
assert isinstance(data.get("hasMore"),bool), "Recibo inválido"
print("yes" if data["hasMore"] else "no")' <"$run_dir/$page.json")
  if [[ "$more" == no ]]; then
    echo "$(date -u +%FT%TZ) fim; preparação atualizada"
    exit 0
  fi
done
echo "$(date -u +%FT%TZ) fim; há páginas pendentes para a próxima rodada"
