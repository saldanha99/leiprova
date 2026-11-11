#!/usr/bin/env bash
# Instala o motor editorial contínuo na VPS (executar como root em /opt/leiprova,
# depois do deploy da revisão validada). Não faz login na assinatura, não toca
# banco, flags, Stripe ou crons existentes. Retorno: --uninstall.
set -euo pipefail
cd /opt/leiprova
UNITS=(leiprova-editorial-realtime.service leiprova-release-trigger.path leiprova-release-trigger.service)

if [[ "${1:-}" == "--uninstall" ]]; then
  systemctl disable --now leiprova-editorial-realtime.service leiprova-release-trigger.path || true
  for unit in "${UNITS[@]}"; do rm -f "/etc/systemd/system/$unit"; done
  systemctl daemon-reload
  echo "Motor contínuo removido. Recibos preservados em /var/lib/leiprova-realtime; cron e Maestri seguem como antes."
  exit 0
fi

command -v node >/dev/null || { echo "Node não encontrado no host; instale Node 20+ antes."; exit 1; }
id leiprova-editor >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/leiprova-editor --shell /bin/bash leiprova-editor
usermod -aG docker leiprova-editor
install -d -m 755 /etc/leiprova
[[ -f /etc/leiprova/editorial-realtime.env ]] || install -m 644 deploy/systemd/editorial-realtime.env.example /etc/leiprova/editorial-realtime.env
for unit in "${UNITS[@]}"; do install -m 644 -o root -g root "deploy/systemd/$unit" "/etc/systemd/system/$unit"; done
chmod 755 deploy/editorial-realtime-worker.mjs deploy/editorial-release-chain.sh
systemctl daemon-reload
systemctl enable --now leiprova-release-trigger.path
systemctl enable leiprova-editorial-realtime.service

cat <<'MSG'
Instalado e habilitado, ainda NÃO iniciado. Próximos passos do proprietário:
  1. Instalar a CLI escolhida para o usuário leiprova-editor e fazer o login da assinatura:
       sudo -iu leiprova-editor   # depois: claude  (ou: codex login)
  2. Conferir /etc/leiprova/editorial-realtime.env (executor, modelo, vagas).
  3. systemctl start leiprova-editorial-realtime && journalctl -fu leiprova-editorial-realtime
Recibos: /var/lib/leiprova-realtime/{events.jsonl,heartbeat.json,runs/}
MSG
