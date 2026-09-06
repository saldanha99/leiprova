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
bloqueadas continuam fora da seleção. A revisão das 80 também muda seu contexto
de auditoria: 11 propostas anteriores requerem atualização do dossiê, não troca
silenciosa de status.

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

Preencher após implantação e conferência dos recibos. Preparação, testes ou
autorização recebida não equivalem a publicação executada nem a 68 por curso.
