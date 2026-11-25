#!/bin/sh
# Reavalia as páginas públicas de SEO (lei/artigo) e grava seo_page_state.
#   sh deploy/seo-page-state.sh            # prévia: só mostra quantas páginas mudariam
#   sh deploy/seo-page-state.sh --apply    # grava (usado pelo leiprova-seo-page-state.timer)
# Usa os MESMOS valores do app: SEO_WAVE (+ SEO_WAVE_START/_DAILY/_GSC_*), SEO_DIRECT_ANSWER_REQUIRED e INDEXNOW_KEY do
# /opt/leiprova/.env, com os padrões do docker-compose.yml (off, 1, vazio). Sem INDEXNOW_KEY
# nada é enviado ao IndexNow.
set -eu
cd "${LEIPROVA_DIR:-/opt/leiprova}"
MODE="${1:-}"
case "$MODE" in ""|--apply) ;; *) echo "uso: seo-page-state.sh [--apply]" >&2; exit 2 ;; esac

env_value() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -n 1 | tr -d '\r' | sed 's/^"\(.*\)"$/\1/'; }
WAVE="$(env_value SEO_WAVE)"; WAVE="${WAVE:-off}"
DIRECT="$(env_value SEO_DIRECT_ANSWER_REQUIRED)"; DIRECT="${DIRECT:-1}"
KEY="$(env_value INDEXNOW_KEY)"
START="$(env_value SEO_WAVE_START)"; DAILY="$(env_value SEO_WAVE_DAILY)"; DAILY="${DAILY:-50}"
GSC_DATE="$(env_value SEO_WAVE_GSC_DATE)"; GSC_PCT="$(env_value SEO_WAVE_GSC_INDEXED_PCT)"

echo "$(date -u +%FT%TZ) seo-page-state ${MODE:-preview} SEO_WAVE=$WAVE SEO_WAVE_START=${START:-} SEO_WAVE_DAILY=$DAILY SEO_DIRECT_ANSWER_REQUIRED=$DIRECT indexnow=$([ -n "$KEY" ] && echo ligado || echo desligado)"
exec docker compose exec -T \
  -e NODE_PATH=./node_modules/next/dist/compiled \
  -e SEO_WAVE="$WAVE" -e SEO_WAVE_START="$START" -e SEO_WAVE_DAILY="$DAILY" \
  -e SEO_WAVE_GSC_DATE="$GSC_DATE" -e SEO_WAVE_GSC_INDEXED_PCT="$GSC_PCT" -e SEO_DIRECT_ANSWER_REQUIRED="$DIRECT" -e INDEXNOW_KEY="$KEY" \
  editorial-automation node --conditions=react-server --import tsx scripts/seo/refresh-page-state.ts $MODE
