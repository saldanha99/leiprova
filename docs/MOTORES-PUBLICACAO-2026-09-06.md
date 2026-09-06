# Motores editoriais — publicação e limites verificados

Verificação de 06/09/2026, aproximadamente 17h43 BRT. Stripe permanece pausada.

## Atualização final de infraestrutura — 20h03 BRT

Aplicação e worker editorial reconstruídos e publicados em `798c404`, iniciados
às 23:00:51 UTC. Saúde pública `ok`; 346 questões e 75 produtos preservados em
contagem. Sem migração, seed, alteração de credenciais, flags ou outros serviços.
Homologação, monitor de normas e entrega comercial não foram recriados.

- Imagem app: `sha256:d64dfea5a6d4ab016891ad882db94ae448b7a02dcd7056fcc58f4d997390b7df`.
- Imagem coletor: `sha256:5e88909c3f6fb58794ef3234c157f7a71a0350a40a80234e24bc41864e5429fe`.
- Backup validado: `/opt/leiprova/backups/leiprova-before-fetch-20260906T2258Z.dump`,
  10.475.077 bytes; imagens anteriores com tag `rollback-fetch-20260906`.
- Lint, typecheck, build e 1.313 testes passaram; 230 opcionais pulados.

Ciclo concluído às 23:03:12 UTC: cinco fontes verificadas, cinco candidatos,
quatro tentativas, três documentos inalterados, zero capturas novas, quatro
falhas (antes eram cinco) e uma suspensão por política. Sem novos requisitos,
rascunhos determinísticos ou tarefas duplicadas. As falhas atuais são:

| Fonte | Resultado comprovado |
| --- | --- |
| Prefeitura de Manaus | `discovery_size_limit`: página acima de 2 MB; limite mantido |
| SSP-BA | `document_not_eligible`: relatório de gestão não é edital elegível |
| CNJ / ENAC | `official_http_403`: acesso negado; antes houve 503 |
| ENFAM / ENAM | `official_http_404`: um documento ausente |
| FCC | `robots_path_disallowed`, contabilizada separadamente como suspensão |

O ciclo ainda retorna erro para tornar as quatro falhas visíveis. Não declarar
coleta nacional saudável ou bloqueios externos resolvidos.

Maestri: três análises normativas terminaram bloqueadas por falta de versões
comparáveis; a primeira teve confirmação manual e replay idempotente, as duas
seguintes salvaram respostas dentro das pastas dos próprios papéis, sem ampliar
permissões. O preflight recolheu as respostas e avançou a fila. `mapping:1` foi
aceita como proposta com um artigo e gerou automaticamente `author:1`, entregue
ao Autor. Isso não aprovou requisito ou publicação. O teste acionou as rotinas
manualmente, exercitando o mesmo preflight e comando do agendamento de 20 minutos.

O Mac voltou a bloquear o controle visual antes da conferência final do Autor.
Rotinas/configuração permanecem salvas; o acompanhamento usa recibos privados e
`/admin/motores`. Apesar do bloqueio visual, o Autor concluiu `author:1`: cinco
questões. O integrador acionou `--mode=settle --agent=Autor` (a mesma operação
do preflight); recibo confirmou `prepared`, cinco IDs importados,
`publicationAllowed: false` e `humanReviewRequired: true`. No banco, as cinco
estão como `draft`, assistidas por IA, sem revisor ou atestado humano; cinco
vínculos apontam exclusivamente para a oportunidade do pacote. Total passou
de 346 para **351 questões**: 312 revisadas, 12 pendentes e 27 rascunhos.
75 produtos preservados. Isso não satisfaz o piso de 68 válidas por produto.

Ficou demonstrado um percurso real até rascunho: reserva do requisito → resposta
do Guardião → recolhimento pelo preflight → trabalho do Autor → resposta local
→ validação e importação pela ponte. Não foi demonstrada publicação automática,
nem se pretende dispensar revisão humana. O último recolhimento foi manual pelo
integrador, pois a próxima rodada periódica ainda não havia ocorrido.

Os registros abaixo são históricos das etapas anteriores desta mesma entrega.

## Publicado

- `46adce0`: fila durável, contratos de Radar/Guardião/Autor, painel
  `/admin/motores`, revisão conservadora por citação, importação de rascunhos e
  bloqueios de contexto com privilégios mínimos. Aplicação e monitor de normas
  foram construídos/publicados a partir desta revisão.
- `2951940`: worker editorial atualizado; confirmar uma resposta só prepara
  tarefas dependentes, sem repetir a busca integral no corpus. Evita ultrapassar
  o tempo da ponte quando o acervo é grande.
- Migração 0037 aplicada (38 migrações no total), permissões explícitas aplicadas.
  Sem seed, mudanças em catálogo comercial, publicação editorial ou credenciais.
