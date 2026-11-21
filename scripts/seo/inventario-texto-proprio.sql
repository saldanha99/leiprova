\pset format unaligned
\pset tuples_only on
\pset fieldsep '\x1f'
\pset recordsep '\x1e'
with art as (
  select a.id, l.slug lei
  from legal_articles a join legal_versions v on v.id=a.legal_version_id and v.status='current'
  join legal_acts l on l.id=v.legal_act_id and l.is_active
  where a.editorial_status='reviewed'),
q as (
  select q.legal_article_id aid, q.id, q.prompt, q.explanation,
    row_number() over (partition by q.legal_article_id order by length(q.explanation) desc, q.id) rn,
    count(*) over (partition by q.legal_article_id) n
  from questions q join art on art.id=q.legal_article_id
  where q.editorial_status='reviewed' and coalesce(length(q.explanation),0)>0)
select art.id, art.lei, max(q.n),
  string_agg(q.prompt || ' ' || q.explanation || ' ' || coalesce((select string_agg(coalesce(o.rationale,''),' ') from question_options o where o.question_id=q.id),''), ' ' order by q.rn)
from art join q on q.aid=art.id and q.rn<=5
group by 1,2 having max(q.n)>=3;
