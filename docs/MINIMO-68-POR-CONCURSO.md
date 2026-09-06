# Mínimo de 68 questões por concurso

Pedido do responsável em 06/09/2026: cada um dos 75 produtos deve ter ao menos
68 questões. A mesma mensagem confirmou revisão/autorização do lote de 80;
houve também confirmação separada de responsabilidade editorial e ausência
de reprodução de questões de terceiros, limitada explicitamente a essas 80.

## Regra implementada

`MINIMUM_COURSE_QUESTION_COUNT = 68` é o piso para **novas vendas/liberação
comercial por produto**. Não é soma por carreira, estado ou banca. O servidor
conta questões distintas com vínculo aprovado ao `productSlug` exato e revalida
todos os critérios de fonte, requisito, artigo vigente, banca, revisão, enunciado,
alternativas e contexto. Vários vínculos da mesma questão contam uma vez.

67 bloqueia, 68 permite passar somente este critério, 69 também. Atingir o piso
não abre Stripe nem substitui demais gates editoriais/comerciais. Rascunhos,
propostas pendentes e evidências desatualizadas não contam. O painel administrativo
mostra questões válidas, meta e déficit por curso, sem expor uma API pública.

Se uma questão de um produto com 68 for suspensa, novas vendas fecham, mas o
cliente que já comprou conserva as 67 restantes ainda válidas e a vigência paga.
O piso não foi aplicado ao `getStudyEntitlement` como revogação em bloco.
A landing também não herda a oferta de outro cargo apenas por compartilhar edital.

75 × 68 = **5.100 vínculos produto–questão válidos**, não necessariamente 5.100
questões globalmente exclusivas. Reutilização depende de aderência oficial
revisada separadamente para cada produto; não serve para completar contagem à força.

## Revisão do lote de 80

Novo comando `pnpm editorial:review:80`, serviço `editorial-review-80` e volume
privado `.local/editorial/review-80-input`. Exige pacote exato
`cf-garantias-processuais-2026-09-06`, quatro bancas com 20 questões cada, fonte,
mapeamento, autorização vinculada aos hashes e conta editorial existente.
`LEIPROVA_REVIEW_80_APPROVED=review-80:cf-garantias-processuais-2026-09-06` é uma
habilitação operacional específica, não um substituto da declaração humana.

O wrapper confere o papel restrito, usa arquivos somente leitura e o mesmo
descritor sem seguir troca por symlink, exige prévia/fingerprint antes de aplicar
e reutiliza o serviço transacional de revisão existente. Não altera o operador
antigo de 160, não aprova requisitos ou curadoria por produto e não abre vendas.
Credenciais, identidade e autorização completas não são versionadas.

## Expansão ENAM e gargalo real

Foram geradas 22 questões FGV adicionais, a partir de fontes constitucionais
oficiais já capturadas e novamente conferidas no navegador em 06/09. Elas têm
objetivos diferentes dos itens anteriores e estão documentadas no pacote privado
`.local/editorial/enam-complemento-68-2026-09-06/`.

Essas 22, somadas às 46 propostas compatíveis anteriores, compõem **68 candidatas
distintas para o ENAM**. Não são 68 questões automaticamente liberadas: o novo
complemento ainda precisa de revisão humana específica. As 14 propostas penais
bloqueadas continuam fora da seleção. A revisão das 80 também mudou seu contexto
de auditoria: 11 propostas anteriores tiveram seus dossiês atualizados, preservando
o histórico, sem troca silenciosa de status.

Levantamento anterior à revisão: 75 produtos, zero vínculos produto–edital
aprovados, seis oportunidades oficiais cadastradas, 46 propostas pendentes e
zero cursos com 68 vínculos válidos. O catálogo de pesquisa não prova a existência
de edital para os demais produtos. Cada edição/cargo exige fonte oficial, banca
e programa compatíveis antes de gerar e revisar a seleção correspondente.

## Verificação e operação

Lint, typecheck, build e 784 testes gerais aprovados; 150 testes opcionais
ignorados nessa execução. Integração adicional do piso: 28 testes PostgreSQL
em sandbox exclusivo, incluindo cenário 68→67, duplicatas e isolamento. Os testes
unitários dessa bateria se sobrepõem à execução geral; não somar como distintos.

Nenhuma migração nova nem alteração do banco local 5432 foi necessária. O sandbox
anterior 55441 foi reutilizado e encerrado, preservando seus arquivos. Homologação
pública deve permanecer com suas imagens e banco separados, sem seed deste turno.

