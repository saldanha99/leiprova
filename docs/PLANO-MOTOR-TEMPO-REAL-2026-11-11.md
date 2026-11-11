# Plano — motor editorial em tempo real e abertura até 30/11/2026

Pedido do proprietário em 11/11/2026: abrir o projeto até o fim do mês, com um
motor em tempo real para as preparações das inéditas, e terminar hoje as
preparações que faltam. Este documento é um **plano**. Ele não comprova execução,
não altera gates, flags comerciais ou Stripe e não autoriza API paga.

## Ponto de partida (último recibo real: 05/11/2026)

- **12 de 84** preparações elegíveis, 2.146 questões válidas somadas nos produtos.
  PC-MA fechado pelo gate de fase/data. Nenhuma publicação nova em 05/11.
- A autoria depende do Maestri no desktop (Radar, Guardião e Autor). Em 05/11 os
  processos caíram, houve timeout na interface e `agent_dispatch_locked`. Este é
  o gargalo da autoria: cron de 5–10 min na VPS não gera questão sem agente vivo.
- A falta de questões não é o único bloqueio. Na última contagem por motivo
  (12/10), entre os drafts: 67 sem edição revisada, 71 sem prova anterior ou
  dispensa e 3 com fase/data incompatível. Questões resolvem só o piso de 68.
- Esta máquina Windows não alcança `everglades-vps`. A contagem atual por motivo
  precisa ser lida na VPS (passo 1) antes de qualquer promessa de data.

**Conclusão honesta:** não é possível liberar as 72 preparações restantes hoje.
Elas dependem de admissão de edital e prova anterior com fonte oficial, que
nenhum motor pode pular. Hoje dá para deixar o motor em tempo real rodando e
destravar os lotes que já têm fonte. O resto abre progressivamente até 30/11,
conforme cada produto passar nos gates.

## O que muda: de cron + desktop para worker contínuo na VPS

Hoje: Maestri (desktop) reserva → agente escreve `response.json` → ponte importa
rascunho → cron de 10 min aprova/vincula/libera. Cada elo espera o próximo tick
e para quando o desktop cai.

Proposta, sem mudar contratos nem gates:

1. **`editorial-realtime-worker`** (serviço systemd na VPS, fora do app). Laço
   contínuo por papel (Guardião, Autor), usando a mesma reserva atômica de
   `editorial_agent_work`: lease de 90 min, até 3 tentativas e reserva exclusiva.
   N reservas simultâneas por papel, configuráveis. Sem teto diário, como já decidido.
2. **Executor plugável.** O worker entrega o pacote reservado (hash imutável) a um
   executor e recebe o mesmo `response.json`. A validação da ponte continua igual:
   citação literal, `articleId` dentro do insumo, data/vigência/fonte e similaridade.
   Duas opções; a escolha é do proprietário (ver "Decisão necessária").
3. **Gatilho por evento.** Cada importação válida chama
   `editorial-release-chain.sh` com o `flock` existente, em vez de esperar o cron.
   O cron de 10 min continua como rede de segurança. Assim, a liberação ocorre
   minutos após o 68º vínculo válido do produto.
4. **Prioridade por distância do piso.** A fila de autoria passa a preferir
   produtos que já têm edição, prova anterior e formato admitidos e estão mais
   perto de 68. Isso evita gastar autoria em produtos que continuariam fechados
   por fonte.
5. **Observabilidade.** O worker grava um recibo por tarefa
   (`.local/editorial/realtime-runs/`) e um heartbeat. `/admin/motores` mostra
   vazão/hora, recusas por motivo e o produto mais próximo da abertura.
   O relatório do proprietário passa a ser horário.

Maestri continua válido como executor alternativo e para o Maestro central.
Os dois podem rodar juntos: a reserva atômica no banco impede que a mesma tarefa
vá para ambos. Não há nós novos no canvas.

## Decisão tomada (11/11/2026): assinatura via CLI na VPS

