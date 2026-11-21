# API paga no motor realtime — 19/11/2026

Decisão do proprietário em 19/11/2026 (~19h25 BRT), repassada pelo Chefe de Gabinete:
o motor contínuo (`deploy/editorial-realtime-worker.mjs`, serviço
`leiprova-editorial-realtime`) pode usar a API oficial da Anthropic com
`claude-haiku-5-5`, pela mesma CLI do Claude Code. Motivo: o limite de 5 h da
assinatura pausava o motor 44–48 vezes por dia (14–16/11/2026).

Atualização do proprietário em 21/11/2026: parada em 100% (US$ 50) e **renovação mensal
automática** na virada do mês-calendário UTC; com a API esgotada, a instância Codex
(`docs/MOTOR-CODEX-PARALELO.md`) liga sozinha e desliga na renovação. Substitui a regra
anterior de parada em US$ 48 sem renovação.

## Limites

- **Teto: US$ 50 por mês-calendário UTC. Parada em US$ 50 (100%).** Sem recarga dentro do mês.
- Renovação: o limite de gasto da Anthropic é mensal e recomeça às 00:00 UTC do dia 1º.
  Fonte (consultada em 21/11/2026): <https://platform.claude.com/docs/en/api/rate-limits>
  (redirecionada de docs.anthropic.com/en/api/rate-limits), seção "Spend limits": "The cap is
  the maximum your organization can spend on the API each calendar month." e "Once you reach
  your tier's spend cap, API usage pauses until 00:00 UTC on the first day of the next month".
  O motor usa o mesmo relógio: mês UTC (`new Date().toISOString().slice(0, 7)`), ou seja,
  a virada acontece às 21h do último dia do mês em Brasília.
- Somente Anthropic, com o modelo e o executor atuais. OpenRouter ou outro provedor
  pago continua proibido. O piloto de R$ 30 de 13/10 não muda.
- A chave fica em `/etc/leiprova/editorial-realtime.secret` (`root:leiprova-editor`,
  640), fora do repositório e da imagem. É compartilhada com outro projeto: nunca
  imprimir, registrar, copiar ou commitar.
- Material privado (`.local/editorial`) não vai a provedores. A CLI continua sem
  shell e sem rede de ferramentas; só lê o pacote reservado.
- Nenhum gate muda: `prepared` continua proposta; a linha de liberação revalida tudo.

## Como funciona

- O worker lê a chave uma vez e a repassa **somente** ao ambiente da CLI, e só
  enquanto `gasto do mês + reservas em andamento + reserva da nova execução < US$ 50`.
  Cada execução em andamento reserva `EDITORIAL_API_RUN_RESERVE_USD` (padrão 0,25): com
  8 vagas, até US$ 2 ficam reservados e o total não passa de US$ 50 enquanto cada execução
  custar até a reserva (média real em 21/11/2026: ~US$ 0,013 por execução).
- A CLI roda com `--output-format json`; o `total_cost_usd` de cada execução é
  somado em `/var/lib/leiprova-realtime/api-budget.json`, gravado de forma atômica (em série):
  `{capUsd, stopAtUsd, month, spentUsd, runs, unmeteredRuns, byRole, mode, exhaustedAt, renewedAt, updatedAt, history}`.
  Execução sem custo informado (timeout, falha) é cobrada pela reserva. Funções puras em
  `deploy/editorial-budget.mjs`.
- Esgotado = já não cabe nem uma reserva antes de US$ 50 (gasto ≥ 49,75 com a reserva padrão):
  `exhaustedAt`, `mode: "subscription"` e evento `api_budget_exhausted`. O motor segue pela
  assinatura (Haiku) até o fim do mês; reiniciar não reabre a API (o arquivo é relido na partida).
- Virada do mês UTC (conferida a cada execução e a cada minuto, e na partida): o mês encerrado
  vai para `history` (`{month, spentUsd, runs, unmeteredRuns, byRole, exhaustedAt, closedAt}`,
  últimos 24 meses), o gasto volta a 0, `exhaustedAt` some, `mode` volta a `"api"` (havendo
  chave) e o evento `api_budget_renewed` é gravado. Execução que atravessa a virada é cobrada
  no mês novo.
- Migração: arquivo sem `month` (formato de 19/11/2026) vale como o mês UTC corrente. Os valores
  `capUsd`/`stopAtUsd` vêm sempre da configuração (padrão 50/50; `EDITORIAL_API_CAP_USD`,
  `EDITORIAL_API_STOP_USD`), não do arquivo. Se o mês foi esgotado pela parada antiga (48) e a
  parada configurada subiu, a API reabre só até a nova parada.
- Campainha da instância Codex: o worker principal regrava
  `/var/lib/leiprova-realtime/codex-switch.signal` só quando muda se o Codex deve rodar
  (esgotou ou renovou); `leiprova-codex-switch.path` reage a ela.
- Em modo API, 429/limite de taxa pausa só a vaga por
  `EDITORIAL_API_RATE_PAUSE_SECONDS` (padrão 120 s), sem o cooldown de 30 min da assinatura.
- O aviso ao proprietário (80% e esgotado) é feito pela rotina do Chefe de Gabinete,
  que lê o `api-budget.json`. O motor não envia mensagens. Com a renovação, os avisos passam a
  ser por mês (`month`); o mês anterior fica em `history`.

## Retorno

- Encerrar a API só no mês corrente: gravar `exhaustedAt` no `api-budget.json` e reiniciar o
  serviço. Na virada do mês a API volta sozinha.
- Encerrar a API de vez: remover a chave do `.secret` e reiniciar o serviço. O motor segue pela
  assinatura; sem chave o modo fica `"subscription"` em todos os meses (e a instância Codex,
  se instalada e com login, segue ligada).
