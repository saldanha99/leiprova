# Aceleração editorial — 12/10/2026

Decisão do proprietário: “deixe o mais rapido possivel”. Esta atualização
supera as cadências registradas anteriormente; não reduz critérios de fonte,
identidade, originalidade, formato ou liberação.

## Cadências efetivas

- Maestri, entradas existentes editadas no painel nativo: Guardião e Autor a
  cada **1 minuto**, Radar mantido em **5 minutos**. Habilitadas, repetição
  contínua, pular agente ocupado, sem notificação de rodadas vazias. IDs,
  conexões e comandos de pré-execução preservados; nenhum nó duplicado.
- VPS: preparação determinística de **20 para 5 minutos**; linha de liberação
  de **30 para 10 minutos**. Os dois arquivos de `/etc/cron.d/` foram conferidos
  contra seus modelos anteriores antes da troca. Locks `flock` preservados.
- Teto diário continua `null`; até três tentativas e reserva exclusiva continuam.

São reduções da espera de agendamento, não promessa de multiplicação da
velocidade de geração. A autoria depende de insumos elegíveis, Maestri aberto,
host disponível e saldo das assinaturas, sem fallback pago.

## Correção do despacho

A ponte agora informa o caminho e o comprimento de cada `articles[].text`.
O pacote reservado e seu hash permanecem imutáveis. Os prompts de Guardião e
Autor orientam a leitura integral, inclusive quando a ferramenta truncar, e
distinguem sugestões de recuperação (`exactCitation.pending`) do texto recebido.
Uma proposta de rascunho não exige aprovação prévia; artigo realmente
incompatível ou identidade insuficiente ainda resulta em `blocked`.

Reabertas exclusivamente `author:1100` e `author:657`, com comparação de hash,
estado bloqueado, ausência de reserva e tentativas preservadas. Auditorias
**10906 e 10907**, com resultado anterior conservado, `humanReview:false` e
`publicationAllowed:false`. Trabalhos superseded não foram reabertos;
contratos ausentes ou agregando cargos permanecem inelegíveis.

O Autor reservou `author:657` às **21:01:17 UTC**, entregou três inéditas e a
ponte as importou como rascunhos às **21:02:35 UTC**, sem falha. A reserva foi
`7c06d206-b49e-48d5-b840-48bbc7c54287`. Nova reserva ocorreu às 21:02:39 UTC.
O Guardião também recolheu e reservou tarefas nas rodadas de 20:58 e 21:01 UTC.
Isso comprova execução após a alteração, não publicação automática desses itens.

`author:1100` também entregou três rascunhos, recolhidos às 21:03:44 UTC.
Assim, as duas novas tentativas produziram **seis inéditas**. A linha de
liberação concluiu a primeira rodada manual com sucesso e a leitura de vínculos
válidos confirmou ENAC **78**, ENAM **146** e TC-DF **69**: **293 questões**,
três preparações disponíveis. Três inéditas do ENAC efetivamente publicadas;
o lote TC-DF chegou depois do início dessa rodada e aguarda a seguinte.

Rodada seguinte concluída às **21:06:32 UTC**: três inéditas TC-DF aprovadas,
três vínculos aprovados. Leitura posterior confirmou **TC-DF 72, ENAC 78 e
ENAM 146**, total **296 válidas em três preparações**. Portanto, as seis novas
inéditas foram efetivamente publicadas. PC-MA continua com zero. Recibos das
duas rodadas em `release-runs/20261012T210327Z.Qh9wJq` e
`release-runs/20261012T210516Z.nwjcyX`, sem marcador de falha. Fonte implantada
`8ac951d1`; modelos de cron comparados com os arquivos instalados, sem divergência.

## Validação técnica

Lint, geração de tipos, typecheck e build de produção passaram na VPS isolada.
A suíte geral aprovou 1.808 testes e oito falharam por ausência de Bash no
contêiner de QA. Após instalar Bash e Python apenas no contêiner descartável,
os dois arquivos afetados passaram (nove testes, um já aprovado anteriormente):
**1.816 testes aprovados no conjunto**, 295 opcionais de banco não executados.
Dois testes novos cobrem o despacho, preservação do pacote e escopo por papel.

Foram executados os binários correspondentes aos scripts de lint, typecheck,
test e build do `package.json`; o pnpm tentou reinstalar dependências ao detectar
o caminho temporário. O build foi feito em `/app` no contêiner descartável para
evitar o symlink externo recusado pelo Turbopack. Nenhuma correção funcional foi
necessária para resolver esses problemas de infraestrutura do QA.

Ponte usada localmente pelas rotinas; cron instalado na VPS. Não é necessário
recriar app ou worker, pois o código de execução do servidor não mudou.
`/api/health` respondeu `{"status":"ok"}` após a alteração.

## Evidências privadas e limites

Recibos locais em `.local/editorial/acceleration-20261012/` e eventos em
`.local/maestri/preflight-events.jsonl`. Na VPS, QA e backups dos dois crons em
`/opt/leiprova-qa-acceleration-20261012/`. Não incluir esses diretórios no Git.

Conferência durante a operação: 84 produtos, 80 draft, 67 sem oportunidade
vinculada. Três preparações com conteúdo válido; PC-MA continua fechado.
O monitor do Código Penal suspendeu a fonte às 20:47:33 UTC por captura oficial
indisponível/alterada ou divergência do corpus, sem prova de mudança legislativa.
Isso reduziu temporariamente em cinco a contagem válida do ENAC; não restaurar
a fonte ou questões sem nova verificação. A aceleração não contorna essa trava.