O proprietário escolheu a opção A. Não há API paga nem fallback pago: quando a
assinatura atinge o limite, o papel pausa (padrão de 30 min) e retoma sozinho.

### Implementação

- `deploy/editorial-realtime-worker.mjs`: Node puro, sem dependências, roda no
  host. Laço por vaga (Guardião 1, Autor 2, configuráveis). Faz a reserva por
  `docker exec leiprova-editorial-automation ... editorial-agent-work.ts --mode=claim`,
  grava `packet.json`, `CONTRATO.md` e `AGENTS.md` numa pasta privada da tarefa
  e chama a CLI com o prompt do despacho. Depois devolve o `response.json` por
  `--mode=complete`. O servidor revalida tudo e importa somente como rascunho.
- Executor `claude` (Claude Code `-p`, só Read/Write/Edit, sem Bash nem rede) ou
  `codex` (`codex exec --sandbox workspace-write`, sem rede). A CLI recebe só
  PATH/HOME. O banco e o `.env` não chegam a ela.
- Timeout por tarefa de 25 min, abaixo do lease de 90. A CLI pode ser repetida
  uma vez se faltar `response.json` ou se o contrato recusar a entrega. Sem entrega
  válida, a reserva expira pelo lease e conta como tentativa.
- Radar continua no Maestri, porque precisa navegar em fontes oficiais.
- `--mode=claim` agora devolve também `handoff`, a mesma instrução de
  `agentTaskHandoff` que a ponte do Maestri usa. A ponte ignora o campo extra.
- Gatilho por evento: com rascunhos importados, o worker grava
  `release.trigger`; `leiprova-release-trigger.path` (root) roda
  `editorial-release-chain.sh`, que já tem `flock -n`. O cron de 10 min continua.
- A prioridade da reserva continua a existente (conteúdo válido por produto,
  prazo e tier). O passo 1 pode pedir ajuste, se os grupos mostrarem desperdício.
- Recibos: `/var/lib/leiprova-realtime/events.jsonl`, `heartbeat.json` e
  `runs/<papel>/<lease>/` (pacote, logs da CLI, resposta, recibo).

### Instalação na VPS (depois do deploy desta revisão)

```bash
cd /opt/leiprova && sudo deploy/install-editorial-realtime.sh
sudo -iu leiprova-editor          # instalar a CLI e fazer o login da assinatura
sudoedit /etc/leiprova/editorial-realtime.env
sudo -u leiprova-editor env EDITORIAL_REALTIME_ONCE=1 EDITORIAL_REALTIME_STATE_DIR=/var/lib/leiprova-realtime \
  node /opt/leiprova/deploy/editorial-realtime-worker.mjs   # uma tarefa por vaga, assistida
sudo systemctl start leiprova-editorial-realtime && journalctl -fu leiprova-editorial-realtime
```

A imagem `editorial-automation` precisa ser reconstruída no deploy por causa
do `handoff`. O usuário `leiprova-editor` fica no grupo `docker`, o que
equivale a root no host: é o mesmo acesso que a ponte por SSH já usa. Antes de
ligar, confirmar que os termos do plano da assinatura permitem uso automatizado
em servidor. O worker não controla isso.

Retorno: `sudo deploy/install-editorial-realtime.sh --uninstall`.

## Opções avaliadas

| | A — assinatura (CLI headless na VPS) | B — API paga (OpenRouter) |
|---|---|---|
| Custo | sem custo por chamada; limitado pelo plano/assinatura | piloto 13/10: 100 rascunhos por US$ 0,22; 45% passaram nas checagens |
| Vazão | limitada pela cota da assinatura | escala com orçamento |
| Autorização | precisa confirmar que os termos do plano permitem uso automatizado em servidor | **exige novo teto expresso**; o piloto de R$ 30 não é operação contínua |
| Estimativa grosseira para ~4.900 questões (72 × 68, sem reaproveitamento) | depende da cota | ~11 mil rascunhos, ~US$ 25 pelo custo do piloto; reservar teto com folga |

