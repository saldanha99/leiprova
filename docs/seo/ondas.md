# Ondas de indexação (spec seo-estrutura-organica.md, seção 5)

Atualizado em 21/11/2026. Base usada na seleção: dump de produção
`leiprova-20261121T000816Z.dump`, restaurado em banco descartável (só leitura em produção).

## Como a onda é controlada

| Variável | Valores | Efeito |
|---|---|---|
| `SEO_WAVE` | vazio/`off` (padrão), `0`, `all` | Decide só o que entra no **sitemap**, no `llms.txt`/`llms-full.txt` e na fila do IndexNow. `off`: nenhuma URL de lei/artigo; `0`: os 300 artigos de `docs/seo/onda-0-300.txt` + as leis deles + `/leis`; `all`: tudo que passa no gate. |
| `SEO_DIRECT_ANSWER_REQUIRED` | `1` (padrão) ou `0` | Item "resposta direta autoral reviewed ≥ 40 palavras" do gate 3.2. Com `1`, nenhum artigo passa hoje (o banco não tem esse texto) e todas as páginas de lei/artigo ficam `noindex, follow`. `0` relaxa **só** esse item; os demais continuam obrigatórios. Decisão do proprietário. |
| `INDEXNOW_KEY` | vazio (padrão) | Sem chave, nenhum envio ao IndexNow. |

As páginas sempre renderizam (o aluno navega). `index`/`noindex` vem só do gate
(`src/lib/seo/gates.ts`); a onda não muda o meta robots. Os outros ~487 artigos que
passam no gate ficam `index, follow`, fora do sitemap, até a próxima onda.

## Critério da onda 0 (300 páginas de artigo)

1. **Leis**: as 10 leis exigidas pelo maior número de produtos (`contest_store_products`)
   cujo programa revisado (`opportunity_requirements.editorial_status='reviewed'`) cita a
   lei, diretamente (`legal_act_id`) ou por artigo (`opportunity_requirement_articles`).
2. **Artigos**: só os que passam em todos os itens do gate 3.2, exceto a resposta direta
   (ausente no banco): artigo `reviewed` em versão `current`, ≥ 3 questões `reviewed`
   com comentário publicadas (D4: 3 a 5), ≥ 2 itens "cai assim", ≥ 250 palavras de texto
   próprio, similaridade < 0,5 com os outros artigos da lei e ≥ 1 link de entrada fora do sumário.
3. **Ordem**: dentro de cada lei, mais questões `reviewed` primeiro ("mais cobrados" na
   nossa base; empate pela ordem do artigo). As 300 vagas são preenchidas em rodízio
   entre as 10 leis, na ordem do item 1, para não concentrar tudo na CF.

Resultado (`pnpm seo:wave:select`): 787 artigos passam no gate (sem a resposta direta); 300 selecionados.

| Lei (URL) | Produtos | Artigos que passam | Na onda 0 |
|---|---:|---:|---:|
| /lei/constituicao-federal | 27 | 97 | 44 |
| /lei/codigo-de-processo-civil | 22 | 123 | 44 |
| /lei/lei-8429-1992 | 21 | 10 | 10 |
| /lei/codigo-de-processo-penal | 20 | 56 | 44 |
| /lei/lei-14133-2021 | 20 | 28 | 28 |
| /lei/codigo-civil | 18 | 106 | 44 |
| /lei/lei-8069-1990 | 17 | 20 | 20 |
| /lei/lei-6015-1973 | 17 | 20 | 20 |
| /lei/lei-11101-2005 | 16 | 33 | 33 |
| /lei/codigo-de-defesa-do-consumidor | 15 | 13 | 13 |

As 10 páginas de lei passam no gate da lei (≥ 10 artigos indexáveis) com
`SEO_DIRECT_ANSWER_REQUIRED=0`. O Código Penal não aparece: não tem versão `current` no banco.

### SQL de conferência (só leitura)

Produtos por lei:

```sql
select coalesce(v.legal_act_id, r.legal_act_id) as act_id,
       count(distinct p.slug) as products
from opportunity_requirements r
join contest_store_products p on p.opportunity_id = r.opportunity_id
left join opportunity_requirement_articles ra on ra.requirement_id = r.id
left join legal_articles a on a.id = ra.legal_article_id
left join legal_versions v on v.id = a.legal_version_id
where r.editorial_status = 'reviewed'
group by 1
order by 2 desc;
```

Questões `reviewed` com comentário por artigo (base do "mais cobrados" e do mínimo de 3):

```sql
select v.legal_act_id, a.id, a.path, count(q.id) as questions
from legal_articles a
join legal_versions v on v.id = a.legal_version_id and v.status = 'current'
join legal_acts l on l.id = v.legal_act_id and l.is_active
join questions q on q.legal_article_id = a.id
  and q.editorial_status = 'reviewed' and length(btrim(q.explanation)) > 0
where a.editorial_status = 'reviewed'
group by 1, 2, 3
having count(q.id) >= 3
order by 1, 4 desc, a.article_order;
```

Palavras próprias, "cai assim" e similaridade são calculados em código
(`src/lib/seo/legal-snapshot.ts`), com as mesmas regras do inventário T0
(`scripts/seo/inventario_gate_artigo.py`).

## Lacuna: resposta direta (40–70 palavras, autoral, reviewed)

O banco **não tem** texto autoral revisado por artigo (`legal_articles` só tem
`heading`, que é o capítulo; não há tabela de resumos). Por regra, nada foi gerado por IA
nem simulado: o bloco só aparece quando houver o dado, e o item do gate falha.

Proposta para o motor editorial (sem gasto de API antes de autorização):
- tabela `legal_article_summaries` (`legal_article_id`, `legal_version_checksum`, `text`,
  `word_count` 40–70, `editorial_status`, `approval_reference`, `human_review`);
- o Autor redige a partir só do texto oficial do artigo e das questões `reviewed` dele;
  o Guardião confere fidelidade ao texto literal (nenhuma afirmação fora do artigo) e a
  liberação segue a linha já autorizada (`owner_standing_authorization`, `humanReview:false`),
  com o mesmo aviso de IA da página;
- começar pelos 300 artigos da onda 0; o resumo entra no hash de conteúdo e move o lastmod.

## Próximas ondas

Onda 1 (`SEO_WAVE=all` ou nova lista): só depois de ler o GSC por segmento
(`/sitemap/artigos-*.xml`), após o fim do core update e com os critérios da seção 5.
