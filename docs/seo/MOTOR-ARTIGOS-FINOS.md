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

## O que resolveria de verdade (feito depois, ver abaixo)
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

## Autoria por artigo fino (feito em 21/11/2026, branch `feat/motor-artigos-finos-v2`)

Aprovado pelo proprietário (volume e custo; assinatura Pro pode ser usada; sem OpenRouter ou
outro provedor pago). Código em `src/lib/editorial/thin-article-authoring.ts` e
`src/lib/editorial/thin-article-job.ts`; script `scripts/enqueue-thin-article-authoring.ts`.

- **1 tarefa por artigo fino**, chave `author-thin:<requisito>:<artigo>`, tipo `authoring` (Autor).
  O payload é o da autoria do requisito (`author:<requisito>`: contrato de questão, mapa-pai,
  hash de contexto, banca, cargo, perfil) com `articles` = só o artigo fino, instruções pedindo
  **2–3 inéditas** e `context.thinArticle.existingPrompts` (enunciados atuais, para não repetir).
  Reserva, contrato, originalidade, importação como rascunho, aprovação pela linha de
  liberação e vínculo ao produto: tudo igual. Nenhum gate mudou.
- O requisito escolhido: cobertura do edital (`opportunity_requirement_articles`) ou artigo já
  presente nos artigos da autoria do requisito (proposto pelo Guardião); exige autoria
  `author:<id>` com contrato vigente, mapa-pai `prepared` com o mesmo hash e o mesmo hash de
  contexto do requisito. Preferência: produto à venda, cobertura, menor id.
- Chave lida em: `requirementIdOf` (reserva) e `scripts/propose-product-bindings.ts` (vínculo).
  O worker do host não interpreta a chave (só o formato geral): não precisa reiniciar.
- **Prioridade**: na reserva do Autor, `author-thin:` fica **depois de toda a autoria normal**
  (hoje toda de produtos à venda) e, entre si, na ordem do enfileiramento (onda 0, depois mais
  requisitos de produtos à venda, leis da onda 0 nos empates). **Teto**:
  `EDITORIAL_THIN_ARTICLE_MAX_RUNNING` (padrão **1**; `0` pausa; valor inválido também pausa)
  tarefas `author-thin:` em execução ao mesmo tempo, contadas no banco sob a trava da reserva
  (soma a instância Claude e a Codex). Lido no contêiner `editorial-automation` (docker-compose).
- **Idempotência**: artigo com 3+ revisadas sai da lista; artigo com tarefa `author-thin:` em
  qualquer estado exceto `superseded` é pulado. Rodar de novo não duplica.

### Produção (somente leitura, 21/11/2026 ~03h30 UTC)
| Grupo | Artigos |
|---|---|
| Artigos finos | 456 |
| onda 0 (URL exata da lista) | 0 (a onda 0 já exige 3 questões) |
| à venda (aparecem em requisitos de produtos liberados) | 287 |
| demais (alcançáveis pela autoria de um requisito) | 144 |
| inalcançáveis | 25 (2 sem requisito algum; 23 sem autoria com contrato vigente/mapa atual) |

Tarefas esperadas: **431** (431 em requisitos de produtos à venda; 281 em leis da onda 0).
Custo pela média real: Autor 431 × US$ 0,016 ≈ **US$ 7** (+ novas tentativas). O Guardião não
roda por tarefa de autoria (só o mapa gera autoria), então ≈ US$ 0 de Guardião; se contar como o
estimado antes, +US$ 4. Depois do teto mensal da API, segue pela assinatura/Codex.

### Operação (depois do merge e do deploy)
```bash
cd /opt/leiprova && LEIPROVA_SKIP_SEED=1 ./deploy/pull-deploy.sh   # recria editorial-automation
docker compose exec -T editorial-automation ./node_modules/.bin/tsx --env-file-if-exists=.env \
  scripts/enqueue-thin-article-authoring.ts --dry-run
docker compose exec -T editorial-automation ./node_modules/.bin/tsx --env-file-if-exists=.env \
  scripts/enqueue-thin-article-authoring.ts --apply          # ou --apply --limit=20 primeiro
```
Conferir:
```sql
select status, count(*) from editorial_agent_work where job_key like 'author-thin:%' group by 1;
```
Pausar: `EDITORIAL_THIN_ARTICLE_MAX_RUNNING=0` em `/opt/leiprova/.env` e
`docker compose up -d editorial-automation` (as em execução terminam). Retirar as pendentes:
```sql
update editorial_agent_work set status='superseded', last_error_code='thin_article_withdrawn', updated_at=now()
where job_key like 'author-thin:%' and status='pending';
```
(O script volta a criá-las se rodar de novo.) Código antigo não reserva `author-thin:`: sem
requisito pela chave, o contrato vigente não confere.