- Coleta/preparação na VPS a cada seis horas; monitor de normas a cada 24 horas.
  Reinício do serviço inicia um ciclo. A fila sobrevive ao fechamento do Mac.
- Ponte usa somente o SSH existente e o worker restrito. Teto compartilhado de
  24 reservas/24h, reserva de 45 minutos e três tentativas. Sem API paga de fallback.

## Evidências de funcionamento

Verificação final local: lint, typecheck e build aprovados; 1.236 testes gerais
passaram, 230 testes dependentes de ambientes específicos ficaram pulados nessa
rodada geral. Os nove testes PostgreSQL abaixo foram executados separadamente.

1. Banco sintético isolado: nove testes de concorrência, orçamento, expiração,
   mudança de contexto, revisão legal, autoria em rascunho, encadeamento e papel
   restrito passaram. A importação pelo papel `leiprova_app` também foi verificada.
   Banco/container/túnel de teste removidos; homologação real preservada.
2. Login sintético acessou o painel; visitante foi redirecionado ao login. Em
   largura de 390 pixels, documento mediu 390 pixels, sem transbordamento
   horizontal. Screenshot desktop conferida. A screenshot mobile falhou no
   navegador; não declarar revisão visual mobile completa.
3. Produção: aplicação e homologação saudáveis; rota `/admin/motores` encaminha
   visitante para `/entrar?next=%2Fadmin%2Fmotores`.
