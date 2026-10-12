# Verificação horária das fontes do Decreto 12.807

Estado em 12/10/2026: **instalado na VPS Everglades e primeira execução manual concluída às 07:35:49 UTC**, com saída 0 e auditoria **7177** (`editorial.legal_complementary_sources.verified`), IDs de fontes **1 e 2**, `humanReview:false`. A aprovação inicial foi registrada na auditoria **7176** após aplicar a migração 0053. **Primeiro disparo agendado conferido às08:17:15UTC**, saída0, auditoria **7188**, os mesmos dois IDs e `humanReview:false`; log real em `/var/log/leiprova-supplementary-monitor.log`. O cron gerenciado dispara aos17 minutos de cada hora. O monitor não aprova fontes pendentes, artigos, questões ou contratos do Autor.

## Por que uma execução separada

O serviço `legal-monitor` atual reconfere as fontes da biblioteca uma vez por dia, com `DATABASE_URL` do papel APP. Ele não observa automaticamente corpo, anexo e ficha do Decreto 12.807/2025. A verificação complementar precisa do papel de manutenção para renovar o lease ou suspender o par e gravar auditoria. Este wrapper usa a imagem existente `leiprova-opportunity-approver`, a conexão de manutenção já declarada nesse serviço e um override exclusivo para o run horário; não altera o laço diário, Compose principal, grants, contratos ou fila do Autor.

Arquivos de operação:

- `deploy/verify-procurement-supplementary-sources.sh`: uma execução delimitada de `scripts/verify-procurement-supplementary-sources.ts --apply`.
- `deploy/install-procurement-supplementary-monitor.sh`: prévia por padrão; instalação e remoção explícitas somente dos arquivos gerenciados abaixo.
- `deploy/procurement-monitor-common.sh`: guardas de destino, sem efeitos ao carregar.
- `deploy/docker-compose.supplementary-monitor.yml`: limite de 384 MB, CPU 0,35, 64 processos e heap Node de 256 MB; imagem existente, sem pull.

Ambos os comandos exigem Linux, root, diretório físico `/opt/leiprova`, endereço IPv4 local **179.236.255.4** e `.env` regular sem symlink, root:600. O operador confirmou esse IP em `eth0` por leitura em 12/10; o alias SSH não é usado como prova de identidade. Mac, origem antiga, cópia de homologação e IP parecido são recusados. Nenhum segredo é copiado, impresso, escrito no repositório ou avaliado por `source .env`: Compose lê o arquivo existente somente na VPS.

## Instalação pelo operador principal

Antes de instalar: publicar o código aprovado, conferir migração 0053/grants e os recibos reais de aprovação do corpo e anexo; construir a imagem `opportunity-approver` pelo fluxo normal na VPS. O instalador exige imagem existente e valida o Compose, mas **imagem existente não comprova que contenha o código mais recente**. O wrapper registra o digest usado; o operador deve conferir a revisão da imagem no deploy. Não há build, download de imagem ou alteração de feature flag no agendamento.

Na sessão da VPS Everglades, em `/opt/leiprova`:

```sh
./deploy/install-procurement-supplementary-monitor.sh --preview
./deploy/install-procurement-supplementary-monitor.sh --install
```

A instalação usa trava própria e arquivos temporários substituídos atomicamente. O caminho estável `/etc/cron.d/leiprova-supplementary-monitor` recebe exatamente uma linha, aos **17 minutos de cada hora**. Repetir a instalação substitui esse mesmo arquivo; não acrescenta linhas ao crontab. Outros agendamentos dessa CLI/wrapper em `/etc/crontab`, `/etc/cron.d` ou nos spools são recusados, inclusive uma instalação manual anterior. Comentários são ignorados. O serviço `cron` ou `crond` precisa estar ativo; o instalador não o habilita nem modifica rotinas de outros projetos.

O log `/var/log/leiprova-supplementary-monitor.log` é root:600. A configuração própria `/etc/logrotate.d/leiprova-supplementary-monitor` limita-o a quatro arquivos rotacionados, com limiar de 1 MB. A rotação depende do logrotate normal do sistema; não é outro daemon. Arquivos existentes sem o marcador gerenciado ou symlinks são recusados, não sobrescritos.

A instalação **não dispara** uma conferência. Depois de inspecionar o cron instalado, o operador pode executar uma única vez:

