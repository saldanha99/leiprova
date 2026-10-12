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
#   40 1,7,13,19 * * * root /opt/leiprova/deploy/editorial-release-chain.sh >> /var/log/leiprova-release-chain.log 2>&1
set -uo pipefail
cd /opt/leiprova || exit 1

exec 9>/tmp/leiprova-release-chain.lock
if ! flock -n 9; then echo "$(date -u +%FT%TZ) já em execução; saindo."; exit 0; fi

REF="owner-standing-2026-10-11:aprovar-sozinho"
log() { echo "$(date -u +%FT%TZ) $*"; }
sql_ro() {
  docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' leiprova-db \
    psql -U leiprova_owner -d leiprova -At -F ' ' -c "$1"
}
fingerprint() {
  python3 -c 'import sys,json
t=sys.stdin.read(); i=t.find("{")
try: print(json.loads(t[i:]).get("fingerprint","") if i>=0 else "")
except Exception: print("")'
}
# stdin fechado: o `docker compose run` não pode consumir a lista lida pelo laço.
tools() { docker compose --profile tools run --rm -T "$@" 2>/dev/null < /dev/null; }
summary() { grep -E '^  "(mode|approved|created|total|eligible|released|drafts)"|"productSlug"|"blockers"' | tr -s ' ' | tr '\n' ' '; echo; }

log "início"
docker compose --profile tools build -q opportunity-approver editorial-binding-importer >/dev/null 2>&1 \
  || { log "falha ao construir as ferramentas"; exit 1; }
ACTOR=$(sql_ro "select public_id from users where role='admin'")
if [ "$(printf '%s\n' "$ACTOR" | grep -c .)" != "1" ]; then log "exige exatamente um admin"; exit 1; fi

# 1. Aprovação dos rascunhos da fábrica, por edital.
for contest in $(sql_ro "select distinct o.slug from questions q
    join question_opportunities l on l.question_id = q.id
    join contest_opportunities o on o.id = l.opportunity_id
    where q.quiz_mode = 'original_style' and q.editorial_status = 'draft' and q.created_by_user_id is null
    order by 1"); do
  log "aprovar $contest: $(tools -e QUESTION_APPROVAL_REFERENCE="$REF" opportunity-approver \
    pnpm -s editorial:questions:approve -- --apply --standing --contest="$contest" | summary)"
done

# 2-4. Vínculos, revisões e liberação, por produto com questões revisadas da fábrica.
sql_ro "select p.slug, o.slug, p.status from contest_store_products p
    join contest_opportunities o on o.id = p.opportunity_id
    where p.status in ('draft', 'released') and exists (
      select 1 from question_opportunities l join questions q on q.id = l.question_id
      where l.opportunity_id = o.id and q.quiz_mode = 'original_style' and q.editorial_status = 'reviewed')
    order by o.exam_date nulls last, p.slug" |
while read -r product opportunity status; do
  [ -n "$product" ] || continue
  if tools opportunity-approver pnpm -s editorial:bindings:propose -- --product="$product" > /tmp/leiprova-proposals.json; then
    install -m 644 /tmp/leiprova-proposals.json .local/editorial/binding-input/proposals.json
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

  requirements() {
    tools -e LEIPROVA_REQUIREMENT_REVIEW_APPROVED="review-requirements:$opportunity" editorial-binding-importer \
      sh -c "LEIPROVA_REQUIREMENT_REVIEW_DATABASE_URL=\$LEIPROVA_BINDING_DATABASE_URL pnpm -s editorial:review:requirements --opportunity=$opportunity --actor=$ACTOR --reference=$REF $*"
  }
  fp=$(requirements --mode=preview | fingerprint)
  [ -n "$fp" ] && log "itens do edital $opportunity: $(requirements --mode=apply --fingerprint="$fp" | summary)"

  bindings() {
    tools -e LEIPROVA_BINDING_REVIEW_APPROVED="review-bindings:$product" editorial-binding-importer \
      sh -c "LEIPROVA_BINDING_REVIEW_DATABASE_URL=\$LEIPROVA_BINDING_DATABASE_URL pnpm -s editorial:review:bindings --product=$product --opportunity=$opportunity --actor=$ACTOR --reference=$REF $*"
  }
  fp=$(bindings --mode=preview | fingerprint)
  [ -n "$fp" ] && log "vínculos $product: $(bindings --mode=apply --fingerprint="$fp" | summary)"

  if [ "$status" = "draft" ]; then
    log "liberar $product: $(tools -e PRODUCT_RELEASE_REFERENCE="$REF" opportunity-approver \
      pnpm -s commerce:product:release -- --apply "$product" | summary)"
  fi
done
log "fim"
