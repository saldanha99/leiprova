#!/usr/bin/env bash
# Instala (ou remove com --uninstall) a reavaliação diária das páginas de SEO.
set -euo pipefail
cd /opt/leiprova
if [[ "${1:-}" == "--uninstall" ]]; then
  systemctl disable --now leiprova-seo-page-state.timer || true
  rm -f /etc/systemd/system/leiprova-seo-page-state.service /etc/systemd/system/leiprova-seo-page-state.timer
  systemctl daemon-reload
  echo "Reavaliação diária de SEO removida (seo_page_state preservada)."
  exit 0
fi
command -v flock >/dev/null || { echo "flock (util-linux) não encontrado."; exit 1; }
install -d -m 755 /var/log/leiprova
install -m 644 -o root -g root deploy/systemd/leiprova-seo-page-state.service /etc/systemd/system/
install -m 644 -o root -g root deploy/systemd/leiprova-seo-page-state.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now leiprova-seo-page-state.timer
systemctl list-timers leiprova-seo-page-state.timer --no-pager
