#!/usr/bin/env bash
# Vigia semanal leve do texto consolidado oficial (decisão do proprietário, 23/11/2026).
# Para cada lei: recaptura a compilação do Senado só como pendente. Se o texto mudou em relação à
# versão vigente, roda o operador de transição (prévia e aplicação com o mesmo fingerprint), que
# religa os artigos sem mudança e devolve à fila normal só as questões dos artigos alterados.
# Não aprova a página de declarações sozinha; não retira questões (isso exige decisão editorial).
# Saída: uma linha por lei, "STATUS=<unchanged|applied|failed> lei=<slug> ...".
set -uo pipefail
cd /opt/leiprova
LAWS=(codigo-defesa-consumidor-1990 codigo-processo-penal consolidacao-leis-trabalho lei-falencias-recuperacao-2005
  lei-improbidade-administrativa-1992 lei-inelegibilidades-1990 lei-lavagem-dinheiro-1998 lei-registros-publicos-1973
  lei-responsabilidade-fiscal-2000 regime-juridico-servidores-federais)
REF=owner-decision-2026-11-23:vigia-semanal-texto-legal
LOG=.local/editorial/legal-text-watch; install -d -m700 "$LOG"; STAMP=$(date -u +%Y%m%dT%H%M%SZ)
tools() { timeout 1800 docker compose --profile tools run --rm --no-deps -T -e LEGAL_LOAD_REFERENCE=$REF -e LEGAL_TRANSITION_REFERENCE=$REF opportunity-approver pnpm exec tsx "$@"; }
for law in "${LAWS[@]}"; do
  out="$LOG/$STAMP-$law"
  tools scripts/load-official-laws.ts --apply --capture-only "lei=$law" > "$out.capture.json" 2>&1
  text=$(tr -d '\n ' < "$out.capture.json" | grep -o '"text":"[a-z_]*"' | head -1 | cut -d'"' -f4)
  if [[ "$text" == "unchanged" ]]; then echo "STATUS=unchanged lei=$law"; continue; fi
  if [[ "$text" != "pending_review" ]]; then echo "STATUS=failed lei=$law etapa=captura"; continue; fi
  checksum=$(docker compose exec -T db sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -At -c \"select s.checksum_sha256 from legal_text_snapshots s join legal_acts l on l.id=s.legal_act_id where l.slug='$law' and s.status='pending_review' order by s.id desc limit 1\"")
  tools scripts/transition-legal-version.ts "lei=$law" "text=$checksum" > "$out.preview.json" 2>&1
  fp=$(python3 -c "import json,sys;t=open(sys.argv[1]).read();print(json.loads(t[t.index('{'):t.rindex('}')+1])['fingerprint'])" "$out.preview.json" 2>/dev/null)
  if [[ -z "$fp" ]]; then echo "STATUS=failed lei=$law etapa=previa"; continue; fi
  sh deploy/backup.sh > "$out.backup.log" 2>&1
  tools scripts/transition-legal-version.ts "lei=$law" "text=$checksum" --apply "fingerprint=$fp" > "$out.apply.json" 2>&1
  python3 - "$law" "$out.apply.json" <<'PY' || echo "STATUS=failed lei=$law etapa=aplicacao"
import json, sys
t = open(sys.argv[2]).read(); d = json.loads(t[t.index("{"):t.rindex("}") + 1])
print(f"STATUS=applied lei={sys.argv[1]} versao={d['newVersionId']} hash={d['textSnapshot']['checksum'][:12]} alterados={len(d['changed'])} religados={d['reboundBindings']} reabertas={d['reopenedQuestions']}")
PY
done
chmod 600 "$LOG"/"$STAMP"-* 2>/dev/null || true
