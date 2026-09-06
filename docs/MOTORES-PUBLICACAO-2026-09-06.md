# Motores editoriais — publicação e limites verificados

Verificação de 06/09/2026, aproximadamente 17h43 BRT. Stripe permanece pausada.

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

## Maestri — parte ainda não ativada

As skills Maestri foram usadas para coordenar os nós existentes. O Maestro
registrou a autorização/ownership na TEAM-CHARTER. Guardião entregou o módulo
conservador incorporado e testado; Radar entregou o diagnóstico privado de
portais. O recibo do Forge ainda não confirmou a entrega final do fetch.

**Não foram criadas as três rotinas recorrentes.** O Mac bloqueou a interação
visual e a tentativa de desbloqueio automático falhou. O CLI precisa do terminal
Maestro iniciado pelo aplicativo; não se deve forjar sua identidade/socket.
Código e notas de contexto não são prova de ativação do canvas.

Quando o Mac for desbloqueado:

1. Maestro lê `docs/MAESTRI-MOTORES-AUTOMATICOS.md` e lista nós/rotinas reais.
2. Reutiliza Radar, Guardião e Autor; cria/atualiza `Editalume — Radar`,
   `Editalume — Guardião`, `Editalume — Autor`, a cada 20 minutos, com os
   preflights/contratos documentados. Sem duplicar agentes ou rotinas.
3. Atualiza PROJECT-CONTEXT, TEAM-CHARTER, EDITORIAL-QUEUE e QUALITY-GATES,
   preservando as regras e os acessos privados. Não copiar credenciais.
4. Verifica uma execução real por papel e registra IDs/recibos. Confirma o
   diagnóstico final do Forge e trata as cinco falhas de coleta.

Mesmo ativadas, as etapas de IA só executam com Maestri/workspace/terminais
disponíveis. Ainda não houve migração para o servidor doméstico 24/7.

## Limites editoriais e de cobertura

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
