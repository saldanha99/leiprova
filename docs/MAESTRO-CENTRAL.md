# Maestro central da Edital Lei Seca

**Retomada de 12/10/2026, após 12h BRT:** leia primeiro
[o estado reconferido](RETOMADA-2026-10-12.md) e o topo de `OPERACAO.md`.
A oferta foi reconferida em três preparações/285 questões válidas; o PC-MA
foi suspenso depois do relatório histórico abaixo. Notas antigas do canvas
e o relatório do início da madrugada não representam o estado atual.

Roteiro do agente que coordena a produção editorial no nó **Maestro LeiProva** do
Maestri (workspace "LeiProva — Fábrica Editorial"). Desde 11/10/2026 o Maestro pode
ser o **Codex**. Leia antes `AGENTS.md`, `docs/OPERACAO.md` (entradas do topo) e
`docs/MAESTRI-MOTORES-AUTOMATICOS.md`. Responda ao proprietário sempre em português.

## Estado operacional atual — 12/10/2026, após o corte de produção

Marca atual: **Edital Lei Seca**. O nó `Maestro LeiProva`, os IDs dos agentes, o
workspace, os aliases técnicos e os recursos `leiprova` permanecem preservados.
Não renomear identificadores nem criar agentes ou rotinas duplicados.

Produção ativa: **`everglades-vps`**, aplicação em **`editaleiseca.com.br`**.
O corte foi concluído em 12/10/2026, cerca de 01h23 BRT, com HTTPS válido,
cópia final e conferência das 68 tabelas. A origem `wisewolf-vps` preserva banco,
pooler e backups; app e workers estão parados. Caddy legado redireciona páginas
em 301 e encaminha o webhook antigo. Não reiniciar workers na origem.
A ponte privada `.local/maestri/remote-target.json` aponta para `everglades-vps`;
crons de backup/liberação e os três workers foram iniciados somente no destino.
Leia `docs/MIGRACAO-EDITAL-LEI-SECA-2026-10-11.md` antes de operar ou retornar.

Oferta confirmada pelo predicado de vínculos válidos: **ENAM (146), ENAC (70), PC-MA
Delegado (82) e TC-DF (69)**. São quatro preparações disponíveis; o Master está aberto
por `auto`. Entre os 84 produtos, 80 ainda não atingem 68 válidas, 70 carecem de
edição oficial revisada e 73 de prova anterior aprovada ou dispensa. Déficit mínimo:
5.440 questões válidas. Não apresentar preço LIVE ou rascunho como preparação pronta.

A prioridade passou a considerar `approvedProductQuestionCount`, calculado uma vez
por produto ligado em CTEs materializadas. Um produto com 68 associações mas 67
vínculos válidos continua incompleto. A conferência de fontes, artigos do programa,
versão legal, perfil e evidências permanece. Não ampliar mapeamento aprovado para
atingir quantidade.

No retrato da ponte após o corte, o orçamento era 43/48 em 24h, com reservas
ativas preservadas. Reconsultar status antes de disparar qualquer tarefa e conferir
os recibos; inicialização e documentação não comprovam produção contínua.

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
   - `ssh everglades-vps "tail -40 /var/log/leiprova-release-chain.log"`;
   - último `automation.editorial.completed` em `audit_logs`;
   - `tail .local/maestri/preflight-events.jsonl`. `agent_offline` do Guardião ou do Autor
     significa que o Codex daquele nó fechou: peça ao proprietário para reabrir (nó →
     `codex`). Não forje `MAESTRI_SOCKET`.
2. **Conferência das aprovadas sem revisão humana.** Liste as questões aprovadas pela linha
   desde a última conferência. Guarde o horário da última conferência em
   `.local/maestri/maestro-conferencia.txt`; esse arquivo é privado e fica fora do Git.

   ```bash
   ssh everglades-vps "docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' leiprova-db psql -U leiprova_owner -d leiprova -At -c \"
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
   ssh everglades-vps 'cd /opt/leiprova && docker compose --profile tools run --rm -T -e SUSPENSION_REFERENCE=maestro-conferencia-AAAA-MM-DD opportunity-approver pnpm -s editorial:questions:suspend -- --apply --reason="<erro encontrado>" question=<uuid> question=<uuid>'
   ```
4. **Rodar a linha fora do horário,** se houver rascunhos novos e pressa:
   `ssh everglades-vps /opt/leiprova/deploy/editorial-release-chain.sh`.
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
- A aprovação permanente das inéditas usa a linha de liberação. Em 12/10/2026,
  o proprietário também autorizou revisão automatizada de fontes, editais e
  programas oficiais, com auditoria `humanReview:false`. Cada aplicação exige
  evidência primária e identidade exata; `prepared` não é aprovação. Prova anterior,
  direitos e dispensa continuam sujeitos às verificações específicas de `AGENTS.md`.
- Mudança de código: siga `AGENTS.md`. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  (com a máquina carregada, `pnpm exec vitest run --maxWorkers=2`). Depois:
  - commit com mensagem em inglês;
  - `git push origin HEAD:main`;
  - publique com `ssh everglades-vps 'cd /opt/leiprova && LEIPROVA_SKIP_SEED=1 ./deploy/pull-deploy.sh'`
    (nunca rode o seed em produção).

## Pendências editoriais do corte (12/10/2026)

- **80 preparações abaixo do piso**, com déficit mínimo de 5.440 questões válidas.
  **70 sem edição oficial revisada** e **73 sem referência aprovada de prova anterior
  ou dispensa**. Descoberta, cargo/especialidade/edição, programa, fonte e produção
  precisam ser tratados por preparação. Ver `docs/PREPARACOES-INTEGRAIS-2026-10-11.md`.
- **Histórico e pré-edital:** suporte implementado, mas nenhuma oferta reclassificada.
  Conferir edição-base e modo explicitamente; usar legislação vigente e não anunciar
  treino atual como reprodução de prova antiga. Ver `docs/MODOS-DE-PREPARACAO.md`.
- **LGPD, Lei 12.737 e Lei 14.133:** continuam pendentes no corpus conforme a última
  conferência. Não suprir artigos por inferência; ler/revisar fonte oficial sem texto
  revogado antes de carga. Reconsultar os requisitos bloqueados; a estimativa anterior
  era cerca de 45.
- **PC-PR:** a prova foi em 11/10; não anunciar o edital como futura inscrição. O pedido
  de treino histórico exige modo/edição-base revisados e legislação vigente; tarefas
  antigas não devem ser declaradas prontas ou descartadas somente pela data.
- **Propostas antigas de vínculos do ENAM e 12 questões do piloto:** revisar a situação
  antes de nova ação. Proposta repetida não é nova questão publicada por produto.
- **Compra financeira de controle e estorno:** continuam sem homologação nesta rodada.
- **Migração/DNS:** corte concluído; domínio Google verificado e mudança de endereço
  confirmada. Sitemap enviado, com primeira leitura ainda em falha; acompanhar a
  leitura sem presumir indexação ou ranking.

## Registro histórico das pendências anteriores

O bloco abaixo é o diagnóstico anterior às rodadas desta noite, preservado para
comparação. TC-DF e ENAC já superaram as quantidades indicadas e estão liberados
com 69 e 70 válidas; as demais estimativas devem ser revalidadas.


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
