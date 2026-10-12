# Fila editorial sem teto diário — 12/10/2026

Decisão explícita do proprietário: “abra mais vagas, vamos fazer sem parar,
deixe sem limite de tarefas, faça tudo”. Supera o teto anterior de 48 reservas
por 24 horas. Não altera acesso a fontes, licenças, formato das provas ou gates
de publicação. `prepared` continua sendo proposta, não aprovação.

## Implementação

- `AGENT_WORK_DAILY_LIMIT = null`, serializável em JSON; número de reservas
  nas últimas 24 horas preservado para acompanhamento.
- Reserva atômica e exclusiva, até três tentativas, lease de 90 minutos.
- Prioridade dos produtos ainda fechados preservada dentro do papel do agente.
  Uma tarefa de mapeamento do Guardião não impede o Autor de trabalhar.
- Painel de motores informa ausência de teto diário e marca atual.
- Abertura progressiva a cada 30 minutos e preparação a cada 20 minutos
  continuam. Execução de IA depende do Maestri e da assinatura disponível.

## Validação e implantação

Validação em `/opt/leiprova-qa-unlimited-20261012`: lint e tipos aprovados,
1.814 testes gerais aprovados (295 opcionais sem banco), 26 testes PostgreSQL
aprovados em banco sintético novo e isolado, build de produção concluído.
Inclui 50 reservas em 24 horas, as duas últimas concorrentes sem duplicação,
e Autor trabalhando apesar de mapeamento pendente de outro produto.

Implantado código `dd711733` em `/opt/leiprova` (`everglades-vps`). Apenas app
e worker editorial recompilados/recriados, sem seed ou migração de banco.
App saudável, worker em execução e ambos sem reinícios; `/api/health` retornou
`{"status":"ok"}` às 19:10 UTC. Backup validado por `pg_restore --list` em
`/opt/leiprova/backups/unlimited-20261012/database.dump`, SHA-256
`6da1b22e29309fce78a38f92a42365c137c297ce8efa125737a5c2e5dfa7ca12`.
Imagens anteriores preservadas com tag `before-unlimited-20261012` para retorno.

A contagem real chegou a **50 reservas/24h, limite null**. Rotinas existentes
reservaram `discovery:fcc:2026-10-12` às 19:05:33 UTC, `mapping:1111` às
19:06:34 e `author:653` às 19:08:04. As três respostas foram recolhidas pela
ponte, uma por papel, zero falhas. Autor entregou quatro inéditas do ENAC,
inicialmente importadas como rascunhos; não confundir geração com publicação.

O ajuste proposto de 20 para 5 minutos **não foi aplicado**. A sessão do nó
rotulado Maestro LeiProva foi reconhecida pela CLI como Autor; `routine list`
retornou `This terminal is not the Maestro`. Nenhuma identidade/permissão foi
forjada. Recibo privado `.local/maestri/unlimited-routines-20261012.md`.
As rotinas existentes continuaram funcionando, como comprovam os horários acima.

Logs da implantação: `deploy-build.log`, `deploy-up.log`, `checks.log`,
`postgres.log` e `build.log` em `/opt/leiprova-qa-unlimited-20261012`.
Banco sintético criado para estes testes foi parado após validação.

## Publicação dos primeiros resultados

Linha automática concluída às **19:12:36 UTC (16:12:36 BRT)**. Quatro inéditas
aprovadas e quatro vínculos atuais aprovados para o ENAC; leitura posterior pelo
predicado de conteúdo válido confirmou **ENAC 74, ENAM 146 e TC-DF 69**, total
**289 questões válidas em três preparações**. Os 80 produtos draft foram
avaliados e conservaram seus bloqueios. PC-MA continua com zero questões válidas
e acesso fechado. Recibo privado da rodada concluída:
`/opt/leiprova/.local/editorial/release-runs/20261012T191141Z.lBB0VW`.

A primeira chamada manual usou `sh` por engano no script Bash: aprovou as quatro
inéditas, mas parou na sintaxe de process substitution. Reexecutado pelo próprio
shebang; importação e revisão idempotentes concluíram sem duplicar conteúdo.
O cron existente usa o executável e não foi afetado por esse erro da chamada.
