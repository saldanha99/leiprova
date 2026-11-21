#!/bin/sh
# Conferência só leitura da renovação MPRJ (para a rotina de vigia). Imprime OK ou FALHA e sai 0/1.
# FALHA quando: a última execução do leiprova-mprj-format-refresh falhou, ele não rodou nas últimas 30 h,
# o timer não está ativo ou a evidência aprovada vence em menos de 24 h.
set -eu
cd "${LEIPROVA_DIR:-/opt/leiprova}"
problemas=""
systemctl is-active -q leiprova-mprj-format-refresh.timer || problemas="$problemas timer_inativo"
resultado="$(systemctl show -p Result --value leiprova-mprj-format-refresh.service)"
[ "$resultado" = "success" ] || problemas="$problemas ultima_execucao=$resultado"
fim="$(systemctl show -p ExecMainExitTimestamp --value leiprova-mprj-format-refresh.service)"
if [ -z "$fim" ] || [ $(( $(date +%s) - $(date -d "$fim" +%s) )) -gt 108000 ]; then problemas="$problemas sem_execucao_30h"; fi
horas="$(echo "select coalesce(floor(extract(epoch from max(expires_at) - now())/3600)::int, -1) from official_question_format_evidence where opportunity_id=20 and status='approved';" | docker compose exec -T db sh -c 'psql -X -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"' 2>/dev/null | tr -d '[:space:]')"
case "$horas" in ''|*[!0-9-]*) problemas="$problemas consulta_falhou" ;; *) [ "$horas" -ge 24 ] || problemas="$problemas evidencia_vence_em_${horas}h" ;; esac
if [ -z "$problemas" ]; then
  echo "OK mprj: ultima_execucao=$fim evidencia_vale_mais_${horas}h"
else
  echo "FALHA mprj:$problemas (ultima_execucao=$fim; log: /var/log/leiprova/mprj-format-refresh.log)"
  exit 1
fi
