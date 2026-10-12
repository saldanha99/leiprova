#!/usr/bin/env bash
# Biblioteca sem efeitos ao carregar; não lê nem imprime credenciais.
procurement_monitor_guard() {
  [[ "$(uname -s)" == Linux ]] || { echo 'Monitor complementar: exige VPS Linux.' >&2; return 1; }
  [[ "$(id -u)" == 0 ]] || { echo 'Monitor complementar: exige root na VPS.' >&2; return 1; }
  [[ "$(pwd -P)" == /opt/leiprova ]] || { echo 'Monitor complementar: exige /opt/leiprova.' >&2; return 1; }
  ip -o -4 addr show scope global | awk '$4 ~ /^179[.]236[.]255[.]4\// {found=1} END {exit !found}' \
    || { echo 'Monitor complementar: IP local não é a VPS Everglades autorizada.' >&2; return 1; }
  [[ -f .env && ! -L .env && "$(stat -c '%a:%u' .env)" == 600:0 ]] \
    || { echo 'Monitor complementar: .env deve ser arquivo root:600 na VPS.' >&2; return 1; }
}
