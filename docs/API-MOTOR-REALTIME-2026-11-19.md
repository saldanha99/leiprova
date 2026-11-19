# API paga no motor realtime — 19/11/2026

Decisão do proprietário em 19/11/2026 (~19h25 BRT), repassada pelo Chefe de Gabinete:
o motor contínuo (`deploy/editorial-realtime-worker.mjs`, serviço
`leiprova-editorial-realtime`) pode usar a API oficial da Anthropic com
`claude-haiku-5-5`, pela mesma CLI do Claude Code. Motivo: o limite de 5 h da
assinatura pausava o motor 44–48 vezes por dia (14–16/11/2026).

## Limites

- **Teto total: US$ 50. Parada preventiva: US$ 48.** Sem renovação ou recarga.
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
  enquanto `gasto + reservas em andamento + reserva da nova execução < US$ 48`.
  Cada execução em andamento reserva `EDITORIAL_API_RUN_RESERVE_USD` (padrão 0,25).
- A CLI roda com `--output-format json`; o `total_cost_usd` de cada execução é
  somado em `/var/lib/leiprova-realtime/api-budget.json`, gravado de forma atômica:
  `{capUsd, stopAtUsd, spentUsd, runs, unmeteredRuns, byRole, mode, exhaustedAt, updatedAt}`.
  Execução sem custo informado (timeout, falha) é cobrada pela reserva.
- Ao atingir US$ 48: `exhaustedAt`, `mode: "subscription"` e evento
  `api_budget_exhausted`. O motor segue pela assinatura e **nunca volta à API
  sozinho**, nem após reinício (o arquivo é relido na partida).
- Em modo API, 429/limite de taxa pausa só a vaga por
  `EDITORIAL_API_RATE_PAUSE_SECONDS` (padrão 120 s), sem o cooldown de 30 min da assinatura.
- O aviso ao proprietário (80% e esgotado) é feito pela rotina do Chefe de Gabinete,
  que lê o `api-budget.json`. O motor não envia mensagens.

## Retorno

Para encerrar o uso da API antes do teto: remover a chave do `.secret` (ou gravar
`exhaustedAt` no `api-budget.json`) e reiniciar o serviço. O motor segue pela
assinatura.
