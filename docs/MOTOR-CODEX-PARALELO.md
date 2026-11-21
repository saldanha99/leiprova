# Motor editorial: instância Codex em paralelo (liga/desliga pelo orçamento da API)

Preparado em 20/11/2026. Decisão do proprietário em 21/11/2026: a instância Codex liga
**sozinha** quando o orçamento mensal da API da instância principal (US$ 50, ver
`docs/API-MOTOR-REALTIME-2026-11-19.md`) se esgota e **desliga** na renovação, na virada do
mês-calendário UTC. Codex é assinatura (ChatGPT), não API paga: OpenRouter e outros provedores
pagos continuam proibidos.

## O que é

- Segunda unidade systemd, `leiprova-editorial-codex.service`, rodando o MESMO
  `deploy/editorial-realtime-worker.mjs` com `EDITORIAL_EXECUTOR=codex`, modelo `gpt-6-luna`,
  0 vagas de Guardião e 2 de Autor (`deploy/systemd/editorial-codex.env.example`).
- Mesma fila `editorial_agent_work`. A reserva é atômica (`pg_advisory_xact_lock(621743,37)`
  + `for update skip locked`); duas instâncias nunca pegam a mesma tarefa.
- Estado próprio em `/var/lib/leiprova-codex`: heartbeat, eventos, recibos e `api-budget.json`
  separados. O vigia (`slot_stalled`) e a pausa por limite valem por instância.
- Sem chave da API: o worker só lê a chave no executor `claude`, e a unidade aponta
  `EDITORIAL_API_SECRET_FILE` para um caminho inexistente.
- Login próprio do Codex em `CODEX_HOME=/var/lib/leiprova-codex/codex-home` (em arquivo:
  `config.toml` com `cli_auth_credentials_store = "file"`, gravado pelo instalador), repassado só à CLI.
- Compartilhado com a instância principal:
  - `EDITORIAL_RELEASE_TRIGGER_FILE=/var/lib/leiprova-realtime/release.trigger`: a autoria do
    Codex dispara a mesma linha de liberação (o `.path` observa só esse arquivo);
  - `EDITORIAL_BRIDGE_LOCK_FILE=/var/lib/leiprova-realtime/bridge.lock`: `flock` entre as duas
    instâncias, para não rodar dois `tsx` (~200 MB cada) ao mesmo tempo no contêiner de 768 MB.

## Liga/desliga automático

- O worker principal grava `/var/lib/leiprova-realtime/codex-switch.signal` na partida e sempre
  que muda se o Codex deve rodar (esgotou a API do mês ou renovou). O `api-budget.json` muda a
  cada execução (milhares por dia) e por isso não é observado direto.
- `leiprova-codex-switch.path` observa a campainha; `leiprova-codex-switch.timer` confere na
  partida da VPS e a cada 10 min (rede de segurança: virada do mês com a principal parada,
  campainha perdida). Ambos disparam o oneshot `leiprova-codex-switch.service` (root), que roda
  `deploy/editorial-codex-switch.mjs`:
  - lê o `api-budget.json` da principal (só leitura) e confere se existe o `auth.json` do CODEX_HOME;
  - Codex deve rodar = `mode: "subscription"` no mês UTC corrente (esgotado ou sem chave);
    arquivo de mês anterior conta como API de volta;
  - deve rodar, parado e com login: `systemctl start --no-block leiprova-editorial-codex`;
  - não deve rodar e ativo: `systemctl stop --no-block` (parada graciosa, até 30 min);
  - sem login: não inicia nada (`codex_login_missing` no journal).
- A unidade Codex não tem `[Install]` (não é habilitada; quem decide é o liga/desliga) e tem
  `ConditionPathExists=/var/lib/leiprova-codex/codex-home/auth.json`: mesmo um `systemctl start`
  manual sem login é pulado pelo systemd (unidade inativa, não "failed", sem `Restart=`), então
  não há laço de reinício.

## Instalação (root na VPS, depois do deploy da revisão)

1. `bash /opt/leiprova/deploy/install-editorial-codex.sh`: instala a unidade Codex e o
   liga/desliga, grava o `config.toml` do login em arquivo e habilita
   `leiprova-codex-switch.path`/`.timer`. Não faz login nem inicia o Codex.
2. Copiar `EDITORIAL_FOCUS_PRODUCTS` de `/etc/leiprova/editorial-realtime.env` para
   `/etc/leiprova/editorial-codex.env`.
3. Trava compartilhada também na instância principal (reinício gracioso: espera as tarefas em
   curso, até 30 min):
   ```bash
   grep -q '^EDITORIAL_BRIDGE_LOCK_FILE=' /etc/leiprova/editorial-realtime.env || \
     echo 'EDITORIAL_BRIDGE_LOCK_FILE=/var/lib/leiprova-realtime/bridge.lock' >> /etc/leiprova/editorial-realtime.env
   systemctl restart leiprova-editorial-realtime
   ```
4. Login da assinatura (proprietário), com o CODEX_HOME da instância e como `leiprova-editor`:
   ```bash
   sudo -u leiprova-editor env CODEX_HOME=/var/lib/leiprova-codex/codex-home codex login --device-auth
   sudo -u leiprova-editor env CODEX_HOME=/var/lib/leiprova-codex/codex-home codex login status
   ls -l /var/lib/leiprova-codex/codex-home/auth.json
   ```
5. Conferir o modelo e o sandbox fora do serviço:
   ```bash
   cd /var/lib/leiprova-codex && sudo -u leiprova-editor env CODEX_HOME=/var/lib/leiprova-codex/codex-home \
     codex exec --sandbox workspace-write --skip-git-repo-check -C . -m gpt-6-luna - <<< "Responda apenas: OK"
   ```
   Se o nome do modelo não existir na conta, trocar `EDITORIAL_EXECUTOR_MODEL` em
   `/etc/leiprova/editorial-codex.env`.
6. Conferir a decisão na hora: `systemctl start leiprova-codex-switch.service && journalctl -u leiprova-codex-switch -n 5`.

## Acompanhar

```bash
journalctl -u leiprova-codex-switch -n 20      # {"action":"start"|"stop"|"none","reason":...}
systemctl status leiprova-editorial-codex
journalctl -fu leiprova-editorial-codex
tail -f /var/lib/leiprova-codex/events.jsonl      # probe_ok, claimed, prepared, via:"subscription"
cat /var/lib/leiprova-realtime/codex-switch.signal
```
No banco, as questões novas do Codex saem com `generator_model = 'gpt-6-luna'`.

## Desligar / reverter

- Desligar o automático e o Codex:
  `systemctl disable --now leiprova-codex-switch.path leiprova-codex-switch.timer && systemctl stop leiprova-editorial-codex`
  (reservas em curso expiram pelo lease).
- Remover tudo: `bash /opt/leiprova/deploy/install-editorial-codex.sh --uninstall`.
- A linha `EDITORIAL_BRIDGE_LOCK_FILE` na instância principal pode ficar: sozinha, ela só
  serializa as próprias chamadas, como a fila interna já faz.