Os números de B vêm do piloto e **não** medem o custo por questão publicada.
Reaproveitar uma inédita em vários produtos com o mesmo programa reduz bastante o
total; a meta real sai do passo 1.

## Trilha paralela obrigatória: fontes e provas anteriores

Sem esta trilha, o motor de autoria apenas acumula questões em produtos fechados.

- Admitir em lote, por receita (como o lote FGV de 29/10), as edições e provas
  anteriores com fonte oficial acessível. Usar os operadores existentes:
  `opportunities:approve`, `editorial:notices:approve` e os
  `register-*-previous-exam-links`, com `owner_standing_authorization` e
  `humanReview:false`.
- Fonte bloqueada, identidade incerta ou ausência de direitos impedem a liberação.
  Esses produtos ficam listados como "não abre neste mês" e saem da prioridade de autoria.
- `commerce:previous-exam:waive` somente nos casos em que a dispensa já é válida
  pelas regras atuais; nunca para acelerar.

## Cronograma

**Hoje, 11/11**

1. Na VPS, ler o relatório (`deploy/editorial-owner-report.sh`) e a avaliação de
   drafts para obter cada produto e seus bloqueios atuais. Classificar em três grupos:
   *só falta questão*, *falta fonte admissível* e *não abre este mês*.
2. ~~Proprietário escolhe o executor~~: A, assinatura (feito).
3. ~~Implementar worker e gatilho~~ (feito, em `tests/editorial-realtime-worker.test.ts`).
   Os 2 testes ponta a ponta usam bash e só rodam em Linux: executá-los no QA da VPS.
4. Fazer backup validado (`pg_restore --list`), deploy, instalar o serviço e rodar
   uma tarefa assistida por papel. Conferir os recibos.
5. Deixar o worker rodando e começar a admissão em lote dos produtos do grupo *falta fonte*.

**12–25/11:** vazão contínua; relatório horário; admissões em lote. Toda manhã,
o Maestro central confere as aprovadas e suspende erros. Produtos abrem sozinhos
ao cumprir os gates.

**26–30/11:** congelar a lista do que abre no mês, revisar páginas e acesso de cada
produto aberto e anunciar só as ofertas efetivamente disponíveis.

## Retorno

Parar e desabilitar o serviço `editorial-realtime-worker`; reservas pendentes
expiram pelo lease. Cron e Maestri continuam como hoje. Nenhuma aprovação é
revertida por update direto no banco.

## Acesso Master de teste do proprietário

`scripts/grant-owner-test-master.ts` (`pnpm access:master:test`) cria uma
conta de **aluno** (papel `student`), ou usa uma existente, e concede Master
por assinatura `manual`, com fim finito (padrão 30 dias, máx. 90). Não toca
Stripe nem flags, não rebaixa conta admin/editor e não sobrepõe assinatura
Stripe vigente. Grava auditoria `access.owner_test_master_granted`.
Master vê o mesmo conteúdo de um assinante real: questões `reviewed` com direitos
de estudo. A conta entra na contagem de "com acesso" do painel admin.

Uso na VPS, depois do deploy deste commit (a imagem de ferramentas precisa
conter o script). A senha é digitada no terminal e não fica em histórico:

```bash
cd /opt/leiprova
read -rsp 'Senha (16+): ' MASTER_TEST_PASSWORD; echo; export MASTER_TEST_PASSWORD
docker compose --profile tools run --rm --no-deps -T \
  -e MASTER_TEST_EMAIL='seu+aluno@dominio' -e MASTER_TEST_PASSWORD \
  opportunity-approver sh -ec \
  'export DATABASE_URL="$MIGRATION_DATABASE_URL"; exec ./node_modules/.bin/tsx scripts/grant-owner-test-master.ts'
unset MASTER_TEST_PASSWORD
```

Revogar: repetir com `-e MASTER_TEST_REVOKE=1`, sem a senha. Renovar o prazo:
repetir sem senha (mantém a senha atual).
