# Vínculos questão × produto bloqueados e temas de confiança média (24/11/2026)

Pedido do Vinícius (24/11, via Chefe de Gabinete, "pode autorizar tudo!!"): destravar os
mapeamentos legais bloqueados e aplicar os temas de confiança média e os temas novos, sem
afrouxar o gate de SEO e de venda.

## 1. Diagnóstico (produção, somente leitura, 24/11 ~17h50 UTC)

O número 2.907 do registro de 21/11 não aparece em nenhuma tabela nem documento. O estoque
real de vínculos questão × artigo × produto (`contest_product_question_bindings`) fora de
`approved` era:

| Situação | Vínculos | Motivo | Tipo |
|---|---:|---|---|
| `pending_review`, aptos | 3.711 | Revisor recusa o produto inteiro quando há **mais de 250** pendências (`rows.length > 250`): TJ-MS cartórios 3.213, PGE-AL 389, ENAM 343, TJ-MT 278, TCE-RN 254 | técnico |
| `pending_review`, aptos (mesmo motivo acima, em parte) | (incluídos acima) | **Tudo ou nada**: um único inelegível no lote trava o produto (TRF-5 39/42, TRF-2 21/35, TJ-PR 9/37, TJ-BA 22/24, PC-MA 1/2, SEFAZ-AL 0/9) | técnico |
| `pending_review`, tema | 915 | A classificação de temas de 21/11 deu `topic_id` à questão; o requisito do edital não tem tema e a regra de acesso exigia `topic_id is not distinct from` | técnico (efeito colateral de 21/11) |
| `pending_review`, questão alterada | 33 | `questions.updated_at` diferente de `question_updated_at` do vínculo (questão reescrita depois da proposta) | processo: o motor repropõe |
| `suspended` | 344 | 338 já têm outro vínculo válido (transição de versão de 23/11 e CP); 6 voltaram à fila (`draft`/`suspended`) | correto, nada a fazer |

Nenhum grupo é "dúvida de conteúdo": nenhum vínculo foi bloqueado por artigo errado. As tarefas
de mapeamento de requisito do motor (`editorial_agent_work`, `mapping:` `blocked`: 992) são
outra coisa: requisitos de edital sem lei seca correspondente (doutrina, jurisprudência, lei
inteira sem recorte, 71 sem corpus). Ficam como estão.

**Achado grave do mesmo efeito:** 3.767 vínculos **aprovados** (3.767 questões, 27 produtos à
venda) deixaram de valer na regra de acesso desde 21/11 pelo mesmo motivo do tema. Não há
compra avulsa ativa (`contest_purchases` = 0) e assinatura dá acesso total, então nenhum aluno
perdeu acesso; o efeito é na contagem dos produtos (régua de 68) e no conteúdo dos concursos.

## 2. Correções no código

- `scripts/review-current-product-bindings.ts`: percorre as pendências em janelas de 250 e
  decide até 250 **elegíveis** por rodada; os inelegíveis seguem pendentes. A prévia final ainda
  exige elegíveis = total. A regra de acesso não mudou.
- `src/lib/commerce/product-binding-query.ts` (regra de acesso): requisito **sem** tema não filtra
  por tema; requisito com tema exige o mesmo tema. É a regra que a proposta
  (`propose-product-bindings.ts`) e o serviço de vínculos já usavam. **Só vale após deploy.**
- `scripts/seo/topicos/regras.py`: exclusão do Cap. VI da Lei 9.605/1998 (infração
  administrativa, não penal) e 31 regras/temas novos.

## 3. Execução em produção (24/11)

Backup: `/opt/leiprova/.local/backups/vinculos-20261124/` (bindings, certificações, `quiz_topics`,
`questions.id/topic_id` antes dos temas, `max(audit_logs.id)` antes).

- **Vínculos:** o script corrigido rodou por stdin no contêiner `editorial-binding-importer`
  (sem rebuild), com o mesmo serviço, a mesma referência permanente
  (`owner-standing-2026-10-11:aprovar-sozinho`) e certificação de contrato. Recibos em
  `.../vinculos-20261124/run/`. Contagens no relatório final (seção 6).
- **Temas:** só nas questões **sem vínculo** de produto (ou com requisito do mesmo tema), para não
  tirar questões dos produtos antes do deploy. Lotes no `audit_logs`
  (`seo.topic_classified`, `metadata.batch` = `2026-11-24-sem-vinculo` e `2026-11-24-sem-vinculo-2`).
- **Temas novos:** 31 em `quiz_topics` (`audit_logs.action = 'seo.topic_created'`, batch `2026-11-24`).

## 4. Amostras conferidas

- Confiança média (semente 20261124, 100): **93 certas, 5 discutíveis, 2 erradas (93%)**. As 2
  erradas são o Cap. VI da Lei 9.605 (corrigido com exclusão: 41 propostas saíram). Discutíveis:
  Código Eleitoral (alistamento/juízes) em "Processo eleitoral" (encaixe largo já marcado) e Lei
  9.784 em "Atos administrativos". Arquivo: `docs/seo/topicos-amostra-media-100-2026-11-24.csv`.
- Temas novos (50): **50/50** coerentes com o bloco oficial do artigo.

## 5. Rollback

```sql
-- Vínculos aprovados nesta operação (pela trilha de auditoria após o id guardado no backup)
update contest_product_question_bindings b set status='pending_review', reviewed_by_user_id=null, reviewed_at=null,
  review_notes=null, updated_at=now()
from audit_logs a where a.id > :max_audit_id_antes and a.action='editorial.product_binding.approved'
  and a.entity_id=b.id and a.created_at between '2026-11-24 18:00Z' and :fim;
delete from question_contract_certifications c using audit_logs a where a.id > :max_audit_id_antes
  and a.action='editorial.product_binding.question_contract.certified' and a.entity_id=c.binding_id
  and a.created_at between '2026-11-24 18:00Z' and :fim;
-- Temas desta operação
update questions q set topic_id=null from audit_logs a where a.action='seo.topic_classified'
  and a.metadata->>'batch' like '2026-11-24%' and q.id=a.entity_id::bigint and q.topic_id=(a.metadata->>'topicId')::bigint;
-- Temas novos (depois de zerar os topic_id acima)
delete from quiz_topics t using audit_logs a where a.action='seo.topic_created' and a.metadata->>'batch'='2026-11-24'
  and t.id=a.entity_id::bigint and not exists (select 1 from questions q where q.topic_id=t.id);
```
Código: `git revert` do commit desta operação.
