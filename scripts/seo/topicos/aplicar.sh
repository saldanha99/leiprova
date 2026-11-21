#!/bin/sh
# Classifica topic_id das questões reviewed sem tema pela estrutura oficial da lei.
# NÃO roda sozinho em produção: exige OK (escrita no banco). Uma carga por vez na VPS.
#
#   sh scripts/seo/topicos/aplicar.sh alta        # só confiança alta
#   sh scripts/seo/topicos/aplicar.sh alta,media  # alta + média
#   sh scripts/seo/topicos/aplicar.sh alta --executar   # sem --executar = simulação
#
# Grava só questions.topic_id (onde ainda é null). NÃO toca updated_at: os vínculos de
# produto comparam esse campo. Origem e confiança vão para audit_logs
# (action seo.topic_classified). Reverter: ver README.md.
set -eu
NIVEIS="${1:?informe alta ou alta,media}"
EXECUTAR="${2:-}"
HOST="${LEIPROVA_HOST:-leiprova-vps}"
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' 0 1 2 15
HERE="$(cd "$(dirname "$0")" && pwd)"

psql_remote() { ssh "$HOST" 'cd /opt/leiprova && docker compose exec -T db sh -c "psql -q -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\""'; }

for spec in \
  "snap|select distinct on (l.slug) l.slug, t.status, t.normalized_content from legal_text_snapshots t join legal_acts l on l.id=t.legal_act_id where t.status in ('approved','superseded') order by l.slug, (t.status='approved') desc, t.fetched_at desc" \
  "art|select a.id, l.slug, a.article_ref from legal_articles a join legal_versions v on v.id=a.legal_version_id and v.status='current' join legal_acts l on l.id=v.legal_act_id" \
  "q|select q.id, q.legal_article_id, q.subject_id, q.topic_id, left(regexp_replace(q.prompt,'\s+',' ','g'),260) prompt from questions q where q.editorial_status='reviewed'" \
  "topics|select t.id, t.subject_id, t.name, s.name subject from quiz_topics t join quiz_subjects s on s.id=t.subject_id" \
  "subjects|select id, name from quiz_subjects"; do
  name="${spec%%|*}"; query="${spec#*|}"
  printf '%s\n' "\\copy ($query) to stdout csv header" | psql_remote > "$DIR/$name.csv"
done

python3 -I "$HERE/classificar.py" "$DIR" "$DIR/proposta.csv"
python3 -I - "$DIR/proposta.csv" "$NIVEIS" > "$DIR/aplicar.csv" <<'PY'
import csv, sys
levels = set(sys.argv[2].split(","))
w = csv.writer(sys.stdout)
for r in csv.DictReader(open(sys.argv[1], encoding="utf-8")):
    if r["confianca"] in levels:
        w.writerow([r["question_id"], r["topic_id"], r["confianca"], r["origem"]])
PY
echo "linhas a aplicar ($NIVEIS): $(wc -l < "$DIR/aplicar.csv")"
[ "$EXECUTAR" = "--executar" ] || { echo "simulação: nada gravado (use --executar)"; exit 0; }

{
  echo "begin;"
  echo "create temp table topic_proposal(question_id bigint primary key, topic_id bigint not null, confidence text not null, origin text not null);"
  printf '%s\n' "\\copy topic_proposal from stdin csv"
  cat "$DIR/aplicar.csv"
  printf '%s\n' '\\.'
  cat <<'SQL'
with applied as (
  update questions q set topic_id = p.topic_id
  from topic_proposal p
  where q.id = p.question_id and q.topic_id is null and q.editorial_status = 'reviewed'
  returning q.id, p.topic_id, p.confidence, p.origin)
insert into audit_logs (action, entity_type, entity_id, metadata)
select 'seo.topic_classified', 'question', id::text,
  jsonb_build_object('topicId', topic_id, 'confidence', confidence, 'origin', origin, 'classifier', 'estrutura-oficial-v1')
from applied;
select count(*) as aplicadas from audit_logs where action='seo.topic_classified' and created_at >= now() - interval '1 minute';
commit;
SQL
} | psql_remote
