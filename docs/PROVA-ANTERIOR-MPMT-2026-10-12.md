# MPMT 01/2026 — prova preambular oficial como links externos

Estado deste trabalho: prévia pública verificada, código preparado; **nenhum
cadastro, aprovação ou vínculo no banco de produção executado aqui**. Não é
liberação do curso, licença de reprodução ou importação de questões.

Em 12/10/2026, às 06h00m40s UTC (03h00m40s BRT), a
[página oficial FGV/MPMT](https://conhecimento.fgv.br/concursos/mpmt) e o robots
foram consultados. A página identifica Promotor de Justiça Substituto e contém:

- [Caderno Tipo 1](https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substituto-cns100-tipo-1_1.pdf), divulgado em 15/06/2026.
- [Gabarito oficial definitivo](https://conhecimento.fgv.br/sites/default/files/concursos/mpmt2026-gabaritos-para-publicacao_0.pdf), divulgado em 20/07/2026.

Ambos retornaram HTTP 200, MIME PDF, assinatura de PDF e URL final exata. A data
de divulgação do caderno não é a data de aplicação: a preambular do edital
01/2026 foi em 14/06. O edital compilado de 66 páginas, SHA-256
`1a7b0a61a3d0cc809206b7bc2e3988245f9e4694914008dfad6c5a8dd1e9055b`,
contém 100 questões objetivas na página 13 (§9.1) e data/cargo na página 18 (§11.1).
Não foi inferido formato de inéditas nem estendido o perfil à discursiva/oral.

O verificador existente recebe até 128 KiB transientes para assinatura/MIME e
cancela o excedente. Não extrai texto nem armazena caderno, gabarito, enunciado,
resposta, comentário ou PDF de terceiro. A captura deste trabalho salva só JSON
de metadados. Robots não restringia os caminhos selecionados. Recibo privado:
`.local/editorial/mpmt-previous-exam-live-preview-20261012/preview.json`.
Hashes do HTML e robots:
`d888ac78f7d1f2867795b14a7b4f8d32560d53ce0116b54098677e78129cce99` e
`773fb8d35bb9a39d35335ee6db8dc5c912d2aacbfb823152d9c61cd647dd902d`.

## Operador de cadastro pendente

`register-mpmt-previous-exam-links.ts` produz prévia sem conexão ao banco por
padrão. Exemplo, com diretório privado novo:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/register-mpmt-previous-exam-links.ts \
  --output=.local/editorial/mpmt-links-NOVA-EXECUCAO
```

`--apply` exige `--opportunity=UUID_REAL` da admissão efetivamente aplicada e
`--expected-notice-sha256=HASH_EXATO` acima. Não utilizar o ID de um snapshot,
hipótese da fila ou edição de outro estado como oportunidade. O comando exige
`MIGRATION_DATABASE_URL` de manutenção `leiprova_owner` no banco `leiprova`,
administrador único e `OPPORTUNITY_APPROVAL_REFERENCE` exata:
`owner-standing-2026-10-12:official-sources-programs`.
Esse identificador operacional minúsculo é o valor do ambiente e da auditoria;
o [documento da autorização](AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md) continua
sendo a evidência da decisão. O caminho do documento, com letras maiúsculas,
não satisfaz a restrição SQL de `preparation_approval_reference`.

O operador reconfere robots, HTML, anchors, datas, edital compilado e links. A
transação serializável recusa cadastro se a admissão MPMT real ainda não existir.
Confere o produto draft/historical_training, revisão e fingerprint da oportunidade,
cargo/órgão/MT/01-2026/14-Jun, banca objetiva revisada, auditoria da admissão e o
snapshot único aprovado com o hash, 66 páginas e os dois localizadores. Edição
pré-existente ou prova realizada mais recente bloqueiam a operação; IDs e
registros de outros cursos não são alterados.

Caso aplicado, registra edição `mpmt-promotor-substituto-2026-objetiva` em `held`
e exatamente dois documentos em `pending_review`, `metadata_only` e
`external_link`. Não cria vínculo comercial aprovado. Auditoria
`editorial.previous_exam.mpmt_metadata_registered` inclui oportunidade real,
hashes, datas, IDs, seleção conferida e `owner_standing_authorization`,
`humanReview:false`, zero questões importadas e zero releases. JSONB usa o helper
`tx.json`, evitando serialização dupla do postgres.js.

## Aprovação posterior delimitada

O operador existente `approve-previous-exam-links.ts` recebeu `--standing`,
restrito neste incremento ao produto/edição MPMT exatos:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/approve-previous-exam-links.ts \
  --standing mpe-mt-promotor-de-justica-2026=mpmt-promotor-substituto-2026-objetiva
```

Esse segundo comando usa o banco e desfaz a transação ao final da prévia; somente
`--apply` aplica. Exige `PREVIOUS_EXAM_APPROVAL_REFERENCE` igual a
`owner-standing-2026-10-12:official-sources-programs`, manutenção/administrador
únicos, documentos pendentes, reconferência na
origem e auditoria do cadastro correspondente à oportunidade histórica realmente
associada. URL Tipo1/definitivo e data 14/06 são exatas. A auditoria de documentos
e de vínculo declara `owner_standing_authorization` e `humanReview:false`.
Chamadas antigas sem `--standing` conservam sua autorização histórica; não
recebem uma afirmação retroativa de revisão humana. O comando aprova links e
referência, não reprodução das questões nem venda.

O escopo histórico passa a considerar a última prova já realizada antes de
**hoje, no calendário de São Paulo**, permitindo a própria edição passada como
referência do treino histórico. Mantém órgão, cargo/especialidade, UF, fonte,
banca declarada, frescor, documentos aprovados e exclusão de edição mais recente.
`current_notice`, modo ausente e `pre_notice` conservam o corte anterior à data
da oportunidade. A mesma condição está na consulta de revisão, na política e no
SQL de prontidão/entrega; não se muda a data da oportunidade para contornar o gate.
Prova de hoje ou futura permanece bloqueada. Reprodução exige licença específica
como antes.

Validação do escopo: 28 testes passaram, incluindo anchors/datas/definitivo,
recusa de robots/redirect/HTML/HTTP, ausência de admissão real sem insert,
identidade concreta e autorização exata, própria edição somente no histórico,
prova futura e edição mais recente bloqueadas. ESLint passou. Typecheck integral
e eventual aplicação na VPS ficam com o operador responsável; não houve build
local ou consulta/escrita em produção por este trabalho.

## Atribuição da edição-base à oportunidade

O cadastro agora atribui, na **mesma transação**, a nova edição histórica ao
`exam_edition_id` da oportunidade real. Somente aceita vínculo anterior nulo e
reconfere órgão, cargo, MT, carreira/especialidade, 01/2026 e data 14/06/2026.
Trava produto e oportunidade; edição-base já existente bloqueia a operação,
sem substituir IDs. Os updates precisam retornar exatamente a oportunidade e o
produto esperados; ausência, identidade divergente ou múltiplas linhas cancelam
a transação inteira, inclusive edição/documentos recém-inseridos.

A atribuição atualiza `opportunity.updated_at` e sincroniza
`preparation_opportunity_updated_at` do produto com o timestamp efetivamente
gravado na oportunidade. Isso conserva a revisão do modo previamente confirmada
para essa mesma identidade. Não altera programa, cargo ou data, não aprova
caderno/gabarito, não cria referência de papel aprovada, não revisa questões nem
libera produto. A auditoria registra `assignedBaselineEdition:true`, o ID real
da edição e o timestamp; `referencesApproved:0`, questões importadas zero e
releases zero. O contrato específico de inéditas continua sendo etapa própria.

Regressões da atribuição: 16 testes do módulo passaram, incluindo execução exata,
vínculo pré-existente bloqueado e seis casos de retorno ausente/divergente/múltiplo
nos updates, todos sem recibo de commit/auditoria de sucesso. ESLint passou.
Esses testes usam fixtures sintéticas e simulador de transação; aplicação real e
QA integral da VPS continuam com o operador responsável.
