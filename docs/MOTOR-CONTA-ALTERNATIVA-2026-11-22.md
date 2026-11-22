# Motor editorial na assinatura Claude do Gabriel — 22/11/2026

Decisão do Vinícius em 22/11/2026, repassada pelo Chefe de Gabinete: "volte a produzir com o Claude
atual, no modelo haiku", usando a assinatura Claude do Gabriel que já está no provedor do OpenBot
(conta `a73a79da83275d8fb`). Motivo: a verba da API estava em US$ 49,75 de 50 e a assinatura própria do
`leiprova-editor` (Pro) bateu o limite semanal até 24/11/2026 16h UTC. Proibido: API paga da Anthropic,
OpenRouter e a verba da API do Lei Prova.

## Como funciona

- Modelo: `claude-haiku-5-5` (já era o de `/etc/leiprova/editorial-realtime.env`).
- O worker lê `EDITORIAL_OAUTH_TOKEN_FILE` (`/etc/leiprova/editorial-oauth.secret`, `root:leiprova-editor` 640)
  **a cada execução** e passa `CLAUDE_CODE_OAUTH_TOKEN` só ao ambiente da CLI, no caminho da assinatura.
  No caminho da API o token não vai. Sem arquivo, token inválido ou vencido: a CLI usa o login do HOME.
- O arquivo tem só o token de **acesso** (vida de ~8 h) e o vencimento; o token de renovação nunca sai do
  OpenBot. Copiar o login inteiro faria a VPS e o OpenBot disputarem a renovação e derrubaria a conta
  nos agentes.
- Quem regrava o arquivo é o OpenBot: `/data/OpenBot/Shared/ferramentas/leiprova-token-gabriel.sh push`
  (rotina de hora em hora do Dev Next.js). Perto do vencimento, o script faz uma chamada mínima da CLI na
  conta para ela renovar. `... status` mostra os minutos restantes no OpenBot e na VPS.

## Voltar à conta própria (24/11/2026 16h UTC ou quando o Vinícius quiser)

1. Pausar a rotina "Lei Prova: token Claude do Gabriel" no OpenBot.
2. Na VPS: remover a linha `EDITORIAL_OAUTH_TOKEN_FILE` de `/etc/leiprova/editorial-realtime.env`,
   apagar `/etc/leiprova/editorial-oauth.secret` e `systemctl restart leiprova-editorial-realtime`.
   (Basta apagar o arquivo para a próxima execução voltar ao login do HOME, sem reinício.)
3. Modelo anterior: o mesmo `claude-haiku-5-5`; nada a trocar.