```sh
./deploy/verify-procurement-supplementary-sources.sh
```

Conferir no log o digest da imagem e o JSON com os **dois IDs numéricos de fontes**, `auditId`, `humanReview:false` e `mode`. Conferir a linha correspondente de `audit_logs` por consulta de leitura. Só esses recibos, com horário, comprovam execução efetiva; o arquivo cron não prova execução futura. Registrar a primeira execução e um disparo posterior do cron na documentação de operação. Não duplicar esse comando no laço do LegalMonitor enquanto o cron estiver instalado.

## Travas, falhas e limites

O wrapper usa `flock` em `/run/lock/leiprova-supplementary-monitor.lock` e nome fixo de contêiner `leiprova-supplementary-source-verifier`. Um segundo disparo sob a trava sai sem iniciar outro contêiner. Um contêiner já existente bloqueia o run, mesmo após perda da trava; o wrapper não remove um processo que encontrou antes de começar. O timeout de 240 segundos envia TERM e, após 15 segundos, KILL. No encerramento, tenta parar/remover somente o contêiner com a label exata `io.leiprova.supplementary-monitor=decree-12807-hourly-v1`. Outros contêineres e projetos ficam fora desse comando.

O verificador recaptura as três URLs exatas por TLS/robots regulares, compara hashes e provas ao par aprovado, exige seu recibo original e faz a transação curta delimitada já implementada:

- `verified`, IDs válidos e auditoria real: renova `last_verified_at` e registra `editorial.legal_complementary_sources.verified`; saída 0.
- Divergência ou impossibilidade de verificar: suspende o par com `editorial.legal_complementary_sources.suspended`. O wrapper exige recibo real e retorna **10**, sinalizando atenção. Falha de rede é classificada como dependência não verificada, sem alegar revogação jurídica.
- Ausência de par aprovado, recibo incompleto, JSON inválido ou resultado diferente: saída **11**; nenhuma renovação ou auditoria é presumida.
- Erro do processo, timeout, imagem/script ausente ou banco indisponível: código não zero; não inventa suspensão/auditoria que o banco não gravou. As fontes perdem elegibilidade pelo lease de seis horas se a manutenção parar. RLS e o consumidor validam esse lease, mas a integração com questões ainda é trabalho separado.

Uma suspensão não é reativada pelo cron. Exige reconciliação explícita e outra versão auditada pelo caminho apropriado. Um erro de transporte pode suspender fontes ainda juridicamente vigentes: isso é comportamento editorial deliberado de bloqueio, não uma declaração de revogação.

SIGKILL do host/cliente ou falha do Docker pode impedir o cleanup. Na próxima tentativa, o nome estável bloqueia sobreposição. O operador deve inspecionar estado, imagem e label antes de remover **somente esse contêiner**; depois repetir o wrapper e conferir recibo. Não assumir que o timeout sozinho encerrou o processo no servidor. O wrapper não promete alerta por e-mail/Slack nem autoria contínua; as saídas não zero e auditorias precisam da supervisão operacional já existente.

O modo `--remove` do instalador remove apenas cron/logrotate com marcador próprio; preserva log, fontes, auditorias e execução já em andamento:

```sh
./deploy/install-procurement-supplementary-monitor.sh --remove
```

Nenhuma instalação será feita na VPS antiga. A guarda de endereço recusa a origem mesmo se o script for copiado para lá; não há cron ou daemon local no Mac. Quando houver outra migração, a guarda e a instalação devem ser revistas explicitamente, depois de parar a rotina no destino anterior.

## O que continua pendente

Este agendamento só mantém ou suspende as fontes complementares com IDs próprios. Os nove artigos pendentes da Lei 14.133 continuam pendentes. Autor, certificação, publicação e acesso às questões monetárias devem consumir e revalidar os IDs, hashes, estado e lease atuais; esses consumidores **não foram alterados nesta entrega**. Não liberar os artigos ou afirmar que as preparações estão prontas pela mera instalação do monitor.

Validação local delimitada: syntax check Bash e testes de guardas, duplicidade, agenda única, comandos/limites e recibos. Nenhum teste local toca Docker real, banco, cron, rede oficial ou arquivos de sistema. A QA final de Compose/Linux e o primeiro recibo auditado cabem ao operador principal na VPS.
