#!/bin/sh
# Instala (ou atualiza) o timer da renovação da evidência MPRJ. Não mexe nos outros timers.
set -eu
cd "$(dirname "$0")"
install -m 644 leiprova-mprj-format-refresh.service /etc/systemd/system/leiprova-mprj-format-refresh.service
install -m 644 leiprova-mprj-format-refresh.timer /etc/systemd/system/leiprova-mprj-format-refresh.timer
systemctl daemon-reload
systemctl enable --now leiprova-mprj-format-refresh.timer
systemctl list-timers leiprova-mprj-format-refresh.timer --no-pager
