# Continuação da produção — 15/10/2026

## Fotografia confirmada

Relatório do proprietário em 16h22m44 UTC / 13h22 BRT: 11 de 84 produtos
editorialmente elegíveis; 1.799 questões válidas nas ofertas; 108 questões novas
distintas efetivamente publicadas no dia de São Paulo. A métrica usa
`editorial-owner-report.ts`, não multiplica reaprovações ou vínculos por produto
e não homologa checkout. A meta de 1.000/dia continua capacidade pretendida.
Conferência anterior avançou até 14h10m08.972363 UTC, com cinco itens sem
retenção. A consulta desta rodada não trouxe novas aprovações; não houve avanço
artificial do watermark.

## Código e verificação

Publicados `2fc257a` (evidência composta MPRJ, preview CP, persistência atômica
da ponte) e `791e8ef` (índices de páginas JSONB tipados como inteiro).
O segundo corrige uma recusa real: PostgreSQL inferia o índice parametrizado
como texto e devolvia NULL ao acessar o array; a sonda confirmou `{text,integer}`
e a prévia real passou com o cast explícito. Nenhuma identidade/fonte foi
relaxada para sanar a recusa.

QA inicial com dois workers encontrou timeouts dos testes de subshell. A suíte
integral posterior com um worker e timeout de 30s passou: 1.956 testes e 293
opcionais pulados, incluindo execução real do novo teste PostgreSQL. Após a
correção dos índices, lint, typecheck, 1.955 testes (294 opcionais pulados) e
build passaram novamente. O PostgreSQL opcional já havia sido testado e o
ambiente descartável foi encerrado. Não apresentar as primeiras execuções com
falha como verdes.

O teste PostgreSQL passou a usar savepoints do driver: rollback manual não
limpava o erro rastreado no escopo externo. Ele verifica pares nulos/válidos e
recusa par parcial em ambos os sentidos, documento inexistente, edição alheia,
tipo errado e reuso dos outros IDs. A migração 0055 foi aplicada também sobre
cópia somente de schema em PostgreSQL 17 isolado; catálogo confirmou as duas
constraints e a coluna de finalidade. Nenhum dado de produção foi copiado para
o teste. O container novo e o túnel foram encerrados; o serviço de outro QA
que já usava a porta 55446 da VPS foi preservado.

Deploy pelo fluxo existente, com `LEIPROVA_SKIP_SEED=1`, sem flags ou seed.
App/banco/pooler saudáveis; health e catálogo públicos responderam 200.
Backup privado conferido antes do deploy, SHA-256
`fe068ee128fa71a53a4b3f12ed44af297de50c346bfcf806b9721e1952ec042c`.
Imagens anteriores de app/worker preservadas com tag
`before-mprj-20261015`. Retorno de código deve preservar a migração aditiva e
as entregas posteriores; não restaurar o dump sobre produção corrente.

## CP: prévia comprovada, restauração pendente

A prévia real somente leitura verificou o corpo oficial fresco de 402 artigos,
a emenda, robots, recibo/auditorias, cinco dependências exatas e o predicado
comercial completo no PostgreSQL. Catálogo real: 11 produtos; ENAC102 atual,
107 projetado, diferença de cinco reabilitações e zero autoria nova; demais
produtos sem variação. CP112 permanece `pending_review`, recibo1 `suspended` e
snapshots rejeitados. Não foi criado caminho de apply nem executada restauração.

A revisão independente encontrou duas lacunas do fingerprint, corrigidas pela
raiz: hash/status do robots e identidade de oportunidade dos produtos.
Regressões atravessam o validador e provam mudança do fingerprint mesmo quando
as contagens não mudam. A fixture pública da Câmara mantém bytes e SHA originais;
não normalizar os espaços/quebras para silenciar avisos de diff.

## MPRJ: infraestrutura pronta, cadastro ainda bloqueado

O caminho composto distingue caderno Tipo1, gabarito preliminar e ato de
manutenção de todos os gabaritos, sem relabelar preliminar como definitivo.
O CHECK do terceiro slot exige discriminador não nulo e a FK composta exata.
Não há backfill, cópia de questões, licença presumida ou liberação comercial.

Preview MPRJ efetivo passou com identidade, edital aprovado e três URLs oficiais
retornando PDF. Apply foi recusado por fingerprint divergente e a transação não
cadastrou a edição. Duas capturas consecutivas demonstraram hashes HTML do portal
diferentes com robots e identidade/metadados dos documentos estáveis. Isso
localiza a diferença; não prova, sozinho, que toda alteração do HTML é irrelevante.
Forge recebeu tarefa de identificar os campos variáveis, manter hash bruto em
auditoria e criar evidência canônica estrita com regressões de mudanças reais.
Não repetir apply nem descartar gate para forçar o cadastro.

