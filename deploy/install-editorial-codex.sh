#!/usr/bin/env bash
# Instala a instância Codex do motor editorial na VPS (root, em /opt/leiprova), DESLIGADA:
# não habilita, não inicia, não faz login, não toca a instância principal, a chave da API,
# o api-budget.json, o banco ou os crons. Ativação: docs/MOTOR-CODEX-PARALELO.md.
# Retorno: --uninstall (para e remove só a unidade Codex; recibos ficam em /var/lib/leiprova-codex).
set -euo pipefail
cd /opt/leiprova
UNIT=leiprova-editorial-codex.service

if [[ "${1:-}" == "--uninstall" ]]; then
  systemctl disable --now "$UNIT" || true
  rm -f "/etc/systemd/system/$UNIT"
  systemctl daemon-reload
  echo "Instância Codex removida. Recibos preservados em /var/lib/leiprova-codex."
  exit 0
fi

id leiprova-editor >/dev/null 2>&1 || { echo "Usuário leiprova-editor ausente: instale antes o motor principal."; exit 1; }
command -v codex >/dev/null || { echo "Codex CLI não encontrado em PATH."; exit 1; }
command -v flock >/dev/null || { echo "flock (util-linux) não encontrado."; exit 1; }
install -d -m 755 /etc/leiprova
[[ -f /etc/leiprova/editorial-codex.env ]] || install -m 644 deploy/systemd/editorial-codex.env.example /etc/leiprova/editorial-codex.env
install -d -m 750 -o leiprova-editor -g leiprova-editor /var/lib/leiprova-codex
install -d -m 700 -o leiprova-editor -g leiprova-editor /var/lib/leiprova-codex/codex-home
install -m 644 -o root -g root "deploy/systemd/$UNIT" "/etc/systemd/system/$UNIT"
systemctl daemon-reload

cat <<'MSG'
Instância Codex instalada e DESLIGADA (nem habilitada, nem iniciada).
Ativar só com o OK do proprietário: docs/MOTOR-CODEX-PARALELO.md.
MSG
