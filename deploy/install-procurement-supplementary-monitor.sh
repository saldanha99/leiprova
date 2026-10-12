#!/usr/bin/env bash
# Prévia por padrão; --install altera somente os arquivos nomeados abaixo.
set -euo pipefail
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/procurement-monitor-common.sh"

procurement_monitor_cron() {
  cat <<'CRON'
# managed-by: leiprova-procurement-monitor-v1
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Uma vez por hora. Logs datados em UTC, independentemente do fuso do cron.
17 * * * * root /opt/leiprova/deploy/verify-procurement-supplementary-sources.sh >> /var/log/leiprova-supplementary-monitor.log 2>&1
CRON
}

procurement_monitor_has_duplicate() {
  # Recebe caminhos apenas para permitir testes em fixtures privados.
  # Chamador de produção fornece somente cron.d/crontab/spool do sistema.
  local path
  for path in "$@"; do
    [[ -f "$path" ]] || continue
    [[ "$path" == /etc/cron.d/leiprova-supplementary-monitor ]] && continue
    if awk '!/^[[:space:]]*#/ && /verify-procurement-supplementary-sources[.](sh|ts)/ {found=1} END {exit !found}' "$path"; then
      echo "Agendamento duplicado encontrado em $path; nenhuma instalação feita." >&2
      return 0
    fi
  done
  return 1
}

procurement_monitor_install_main() (
  set -euo pipefail
  local mode=${1:---preview}
  [[ $# -le 1 && ( "$mode" == --preview || "$mode" == --install || "$mode" == --remove ) ]] \
    || { echo 'Use --preview (padrão), --install ou --remove.' >&2; exit 1; }
  cd /opt/leiprova
  procurement_monitor_guard
  local cron=/etc/cron.d/leiprova-supplementary-monitor
  local rotation=/etc/logrotate.d/leiprova-supplementary-monitor
  local log=/var/log/leiprova-supplementary-monitor.log
  local marker='# managed-by: leiprova-procurement-monitor-v1'
  for path in "$cron" "$rotation"; do
    if [[ -e "$path" || -L "$path" ]]; then
      [[ -f "$path" && ! -L "$path" ]] && [[ "$(head -n 1 "$path")" == "$marker" ]] \
        || { echo "Arquivo $path não pertence a este instalador; bloqueado." >&2; exit 1; }
    fi
  done
  if [[ "$mode" == --remove ]]; then
    rm -f -- "$cron" "$rotation"
    echo 'Agendamento removido somente no destino; fontes, auditorias e log preservados.'
    exit 0
  fi
  command -v flock >/dev/null
  command -v timeout >/dev/null
  command -v python3 >/dev/null
  command -v docker >/dev/null
  command -v crontab >/dev/null
  command -v systemctl >/dev/null
  command -v logrotate >/dev/null
  [[ -x deploy/verify-procurement-supplementary-sources.sh ]] || { echo 'Wrapper ausente ou sem execução.' >&2; exit 1; }
  [[ -f deploy/docker-compose.supplementary-monitor.yml && -f scripts/verify-procurement-supplementary-sources.ts ]] || exit 1
  # Imagem existente obrigatória. Não construir nem baixar durante instalação/cron.
  timeout --kill-after=5s 15s docker image inspect leiprova-opportunity-approver >/dev/null
  timeout --kill-after=5s 30s docker compose --project-directory /opt/leiprova --env-file /opt/leiprova/.env \
    -f /opt/leiprova/docker-compose.yml -f /opt/leiprova/deploy/docker-compose.supplementary-monitor.yml \
    --profile tools config --quiet
  if ! systemctl is-active --quiet cron && ! systemctl is-active --quiet crond; then
    echo 'Serviço cron não está ativo; nenhuma instalação feita.' >&2; exit 1
  fi
  shopt -s nullglob
  local cron_paths=(/etc/crontab /etc/cron.d/* /var/spool/cron/crontabs/* /var/spool/cron/*)
  procurement_monitor_has_duplicate "${cron_paths[@]}" && exit 1
  if [[ "$mode" == --preview ]]; then
    procurement_monitor_cron
    echo 'Prévia: nenhuma rotina instalada e nenhuma fonte verificada.'
    exit 0
  fi
  umask 077
  exec 8>/run/lock/leiprova-supplementary-monitor-install.lock
  flock -n 8 || { echo 'Outro instalador está ativo.' >&2; exit 1; }
  # Rechecar depois da trava. Não sobrescrever arquivo externo concorrente.
  cron_paths=(/etc/crontab /etc/cron.d/* /var/spool/cron/crontabs/* /var/spool/cron/*)
  procurement_monitor_has_duplicate "${cron_paths[@]}" && exit 1
  for path in "$cron" "$rotation"; do
    if [[ -e "$path" || -L "$path" ]] && [[ ! -f "$path" || -L "$path" || "$(head -n 1 "$path")" != "$marker" ]]; then exit 1; fi
  done
  [[ ! -L "$log" && ( ! -e "$log" || -f "$log" ) ]] || { echo 'Log inválido; instalação bloqueada.' >&2; exit 1; }
  touch "$log"
  chown root:root "$log"
  chmod 600 "$log"
  local staged_cron staged_rotation
  staged_cron=$(mktemp /etc/cron.d/.leiprova-supplementary.XXXXXX)
  staged_rotation=$(mktemp /etc/logrotate.d/.leiprova-supplementary.XXXXXX)
  trap 'rm -f -- "$staged_cron" "$staged_rotation"' EXIT
  procurement_monitor_cron >"$staged_cron"
  cat >"$staged_rotation" <<'ROTATION'
# managed-by: leiprova-procurement-monitor-v1
/var/log/leiprova-supplementary-monitor.log {
    size 1M
    rotate 4
    missingok
    notifempty
    compress
    copytruncate
    su root root
}
ROTATION
  chown root:root "$staged_cron" "$staged_rotation"
  chmod 644 "$staged_cron" "$staged_rotation"
  logrotate --debug "$staged_rotation" >/dev/null 2>&1
  # Cada destino é estável e a substituição é atômica; repetir não cria novas linhas.
  mv -f -- "$staged_rotation" "$rotation"
  mv -f -- "$staged_cron" "$cron"
  echo 'Cron horário instalado no destino. Isso não comprova execução ou revisão de fonte.'
)

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then procurement_monitor_install_main "$@"; fi
