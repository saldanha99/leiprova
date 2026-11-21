# Motor editorial: artigos com 1 ou 2 questões (21/11/2026)

Pedido (b) da estrutura de SEO: priorizar a autoria nos artigos "finos" (1 ou 2 questões
`reviewed` com comentário), porque a página pública do artigo exige 3. Sem baixar o
critério de revisão.

## O que este branch faz (só ordenação)
- `claimAgentWork`: dentro da autoria, tarefas cujo requisito (`opportunity_requirement_articles`)
  toca um artigo fino vêm primeiro; depois, a ordem de sempre (faixa do produto, prova mais
  próxima). Não cria tarefa, não muda volume, revisão nem custo.
- Custo medido em produção (somente leitura, EXPLAIN ANALYZE): +~80 ms por reserva do Autor
  (hoje 0,55–0,67 s). Guardião e Radar não calculam a lista.

## Fila antes (produção, 21/11/2026 ~00h35 UTC)
| Autoria | Tarefas | Tocam artigo fino | Artigos finos tocados |
|---|---|---|---|
| pending | 477 | 7 | 8 |
| running | 4 | 3 | 3 |
| blocked | 301 | 21 | 24 |
| prepared (já escritas) | 1.639 | 215 | 278 |

Artigos finos: 457 (eram 469 em 20/11). 307 estão ligados a algum requisito de edital;
150 não estão em nenhum.

**Depois (projeção, vale após o deploy):** as 7 tarefas pendentes que tocam 8 artigos finos
passam para a frente da autoria. O ganho é pequeno: a fila pendente quase não toca os finos.

## O que resolveria de verdade (NÃO feito: muda o volume da fábrica)
Criar tarefas de autoria por artigo (`author-article:<id>`), 1 por artigo fino, pedindo 2–3
questões inéditas, com a mesma revisão do Guardião.
- Volume: ~457 tarefas do Autor + revisões do Guardião, ~700–1.100 questões a mais.
- Custo estimado pela média real do orçamento (`api-budget.json`, 21/11: Autor US$ 21,79/1.371
  execuções ≈ US$ 0,016; Guardião US$ 18,12/1.790 ≈ US$ 0,010): ≈ US$ 7 (Autor) + US$ 5–10
  (Guardião) ≈ **US$ 12–17**. Estimativa por média, não por medição deste tipo de tarefa.
- Orçamento atual: US$ 39,92 gastos de US$ 48 (parada) → sobram ~US$ 8. O restante iria para a
  assinatura Pro (limite de 5 h, o motor pausa sozinho) e competiria com a autoria dos produtos
  à venda.
- Depende do OK do Chefe/Vinícius (custo de IA e volume) e de deploy.
