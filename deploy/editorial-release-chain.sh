#!/usr/bin/env bash
# Linha automática de liberação editorial. Decisão do proprietário (11/10/2026):
# "aprovar sozinho, sem me perguntar". Para cada concurso com inéditas da fábrica:
#   1. aprova os rascunhos que passam nas checagens automáticas do painel
#      (auditoria: autorização permanente, sem conferência humana do item);
#   2. propõe e importa os vínculos das questões aos itens do edital;
#   3. revisa os itens do edital e os vínculos pendentes;
#   4. libera o produto em rascunho que cumprir todas as condições (68 questões,
#      prova anterior ou dispensa, prova futura...).
# O Maestro (Codex) confere depois o que foi aprovado e suspende o que tiver erro
# (docs/MAESTRO-CENTRAL.md). Não mexe em feature flag, Stripe ou checkout.
# Agendada em /etc/cron.d/leiprova-release-chain:
#   10,40 * * * * root /opt/leiprova/deploy/editorial-release-chain.sh >> /var/log/leiprova-release-chain.log 2>&1
set -uo pipefail
cd /opt/leiprova || exit 1

exec 9>/tmp/leiprova-release-chain.lock
if ! flock -n 9; then echo "$(date -u +%FT%TZ) já em execução; saindo."; exit 0; fi

REF="owner-standing-2026-10-11:aprovar-sozinho"
PROGRAM_REF="owner-standing-2026-10-12:official-sources-programs"
RELEASE_REF="owner-standing-2026-10-12:abertura-progressiva-84"
umask 077
mkdir -p .local/editorial/release-runs
RUN_DIR=$(mktemp -d .local/editorial/release-runs/"$(date -u +%Y%m%dT%H%M%SZ)".XXXXXX) || exit 1
log() { echo "$(date -u +%FT%TZ) $*"; }
sql_ro() {
  docker exec -e PGOPTIONS='-c default_transaction_read_only=on' leiprova-db \
    psql -X -v ON_ERROR_STOP=1 -U leiprova_owner -d leiprova -At -F ' ' -c "$1" < /dev/null
}
fingerprint() {
  python3 -c 'import sys,json
t=sys.stdin.read(); i=t.find("{")
try: print(json.loads(t[i:]).get("fingerprint","") if i>=0 else "")
except Exception: print("")'
}
# stdin fechado: o `docker compose run` não pode consumir a lista lida pelo laço.
tools() {
  local receipt code
  receipt=$(mktemp "$RUN_DIR/step.XXXXXX") || return 1
  docker compose --profile tools run --rm -T --pull never "$@" >"$receipt" 2>"$receipt.err" < /dev/null
  code=$?
  cat "$receipt"
  if [ "$code" -eq 3 ]; then
    log "sem propostas novas; recibo=$receipt" >&2
  elif [ "$code" -ne 0 ]; then
    touch "$RUN_DIR/failed"
    log "falha operacional código=$code; recibo=$receipt" >&2
  fi
  return "$code"
}
summary() { grep -E '^  "(mode|approved|created|total|eligible|released|drafts)"|"productSlug"|"blockers"' | tr -s ' ' | tr '\n' ' '; echo; }

log "início; recibos=$RUN_DIR"
# Imagens são construídas no deploy; o cron não recompila o projeto a cada rodada.
docker image inspect leiprova-opportunity-approver leiprova-editorial-binding-importer >/dev/null 2>&1 \
  || { log "ferramentas ausentes; publique as imagens antes de executar"; exit 1; }
ACTOR=$(sql_ro "select public_id from users where role='admin'") || exit 1
if [ "$(printf '%s\n' "$ACTOR" | grep -c .)" != "1" ]; then log "exige exatamente um admin"; exit 1; fi

