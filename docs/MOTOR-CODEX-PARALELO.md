# Motor editorial: instância Codex em paralelo (preparada, desligada)

Preparado em 20/11/2026. **Nada disto está ativo.** Ligar só com o OK do proprietário,
de preferência quando o `api-budget.json` da instância principal chegar à parada de US$ 48.

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
- Login próprio do Codex em `CODEX_HOME=/var/lib/leiprova-codex/codex-home`, repassado só à CLI.
- Compartilhado com a instância principal:
  - `EDITORIAL_RELEASE_TRIGGER_FILE=/var/lib/leiprova-realtime/release.trigger`: a autoria do
    Codex dispara a mesma linha de liberação (o `.path` observa só esse arquivo);
  - `EDITORIAL_BRIDGE_LOCK_FILE=/var/lib/leiprova-realtime/bridge.lock`: `flock` entre as duas
    instâncias, para não rodar dois `tsx` (~200 MB cada) ao mesmo tempo no contêiner de 768 MB.

## Ativação (proprietário, como root na VPS)

1. Publicar a revisão que contém este documento pelo processo normal de deploy.
2. Instalar desligado: `bash /opt/leiprova/deploy/install-editorial-codex.sh`.
3. Login da assinatura com o CODEX_HOME da instância. Em 20/11/2026, `/root/.codex` respondia
   `codex login status: Not logged in` e não tinha `auth.json`: não há login para copiar.
   ```bash
   sudo -u leiprova-editor env CODEX_HOME=/var/lib/leiprova-codex/codex-home codex login --device-auth
   sudo -u leiprova-editor env CODEX_HOME=/var/lib/leiprova-codex/codex-home codex login status
   ```
4. Conferir o modelo e o sandbox fora do serviço:
   ```bash
   cd /var/lib/leiprova-codex && sudo -u leiprova-editor env CODEX_HOME=/var/lib/leiprova-codex/codex-home \
     codex exec --sandbox workspace-write --skip-git-repo-check -C . -m gpt-6-luna - <<< "Responda apenas: OK"
   ```
   Se o nome do modelo não existir na conta, trocar `EDITORIAL_EXECUTOR_MODEL` em
   `/etc/leiprova/editorial-codex.env`.
5. Copiar `EDITORIAL_FOCUS_PRODUCTS` de `/etc/leiprova/editorial-realtime.env` para
   `/etc/leiprova/editorial-codex.env`.
6. Ligar a trava compartilhada também na instância principal (o reinício é gracioso: espera as
   tarefas em curso, até 30 min):
   ```bash
   echo 'EDITORIAL_BRIDGE_LOCK_FILE=/var/lib/leiprova-realtime/bridge.lock' >> /etc/leiprova/editorial-realtime.env
   systemctl restart leiprova-editorial-realtime
   ```
7. Ligar: `systemctl enable --now leiprova-editorial-codex`.
8. Acompanhar:
   ```bash
   journalctl -fu leiprova-editorial-codex
   tail -f /var/lib/leiprova-codex/events.jsonl      # probe_ok, claimed, prepared, via:"subscription"
   cat /var/lib/leiprova-codex/heartbeat.json
   ```
   No banco, as questões novas do Codex saem com `generator_model = 'gpt-6-luna'`.

## Desligar / reverter

- Parar: `systemctl disable --now leiprova-editorial-codex` (reservas em curso expiram pelo lease).
- Remover: `bash /opt/leiprova/deploy/install-editorial-codex.sh --uninstall`.
- A linha `EDITORIAL_BRIDGE_LOCK_FILE` na instância principal pode ficar: sozinha, ela só
  serializa as próprias chamadas, como a fila interna já faz.
