#!/usr/bin/env bash
# Instala a instância Codex do motor editorial na VPS (root, em /opt/leiprova).
# A unidade Codex NÃO é habilitada nem iniciada aqui: quem liga e desliga é o leiprova-codex-switch
# (.path + .timer, decisão do proprietário em 21/11/2026), que a inicia só enquanto a API do mês estiver
# esgotada E houver login (auth.json no CODEX_HOME). Não faz login, não toca a instância principal,
# a chave da API, o api-budget.json, o banco ou os crons. Ver docs/MOTOR-CODEX-PARALELO.md.
# Retorno: --uninstall (para e remove a unidade Codex e o liga/desliga; recibos ficam em /var/lib/leiprova-codex).
set -euo pipefail
cd /opt/leiprova
UNIT=leiprova-editorial-codex.service
SWITCH_UNITS=(leiprova-codex-switch.service leiprova-codex-switch.path leiprova-codex-switch.timer)

if [[ "${1:-}" == "--uninstall" ]]; then
  systemctl disable --now leiprova-codex-switch.path leiprova-codex-switch.timer || true
  systemctl stop "$UNIT" || true
  rm -f "/etc/systemd/system/$UNIT"
  for unit in "${SWITCH_UNITS[@]}"; do rm -f "/etc/systemd/system/$unit"; done
  systemctl daemon-reload
  echo "Instância Codex e liga/desliga removidos. Recibos preservados em /var/lib/leiprova-codex."
  exit 0
fi

id leiprova-editor >/dev/null 2>&1 || { echo "Usuário leiprova-editor ausente: instale antes o motor principal."; exit 1; }
command -v codex >/dev/null || { echo "Codex CLI não encontrado em PATH."; exit 1; }
command -v flock >/dev/null || { echo "flock (util-linux) não encontrado."; exit 1; }
install -d -m 755 /etc/leiprova
[[ -f /etc/leiprova/editorial-codex.env ]] || install -m 644 deploy/systemd/editorial-codex.env.example /etc/leiprova/editorial-codex.env
install -d -m 750 -o leiprova-editor -g leiprova-editor /var/lib/leiprova-codex
install -d -m 700 -o leiprova-editor -g leiprova-editor /var/lib/leiprova-codex/codex-home
# Login em arquivo (auth.json): é o que a condição da unidade e o liga/desliga conferem.
CODEX_CONFIG=/var/lib/leiprova-codex/codex-home/config.toml
[[ -f "$CODEX_CONFIG" ]] || { printf 'cli_auth_credentials_store = "file"\n' > "$CODEX_CONFIG"; chown leiprova-editor:leiprova-editor "$CODEX_CONFIG"; chmod 600 "$CODEX_CONFIG"; }
install -m 644 -o root -g root "deploy/systemd/$UNIT" "/etc/systemd/system/$UNIT"
for unit in "${SWITCH_UNITS[@]}"; do install -m 644 -o root -g root "deploy/systemd/$unit" "/etc/systemd/system/$unit"; done
systemctl daemon-reload
systemctl enable --now leiprova-codex-switch.path leiprova-codex-switch.timer

cat <<'MSG'
Instância Codex instalada; liga/desliga automático ativo (leiprova-codex-switch.path/.timer).
Sem login, o Codex não inicia. Login (proprietário) e conferência: docs/MOTOR-CODEX-PARALELO.md.
MSG