O edital de 47 páginas confirma múltipla escolha e 100 questões, mas a cláusula
de cinco opções/única correta está nas instruções da capa do caderno, segundo a
investigação. Não concatenar esse texto ao `sourceQuote` do edital. PDF completo
do caderno não deve entrar em snapshots/corpus como atalho: `metadata_only` não
autoriza persistir questões. Admissão do formato exige evidência delimitada de
capa/instruções e revalidação própria. PCAL (dois cargos) e TCE-MA (onze trilhas)
continuam exigindo contratos por cargo, sem estreitamento silencioso de produto.

## Operação preservada e recibos

Prism usa ignorar permissões após confirmação específica do proprietário;
conversa retomada no mesmo nó, com conexões preservadas. Autor/Guardião seguem
Flash Low; Forge permanece Luna Low. Não foram duplicados nós, reservas ou
rotinas nem reiniciados limites/tentativas. Não houve nova API paga, envio de
WhatsApp ou ativação de anúncios. Integração WhatsApp ainda não foi validada;
Meta/Google Ads seguem sem orçamento e contas prontos para veiculação.

Recibos privados desta rodada: prefixo
`.local/editorial/continuation-20261012/heartbeat-20261015-1553-` e relatórios
`.local/maestri/heartbeat-20261015-1553-*`. Nenhuma credencial foi incluída aqui.


## Avanço confirmado em14h07 BRT

`070577b` corrigiu o fingerprint MPRJ para usar evidências oficiais canônicas
validadas, mantendo o hash bruto em auditoria. A raiz capturou duas respostas
reais: todas as linhas fora da28 eram idênticas; a única linha variável era o
script de telemetria BOOMR/Akamai (identificador de requisição, porta, tempo e
valores da própria telemetria). Nenhuma mudança nas âncoras foi descartada para
forçar identidade. Duas prévias reais pelo bundle e uma pela imagem publicada
produziram `66564b534cb9ecebe38cd4b627b7949e9a854227fb79de4a6110a98b1fa19358`.
Regressões continuam recusando mudanças reais de identidade, URL, data, rótulo,
duplicação ou anúncio de gabarito definitivo. PDFs continuam metadata_only;
esta correção não acrescenta hash integral ou extração de cadernos.

Lint, typecheck, 1.957 testes passaram (294 opcionais pulados) e build passou.
O teste PostgreSQL opcional não foi reexecutado nesta alteração de extração;
a execução real da rodada anterior permanece registrada. Backup novo conferido
por pg_restore no container: SHA256
`d3290374ac2c451d0ebfeba8ac99a27cd2b8f3eff7bb18ea41ea7107f7cf4ae2`.
A primeira verificação tentou pg_restore no host, que não o tinha; foi corrigida
para o binário do container e só então o deploy prosseguiu. Deploy pelo fluxo
normal sem seed; health ok e catálogo HTTP200.

Apply audit24109 cadastrou exatamente a edição MPRJ41, sem conteúdo de questões.
Após preview com rollback, o operador standing aprovou os três documentos
metadata_only (audits24128–24130) e a referência anterior
`93a703d1-7b9e-4f6b-b071-ad0f71f65cf6` (audit24132). Todas as decisões registram
owner_standing_authorization e humanReview:false. Estado conferido no banco:
uma edição, três documentos aprovados e uma referência aprovada. Nenhum produto
liberado por essas operações.

Relatório17h07m09UTC:11/84,108 novas distintas válidas hoje, MPRJdraft0/68.
Contrato de formato ainda precisa de evidência de instruções delimitada;
o regulamento oficial só confirmou múltipla escolha, sem resolver MC5.
Não armazenar PDF completo para suprir isso. A validade corrente do contrato
também deve conferir qualquer nova evidência, além do operador de aprovação.
CP112pending_review e recibo1suspended preservados. Consulta de novas questões
retornou zero; watermark não avançou artificialmente.

O Mac estava bloqueado e a ferramenta não conseguiu desbloqueá-lo. A próxima
tarefa do Maestri ficou preparada privadamente, não enviada; não declarar
redistribuição ou execução sem recibo. Operação VPS continuou disponível.
Recibos desta rodada: prefixo privado heartbeat-20261015-1655 em
.local/editorial/continuation-20261012/ e tarefa privada em .local/maestri/.
