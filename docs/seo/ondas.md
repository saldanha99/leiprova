# Ondas de indexação (spec seo-estrutura-organica.md, seção 5)

Atualizado em 21/11/2026. Base usada na seleção: dump de produção
`leiprova-20261121T000816Z.dump`, restaurado em banco descartável (só leitura em produção).

## Como a onda é controlada

| Variável | Valores | Efeito |
|---|---|---|
| `SEO_WAVE` | vazio/`off` (padrão), `0`, `paced`, `all` | Decide só o que entra no **sitemap**, no `llms.txt`/`llms-full.txt` e na fila do IndexNow. `off`: nenhuma URL de lei/artigo; `0`: os 300 artigos de `docs/seo/onda-0-300.txt` + as leis deles + `/leis`; `paced`: onda 0 + N artigos por dia (seção abaixo); `all`: tudo que passa no gate. |
| `SEO_WAVE_START` | `AAAA-MM-DD` (vazio = nada além da onda 0) | Só com `paced`: 1º dia de liberação, no calendário de São Paulo. |
| `SEO_WAVE_DAILY` | 50 a 100 (padrão 50) | Só com `paced`: artigos liberados por dia. Fora da faixa vira 50 ou 100. |
| `SEO_WAVE_GSC_DATE` + `SEO_WAVE_GSC_INDEXED_PCT` | `AAAA-MM-DD` + 0–100 (vazios) | Só com `paced`: a última leitura do GSC (% "Indexada" no segmento `/sitemap/artigos-*.xml`). Aciona o freio. Os dois juntos; um só é ignorado. |
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

## Onda em ritmo diário (`SEO_WAVE=paced`), a partir de 25/11/2026

Spec, seção 5: liberar ~50–100 páginas por dia, por nº de questões, com freio. Código em
`src/lib/seo/wave.ts` (`pacedRelease`, `pacedOrder`, `resolveWaveScope`); testes em
`tests/seo-wave-pace.test.ts`. Não há estado extra: o total liberado sai só da data e do `.env`.

1. **Candidatos**: artigos que passam no gate hoje e estão fora da onda 0, ordenados por
   questões `reviewed` com comentário (desc), empate pela ordem do artigo e depois pela URL.
   A lista é recalculada a cada requisição; a base de 24/11 está em
   `~/OpenBot/Shared/leiprova/seo-onda1-fora-hoje-2026-11-24.csv` (1.067 artigos).
2. **Quantos**: `N = min(total, dia × SEO_WAVE_DAILY)`, com dia 1 = `SEO_WAVE_START`. O dia
   vira à meia-noite de São Paulo. Entram a onda 0 + os N primeiros candidatos.
3. **Leis**: as 10 da onda 0 continuam; outra lei entra no sitemap/`llms.txt` quando tiver
   ≥ 10 artigos indexáveis liberados (e passar no gate da lei). No `llms.txt`, os
   "mais cobrados" de cada lei mostram só artigos já liberados.
4. **IndexNow**: o job diário (`deploy/seo-page-state.sh`, 04:30) envia as páginas da onda que
   mudaram **e** as que entraram desde ontem (compara o escopo de hoje com o de ontem).
5. **Freio** (leitura informada em `SEO_WAVE_GSC_DATE`/`_INDEXED_PCT`; vale a partir do dia
   seguinte à leitura e só se ela for do dia 28 em diante, porque a meta de 70% é de 4–6 semanas):
   - < 50% indexada e leitura no dia ≥ 42 (6 semanas): **para de crescer**; fica congelado no
     total do dia da leitura. Reforçar ou tirar do índice os 20% piores e só então seguir
     (nova leitura ≥ 50% ou novo `SEO_WAVE_START`).
   - < 70%: **reduz para 50/dia** a partir do dia seguinte.
   - ≥ 70%: segue o ritmo configurado.
   Leitura do GSC só depois do fim do core update (seção 5).

Simulação com o CSV de 24/11 (onda 0 já fora dele):

| Ritmo | 1º dia | Menor nº de questões no 1º dia | Lei nova no 1º dia | Dias para os 1.067 |
|---|---:|---:|---|---:|
| 50/dia | 50 artigos de 23 leis (CF 8, CTN 7) | 31 | nenhuma (CTN com 7) | 22 |
| 100/dia | 100 artigos de 31 leis | 20 | `/lei/codigo-tributario-nacional` (10) | 11 |

Valores sugeridos para começar: `SEO_WAVE=paced`, `SEO_WAVE_START=<dia do deploy>`,
`SEO_WAVE_DAILY=50`; subir para 100 só com leitura ≥ 70% no GSC. Mudar o `.env` de
produção e o deploy dependem do OK do Vinícius.

## Próximas ondas

Onda 1 (`SEO_WAVE=all` ou nova lista): só depois de ler o GSC por segmento
(`/sitemap/artigos-*.xml`), após o fim do core update e com os critérios da seção 5.