4. Uma tarefa real `discovery:cebraspe:2026-09-06` foi reservada e concluída
   **manualmente pelo Codex desktop**, através da ponte. O índice oficial e a
   página [SEFAZ AL 26](https://www.cebraspe.org.br/concursos/SEFAZ_AL_26) foram
   acessados por agent-browser. A proposta cita o link de edital de abertura
   listado em 25/08/2026; PDF e cargo ainda não foram validados. Nenhum edital
   foi aprovado/cadastrado como fonte canônica por essa ação.
5. Confirmação repetida retornou `replayed: true`, sem duplicação. Recibo privado
   em `.local/maestri/queue`; não copiar reservas ou pacotes para notas públicas.

## Resultado do primeiro ciclo real

Ciclo editorial finalizado às 20:39:34 UTC:

- Coleta: cinco fontes verificadas, seis documentos candidatos, cinco tentativas,
  três documentos sem alteração, zero capturas novas, **cinco falhas** e uma fonte
  suspensa por política de acesso. Falhas incluem HTTP 503, HTTP 404 e assinatura
  de PDF inválida; outras duas não têm causa detalhada conclusiva nesta entrega.
- Extração de programa: zero novos requisitos, um snapshot já processado.
- Gerador determinístico anterior: fila vazia; nenhum rascunho criado.
- Nova ponte: 134 análises de requisitos, quatro tarefas de descoberta (uma
  previamente bloqueada) e três análises de mudanças legislativas preparadas.

Monitor finalizado às 20:38:30 UTC:

- Dez normas verificadas, nenhuma falha de consulta; oito textos sem alteração,
  uma pendência adiada e um aviso de compilação monovigente indisponível para a
  Lei de Licitações e Contratos. Isso não comprova revisão jurídica de todas as leis.
- Três portais verificados sem falha; VUNESP suspensa por bloqueio observado.

Depois do teste manual: 134 vínculos e três análises legislativas pendentes;
descoberta com uma preparada, duas pendentes e uma bloqueada; uma reserva usada.
**Zero novas questões importadas/publicadas em produção nesta rodada.**

Segundo ciclo editorial concluído às 20:42:45 UTC confirmou idempotência:
zero novas tarefas, sem duplicar as 141 tarefas existentes. As mesmas cinco
falhas de coleta permaneceram. O processo retorna erro no ciclo para sinalizá-las,
mas o serviço contínuo mantém a próxima tentativa após o intervalo configurado.

## Maestri — ativação posterior às 19h42 BRT

As skills Maestri foram usadas para coordenar os nós existentes. O Maestro
registrou a autorização/ownership na TEAM-CHARTER. Guardião entregou o módulo
conservador incorporado e testado; Radar entregou o diagnóstico privado de
portais. O recibo do Forge ainda não confirmou a entrega final do fetch.

Com o Mac desbloqueado, o terminal Maestro permitiu comandos locais apesar do
limite semanal do Claude. Nenhuma identidade/socket foi copiada ou forjada.

- Lista inicial confirmou zero rotinas. Criadas e verificadas: Radar `6237b5`,
  Guardião `cc6e9e`, Autor `56cefb`. Todas habilitadas, intervalo de 20 minutos,
  pular terminal ocupado e sem notificação por disparo. Oito nós preservados.
- PROJECT-CONTEXT, TEAM-CHARTER, EDITORIAL-QUEUE e QUALITY-GATES receberam bloco
  vigente que supera restrições históricas de fila vazia/ponte inexistente.
  Importação automática permite apenas rascunhos; publicação exige revisão humana.
- Primeiro teste não reservou trabalho. Ajustado o preflight para Node absoluto,
  PATH/diretório explícitos e argumento ASCII do Guardião. Adaptador privado
  chama a mesma ponte, sem transportar credenciais.
- Teste seguinte: Autor registrou `idle_or_budget` com fila autoral vazia;
  Radar registrou `claude_limit_wait`; Guardião reservou `legal-change:643`
  e iniciou leitura/análise no nó Codex. A resposta foi recolhida pela ponte às
  19h49 BRT e persistida como `blocked`: snapshot pendente sem texto/comparação
  e consulta ao robots do Senado retornando 403. Não afirmou mudança nem vigência.
- Radar não reserva antes de 07/09/2026 às 03h BRT, reset indicado pelo Claude.
  Maestro também está sem saldo. Nenhuma API paga usada para contornar o limite.
- Forge estava parado pedindo navegação em `/concursos/` da FCC; pedido recusado
  por política de acesso. Tarefa delimitada de erros seguros retomada, ainda
  sem correção final integrada. As cinco falhas de coleta não estão resolvidas.

Recibos privados: `.local/maestri/ativacao-rotinas-20260906.json`,
`preflight-config-20260906.json`, `automatic-result-handoff-20260906.json` e
`preflight-events.jsonl`. Recolhimento de respostas (`--mode=settle`) incluído
para o agendador concluir pela ponte, sem SSH iniciado pelos agentes; cinco
testes locais específicos passaram. O teste real de recolhimento foi acionado
pelo integrador, não por um disparo periódico: essa distinção permanece.
As permissões restritas do terminal exigiram confirmações pontuais de navegador
e escrita nessa primeira tarefa. Não foram ampliadas nem criada allowlist;
novas confirmações podem impedir execução totalmente sem supervisão.
Ativação comprovada
não é comprovação de conclusão autoral nem de produto pronto.

Verificação após a ativação: lint, typecheck e build passaram; 1.241 testes
passaram e 230 opcionais foram pulados. Mudança nova é do operador local, sem
necessidade de reconstruir/reiniciar a aplicação ou os workers publicados.
Estado da fila: 134 mapeamentos pendentes; análises normativas com duas pendentes
e uma bloqueada; descobertas com uma preparada, duas pendentes e uma bloqueada.
Duas reservas utilizadas de 24/24h. Nenhuma questão nova importada/publicada.

Mesmo ativadas, as etapas de IA só executam com Maestri/workspace/terminais
disponíveis. Ainda não houve migração para o servidor doméstico 24/7.

## Limites editoriais e de cobertura

Correção posterior do fetch recebida do Forge e integrada pelo Codex desktop:
erros tipados seguros de política/DNS/TLS/HTTP/corpo/PDF, política de acesso
também no fetch e em redirects, exclusão de âncoras/links da própria notícia.
72 testes específicos passaram, incluindo PDF sintético com parser real.
SSP-BA: cadastro aponta para relatório de gestão, rejeitado antes de HTTP;
não atribuir essa falha ao WAF. Manaus ainda sem diagnóstico conclusivo.
HTTP 404/503 e indisponibilidade externa não foram resolvidos pelo patch.
Publicação confirmada no registro de 20h03 BRT no início deste documento.

- FGV e Cebraspe: descoberta dos portais cadastrados. FCC: somente índices
  permitidos na raiz; não coletar `/concursos/`, `/rss/` ou PDFs proibidos pelo robots.
- VUNESP: coleta suspensa por bloqueio de acesso; usar fonte oficial alternativa
  do órgão somente após validação. Não contornar WAF/CAPTCHA/login.
- As propostas de fonte, vínculos legais e questões não representam aprovação.
  O fluxo até rascunho não abre vendas nem entrega conteúdo ao aluno.
- Não existe comprovação de varredura nacional, geração autônoma pelo Maestri,
  piso de 68 questões por produto ou catálogo inteiro pronto para comercialização.

## Preservação e reversão

Backup restaurável verificado: `/opt/leiprova/backups/leiprova-20260906T203100Z.dump`
(8.431.314 bytes). Imagens anteriores preservadas com tag `rollback-editorial-20260906`
para app, editorial-automation e legal-monitor. Uma reversão de runtime não deve
apagar a fila nem restaurar banco sem necessidade/decisão explícita.

Hashes antes/depois (MD5 agregado de cada linha, para igualdade operacional):

- 346 questões: `bb9e20a9566aa650ce2a840d6490f55d`.
- 75 produtos: `c8d1313c301cdb7d195bfd6f2487b8e9`.

Checkout e checkout por concurso continuam `false`. Homologação e worker de
entrega não foram recriados; nenhum outro projeto foi alterado.