Backup prévio no servidor e Mac: `leiprova-before-review80-minimum68-20260906.dump`,
SHA-256 `74c27b18318ae42920de4982a3e89021fc6cbd833bb529758c3b2b4d7105059e`.
Imagem anterior preservada: `leiprova-app:pre-review80-minimum68-20260906`.

## Resultado de produção

Conferido em **06/09/2026, 09h09 BRT (12h09 UTC)**. Código `9f58d5d`, imagem
`sha256:d8e1f3131731ecdc46ad46565df9391981aec4e969e1e4a086c879490338dc2d`.
Deploy sem seed; nenhuma migração nova. Produção e homologação responderam
`/api/health` com `ok`; os contêineres de homologação não foram recriados.

- **80 questões aprovadas** com as duas declarações humanas efetivamente
  recebidas, responsável/revisor registrado e uma auditoria de aprovação por item.
  Reexecução: zero novas aprovações, 80 reaproveitadas.
- **22 novas questões FGV importadas como rascunhos**, sem registrar revisor,
  assunção humana de autoria ou aprovação. Reexecução: zero novas, 22 reaproveitadas.
- Acervo total: **346 = 312 revisadas + 12 pendentes anteriores + 22 rascunhos**.
  Hashes de todas as 244 questões e 1.034 alternativas anteriores ao lote de 80
  permaneceram idênticos ao levantamento prévio.
- ENAM: **68 questões distintas propostas**. Há 79 linhas pendentes na tabela:
  68 propostas com referência atual da questão e 11 versões históricas preservadas
  após a revisão das 80. Essas versões antigas não são questões adicionais.
  As 14 propostas incompatíveis continuam fora da importação.
- **Zero vínculos aprovados e zero dos 75 cursos com o mínimo válido atingido.**
  Todos os produtos continuam sem associação editorial aprovada à oportunidade.
  Requisitos 6/7 do ENAM e aderência das questões ainda exigem mapeamento/revisão.
  Aprovar as 80 não equivale a aprovar o complemento de 22 ou a curadoria do produto.
- Checkout público ENAM conferido com compra desabilitada; acesso anônimo ao
  catálogo administrativo redireciona ao login. A renderização administrativa foi
  testada localmente, sem simular uma sessão administrativa real em produção.
  Stripe não foi ativada e nenhum produto/preço externo foi criado nesta entrega.

Recibos privados em `.local/editorial/cf-garantias-processuais-2026-09-06/`:
`review80-{preview,applied,replay}.json`, `bindings-refresh-{preview,applied,replay}.json`,
`verification-after-minimum68.json`, `coverage-after-review.json` e
`COBERTURA-75-after-review.md`. Operação de aprovação dos 80:
`fd364bd1ff03f99a70b265ae3118b54b69b00d3c7558e813a3adc007e31003ec`.
Os recibos `drafts-*` e `bindings-*` do novo complemento ficam em
`.local/editorial/enam-complemento-68-2026-09-06/`, junto ao caderno de revisão.
Nenhuma autorização, identidade pessoal ou conteúdo privado foi versionado.

O volume original de rascunhos foi preservado em
`.local/editorial/draft-input-80-archive-20260906` na VPS. O arquivo das 46
propostas foi preservado em `binding-input/proposals-46-before-complement-20260906.json`.
Os volumes de entrada atuais são distintos: revisão exclusivamente dos 80;
rascunhos e propostas do complemento de 22. Não reaproveitar seus marcadores
operacionais como autorização editorial de novos lotes.

## Próxima expansão

Pesquisa privada de cinco fontes oficiais está em
`.local/editorial/planejamento-68-2026-09-06/RELATORIO-FONTES-5.md` e `fontes-5.json`.
Identificou ressalvas de cargo em Santa Catarina, edição/etapa da PGM-RJ e
retificações de cronograma. São registros de pesquisa, todos sem aprovação ou
importação; resolver as ressalvas antes de definir matriz e gerar novos lotes.

O caderno das 22 precisa de revisão humana própria. Depois, revisar os requisitos,
o vínculo da edição ao produto e a aderência das 68 candidatas. A aprovação de
curadoria ainda requer um fluxo próprio auditável: o importador atual só insere
propostas, e o papel da aplicação não pode atualizar campos de aprovação.
Não contornar isso com UPDATE direto, concessão ampla ou herança de autorização.

Disco compartilhado da VPS após build: aproximadamente **18 GB livres, 91% usado**.
Planejar espaço antes de outra compilação; não limpar imagens de outros projetos
nem apagar o backup/imagem de reversão preservados nesta operação.