# 1. Aprovação dos rascunhos da fábrica, por edital.
contests=$(sql_ro "select distinct o.slug from questions q
    join question_opportunities l on l.question_id = q.id
    join contest_opportunities o on o.id = l.opportunity_id
    where q.quiz_mode = 'original_style' and q.editorial_status = 'draft' and q.created_by_user_id is null
    order by 1") || exit 1
for contest in $contests; do
  log "aprovar $contest: $(tools -e QUESTION_APPROVAL_REFERENCE="$REF" opportunity-approver \
    pnpm -s editorial:questions:approve -- --apply --standing --contest="$contest" | summary)"
done

# 2-4. Vínculos, revisões e liberação, por produto com questões revisadas da fábrica.
sql_ro "select p.slug, o.slug, p.status from contest_store_products p
    join contest_opportunities o on o.id = p.opportunity_id
    where p.status in ('draft', 'released') and exists (
      select 1 from question_opportunities l join questions q on q.id = l.question_id
      where l.opportunity_id = o.id and q.quiz_mode = 'original_style' and q.editorial_status = 'reviewed')
    order by o.exam_date nulls last, p.slug" > "$RUN_DIR/products" || exit 1
while read -r product opportunity status; do
  [ -n "$product" ] || continue
  [[ "$product" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ && "$opportunity" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] \
    || { log "identidade de produto/edital inválida"; exit 1; }
  log "ampliar conteúdo $product ($status)"
  if tools opportunity-approver pnpm -s editorial:bindings:propose -- --product="$product" > "$RUN_DIR/proposals.json"; then
    if ! install -m 644 "$RUN_DIR/proposals.json" .local/editorial/binding-input/proposals.json; then
      touch "$RUN_DIR/failed"
      log "falha ao preparar importação de $product"
      continue
    fi
    import_bindings() {
      tools -e LEIPROVA_BINDING_IMPORT_APPROVED=import_pending_bindings editorial-binding-importer \
        pnpm -s editorial:bindings:import --actor="$ACTOR" "$@"
    }
    fp=$(import_bindings --mode=preview | fingerprint)
    if [ -n "$fp" ]; then
      log "importar $product: $(import_bindings --mode=import-pending --fingerprint="$fp" | summary)"
    else
      log "importar $product: prévia recusada"
    fi
  fi

  # Ausência de trabalho não é falha. Não chamar os revisores com conjunto vazio.
  pending_counts=$(sql_ro "select count(*) filter (where r.editorial_status='draft'), count(*)
    from contest_product_question_bindings b
    join opportunity_requirements r on r.id=b.requirement_id
    join questions q on q.id=b.question_id
    where b.product_slug='$product' and b.status='pending_review'
      and q.editorial_status='reviewed'
      and date_trunc('milliseconds',q.updated_at)=date_trunc('milliseconds',b.question_updated_at)") || exit 1
  read -r pending_requirements pending_bindings <<< "$pending_counts"
  if [ "$pending_bindings" = "0" ]; then
    log "sem vínculos pendentes com versão atual $product; vínculos antigos são preservados"
    continue
  fi

  requirements() {
    tools -e LEIPROVA_REQUIREMENT_REVIEW_APPROVED="review-requirements:$opportunity" editorial-binding-importer \
      sh -c "LEIPROVA_REQUIREMENT_REVIEW_DATABASE_URL=\$LEIPROVA_BINDING_DATABASE_URL pnpm -s editorial:review:requirements --opportunity=$opportunity --actor=$ACTOR --reference=$PROGRAM_REF $*"
  }
  if [ "$pending_requirements" != "0" ]; then
    fp=$(requirements --mode=preview | fingerprint)
    [ -n "$fp" ] && log "itens do edital $opportunity: $(requirements --mode=apply --fingerprint="$fp" | summary)"
  fi

  bindings() {
    tools -e LEIPROVA_BINDING_REVIEW_APPROVED="review-bindings:$product" editorial-binding-importer \
      sh -c "LEIPROVA_BINDING_REVIEW_DATABASE_URL=\$LEIPROVA_BINDING_DATABASE_URL pnpm -s editorial:review:bindings --product=$product --opportunity=$opportunity --actor=$ACTOR --reference=$REF $*"
  }
  fp=$(bindings --mode=preview | fingerprint)
  [ -n "$fp" ] && log "vínculos $product: $(bindings --mode=apply --fingerprint="$fp" | summary)"

done < "$RUN_DIR/products"

# Todos os rascunhos entram na avaliação, inclusive os que ainda não têm edição.
# O gate original exige conteúdo válido, programa/fonte, modo e referência de prova.
# Produtos já abertos continuam recebendo os vínculos do laço acima.
log "avaliar abertura de todos os produtos pendentes"
tools -e PRODUCT_RELEASE_REFERENCE="$RELEASE_REF" opportunity-approver \
  pnpm -s commerce:product:release -- --apply --all-drafts || {
    log "fim com falha na avaliação de abertura; recibos=$RUN_DIR"; exit 1;
  }
if [ -f "$RUN_DIR/failed" ]; then
  log "fim com falhas operacionais; consultar recibos=$RUN_DIR"
  exit 1
fi
log "fim; avaliação concluída (bloqueios editoriais permanecem no relatório)"
