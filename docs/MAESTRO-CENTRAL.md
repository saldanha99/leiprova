# Maestro central da Editalume

Roteiro do agente que coordena a produção editorial no nó **Maestro LeiProva** do
Maestri (workspace "LeiProva — Fábrica Editorial"). Desde 11/10/2026 o Maestro pode
ser o **Codex**. Leia antes `AGENTS.md`, `docs/OPERACAO.md` (entradas do topo) e
`docs/MAESTRI-MOTORES-AUTOMATICOS.md`. Responda ao proprietário sempre em português.

## Como trocar o Maestro para o Codex

1. No Maestri, clique no nó **Maestro LeiProva**.
2. Encerre o Claude com `/exit` e digite `codex`; aceite confiar na pasta do projeto.
3. Primeira mensagem: `Leia AGENTS.md e docs/MAESTRO-CENTRAL.md e execute a rotina do Maestro.`
4. Opcional: crie no Maestri uma rotina a cada 6 horas para o nó Maestro com a mesma mensagem.

## O que já roda sozinho

| Peça | Onde | Frequência |
|---|---|---|
| Radar, Guardião e Autor (fila de agentes) | Maestri, no Mac | rotinas de 20 min |
| Worker editorial (editais, extração, preparação da fila) | VPS, `leiprova-editorial-automation` | 6 h |
| **Linha de liberação** (`deploy/editorial-release-chain.sh`) | VPS, `/etc/cron.d/leiprova-release-chain` | 01h40, 07h40, 13h40 e 19h40 UTC |
| Master | abre sozinho com 3 concursos à venda (`MASTER_CHECKOUT_ENABLED=auto`) | a cada acesso |

A linha de liberação existe por decisão do proprietário (11/10/2026, "aprovar sozinho,
sem me perguntar"). Ela faz quatro coisas, nesta ordem:

1. Aprova os rascunhos da fábrica que passam nas checagens automáticas: procedência,
   fonte vigente, perfil da banca, alternativas, gabarito e originalidade. A auditoria
   registra `owner_standing_authorization` e `humanItemReview: false`.
2. Importa os vínculos das questões aos itens do edital.
3. Revisa os itens do edital e os vínculos.
4. Libera o produto que alcançar 68 questões e cumprir as demais condições.

Log: `/var/log/leiprova-release-chain.log` na VPS.

## Rotina do Maestro (a cada sessão ou rotina)

1. **Saúde.** Siga o checklist de retomada, usando consultas só de leitura:
   - `ssh wisewolf-vps "tail -40 /var/log/leiprova-release-chain.log"`;
   - último `automation.editorial.completed` em `audit_logs`;
   - `tail .local/maestri/preflight-events.jsonl`. `agent_offline` do Guardião ou do Autor
     significa que o Codex daquele nó fechou: peça ao proprietário para reabrir (nó →
     `codex`). Não forje `MAESTRI_SOCKET`.
2. **Conferência das aprovadas sem revisão humana.** Liste as questões aprovadas pela linha
   desde a última conferência. Guarde o horário da última conferência em
   `.local/maestri/maestro-conferencia.txt`; esse arquivo é privado e fica fora do Git.

   ```bash
   ssh wisewolf-vps "docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' leiprova-db psql -U leiprova_owner -d leiprova -At -c \"
   select q.public_id, q.prompt, a.article_ref, a.literal_text,
     (select string_agg(o.option_key || case when o.is_correct then '*' else '' end || ') ' || o.text, E'\n' order by o.sort_order) from question_options o where o.question_id = q.id)
   from audit_logs l join questions q on q.public_id = l.entity_id
   join legal_articles a on a.id = q.legal_article_id
   where l.action = 'editorial.original_question.batch_approved'
     and l.metadata->>'itemBindingMode' = 'owner_standing_authorization'
     and l.created_at > '<ÚLTIMA CONFERÊNCIA>' and q.editorial_status = 'reviewed'
   order by l.id\""
   ```

   Para cada questão, confira o gabarito (`*`) contra o texto literal do artigo, a
   correção das demais alternativas e se o enunciado não contradiz a lei. Na dúvida,
   suspenda.
3. **Suspender o que tiver erro.** A questão sai do treino e dos produtos. Se um produto
   cair abaixo de 68, a venda dele fecha sozinha.

   ```bash
   ssh wisewolf-vps 'cd /opt/leiprova && docker compose --profile tools run --rm -T -e SUSPENSION_REFERENCE=maestro-conferencia-AAAA-MM-DD opportunity-approver pnpm -s editorial:questions:suspend -- --apply --reason="<erro encontrado>" question=<uuid> question=<uuid>'
   ```
4. **Rodar a linha fora do horário,** se houver rascunhos novos e pressa:
   `ssh wisewolf-vps /opt/leiprova/deploy/editorial-release-chain.sh`.
5. **Relatório ao proprietário,** em português:
   - concursos à venda e questões por produto;
   - o que foi aprovado e o que foi suspenso;
   - agentes offline;
   - pendências que dependem dele.

## Limites que continuam valendo

- Nunca abra ou feche feature flags, checkout, Stripe ou Stripe Connect sem decisão
  explícita do proprietário. A Master abre sozinha pela regra `auto`; não mexa nela.
- Nunca copie segredos para notas, prompts ou Git. O `.env` de produção fica só na VPS.
- Não faça scraping de questões de terceiros; prova anterior só por link oficial.
- A aprovação permanente vale **apenas** para inéditas da fábrica, pela linha de
  liberação. Prova anterior, edital, dispensa e produto fora dela seguem as regras de
  `AGENTS.md`.
- Mudança de código: siga `AGENTS.md`. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  (com a máquina carregada, `pnpm exec vitest run --maxWorkers=4`). Depois:
  - commit com mensagem em inglês;
  - `git push origin HEAD:main`;
  - publique com `ssh wisewolf-vps 'cd /opt/leiprova && LEIPROVA_SKIP_SEED=1 ./deploy/pull-deploy.sh'`
    (nunca rode o seed em produção).

## Pendências conhecidas (11/10/2026)

- **TC-DF (53 questões) e ENAC (52)**, provas em 22/11: faltam 15 e 16 questões. A fila
  já prioriza os dois, e a linha libera sozinha ao chegar a 68. O terceiro concurso à
  venda abre o Master.
- **LGPD, Lei 12.737 e Lei 14.133** não estão na biblioteca, porque o Senado não tem
  compilação delas. Cerca de 45 requisitos ficam bloqueados como `official_corpus_missing`.
  Exige um leitor do Planalto que descarte o texto revogado (tachado).
- **PC-PR:** a prova foi em 11/10. As 145 tarefas de mapeamento perderam o sentido e
  não bloqueiam a fila.
- **ENAM:** 33 vínculos pendentes são propostas repetidas de questões que já estão no
  produto. Podem ficar como estão.
- **12 questões de lei seca do piloto (05/09)** seguem pendentes, fora de qualquer concurso.
- **Compra de controle do ENAM, com estorno,** é do proprietário.
