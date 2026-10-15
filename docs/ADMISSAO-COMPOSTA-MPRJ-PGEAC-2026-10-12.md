# Admissão delimitada de programas compostos — MPRJ e PGE-AC

Operador novo `scripts/admit-composite-official-course.ts`, separado da admissão
MPMT. **Aplicado na produção Everglades em12/10/2026**, após recaptura e
conferência de todos os sete hashes documentais e dos dois programas compostos.
MPRJ: oportunidade20, pública `31739f51-3b4b-4984-a272-54fb549c034d`,
auditoria7411,389 requisitos, fontes25–28/snapshots1254–1257. PGE-AC:
oportunidade21, pública `f16c8847-9d0d-4c47-84f8-752f3a72562d`, auditoria7412,
96 requisitos, fontes30–32/snapshots1258–1260. Ambos permanecem draft,
historical_training, sem questões/mapeamentos/liberações comerciais.
Os recibos completos estão nas pastas privadas `composite-mprj-apply-20261012.7sbgZP`
e `composite-pgeac-apply-20261012.6KW98W` em `/opt/leiprova/.local/editorial/`;
backup anterior validado em `backups/before-composite-mprj-pgeac-20261012.dump`.
Auditorias JSONB objeto, `owner_standing_authorization`, `humanReview:false`.

Somente dois produtos são permitidos: `mpe-rj-promotor-de-justica-2026` (MPRJ,
Promotor de Justiça Substituto, XXXIX/2026, RJ) e
`pge-ac-procurador-do-estado-reta-final` (PGE-AC, Procurador do Estado Classe I,
VIII/2026, AC). O texto comercial “Reta Final” não identifica a edição oficial.
Ambos recebem proposta de treino histórico objetivo com legislação atual.

A fonte primária do MPRJ separa edital de identidade/regras (47 páginas) e aviso de
programa (51 páginas). Republicações de 09/04 substituem Direito Penal, Processual
Penal e Legislação Penal Extravagante (13 páginas), e Processual Civil (5 páginas).
A composição conserva 13 disciplinas; as 2.001 linhas capturadas foram agrupadas
em 389 requisitos com pontos numerados, subitens e continuação literal. Não soma
versões superadas nem transfere automaticamente o perfil de outro Promotor.

A PGE-AC usa edital de 40 páginas, programa nas páginas 31–38, primeira
retificação de 10 páginas e segunda de quatro. O operador aplica oito substituições
e depois três, conservando 10 disciplinas. As 540 linhas capturadas geram 96
requisitos. Cada requisito referencia o documento e o snapshot efetivamente usados,
com disciplina e página ou intervalo de páginas. Esses totais descrevem a extração
conferida em 12/10, não questões prontas ou cobertura jurídica aprovada.

Marcos de fase são conferidos por HEAD exclusivamente em três PDFs exatos no
portal FGV: MPRJ habilitados à inscrição definitiva, republicação divulgada em
06/10; PGE-AC resultado definitivo da objetiva divulgado em 15/07 e preliminar da
subjetiva divulgado em 05/10. Datas de divulgação do portal são distintas de datas
que aparecem no nome do arquivo. Armazena apenas metadados, URL e data; nenhum
nome de candidato, nota, CPF ou texto de lista. Não anuncia homologação final do
concurso. Os portais oficiais são
[MPRJ XXXIX](https://conhecimento.fgv.br/concursos/mprjpromotor2026) e
[PGE-AC VIII](https://conhecimento.fgv.br/concursos/pgeac).

A responsabilidade primária é institucional, com comissão do concurso. A FGV
recebe vínculo de prestadora da etapa objetiva, fundamentado no edital de cada
cargo. O MPRJ conduz etapas posteriores com apoio logístico da FGV. Essa admissão
não define formato de futuras inéditas, número de alternativas ou perfil de
oral/discursiva. Para PGE-AC VIII/2026, caderno e gabarito definitivo são verificados
pelo verificador oficial existente. Para MPRJ, a última edição é XXXIX/2026:
somente o caderno Tipo1 está confirmado; o portal FGV oferece gabarito
**preliminar**, e o definitivo público não foi localizado. A receita não usa
XXXVIII/2025 como última prova nem transforma preliminar em definitivo.
Pesquisa oficial posterior encontrou o [aviso de manutenção dos gabaritos após
recursos](https://conhecimento.fgv.br/sites/default/files/concursos/22.06-recursos-gabarito-preambular.pdf),
uma página, publicado no portal FGV em22/06. Ele confirma manutenção dos
gabaritos da preambular, mas não é um novo PDF de gabarito definitivo. O suporte
à comprovação composta por preliminar e decisão oficial ainda exige implementação,
captura delimitada e auditoria próprias; nenhum bloqueio foi dispensado por essa pista.
`definitiveAnswerKeyAvailable:false` e bloqueio explícito mantêm a referência
MPRJ incompleta. Todos permanecem links externos **pendentes de aprovação para o
produto**, sem armazenamento/extração ou licença presumida.

A prévia é padrão e não lê/conecta banco:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/admit-composite-official-course.ts \
  --product=mpe-rj-promotor-de-justica-2026 \
  --output=.local/editorial/composite-mprj-preview-NOVA-EXECUCAO
```

A aplicação exige `--apply`, um produto explícito, um
`--expected-programme-sha256=HASH` e um
`--expected-document=CHAVE:HASH` para **cada** PDF configurado (quatro MPRJ ou três
PGE-AC). Os hashes devem vir da prévia conferida; não aceitar o conjunto de outra
edição. O comando recaptura os PDFs sequencialmente pela política oficial existente,
compara os bytes e o programa composto, verifica os marcos/links novamente e
bloqueia evidência com mais de 15 minutos. PDFs/textos/snapshots privados anteriores
não são carregados como evidência fresca para aplicar.

`MIGRATION_DATABASE_URL` deve ser acesso de manutenção `leiprova_owner` ao banco
`leiprova`; não aceita a conexão normal da aplicação. A referência obrigatória é
`owner-standing-2026-10-12:official-sources-programs`, documentada em
`docs/AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md`. A identidade exige administrador
único. O operador trava o vínculo do produto e recusa produto que não seja draft,
que já tenha edição ou cuja edição/cargo/ano já exista. O fluxo não sobrescreve
registros revisados.

Tudo ocorre em uma transação serializável: oportunidade draft, fontes e snapshots
aprovados, organizadores revisados, transição para reviewed e requisitos extraídos.
Só depois associa o produto em `historical_training`, preservando seu status draft.
Subject/topic/ato/artigo ficam nulos; não insere mapeamentos legais ou questões nem
libera venda. `reviewed` atesta aqui a extração do programa, não vigência das leis
citadas ou aderência de inéditas. A auditoria
`editorial.official_course.composite_standing_admitted` declara
`owner_standing_authorization`, `humanReview:false`, hashes, fontes, substituições,
marcos metadata-only e zero mapeamentos/questões/releases. Revisão humana não é
presumida pela identidade do administrador.

Validação: 19 testes específicos/composição/política passaram, incluindo ordem
fonte+organizador antes de reviewed, falha antes de auditoria quando o vínculo
esperado não atualiza, hashes incompletos/divergentes, alvo/caminho estranho,
freshness, subitens MPRJ e preservação de continuadores. ESLint do escopo passou.
A conferência offline das capturas privadas confirmou 389/96 requisitos e os
fingerprints de programa anteriores. Typecheck integral com heap de 384 MB abortou
por limite de memória; a checagem integral é delegada ao QA da VPS, sem build local.
Nenhum SQL de aplicação, captura de texto de prova, publicação ou API de modelo
paga foi executado por este trabalho.

Correção de persistência JSONB: `page_texts` e metadados da auditoria usam
`tx.json(valor)` do postgres.js, recebendo array/objeto diretamente. Não interpolar
`JSON.stringify(valor)::jsonb`: o driver pode inferir JSONB e serializar a string
novamente. Prova real em transação read-only do cluster sintético
`leiprova_automation_test` confirmou `jsonb_typeof` string para a interpolação
manual, array/objeto para o helper. Zero writes; produção não acessada. Recibo
privado `.local/qa-agent-20261012/jsonb-driver-readonly.log`. O teste da admissão
agora verifica que cada snapshot envia array e a auditoria envia objeto ao helper;
9/9 testes do módulo passaram novamente, com ESLint limpo.

Correção posterior de datas: a admissão grava `exam_date` explicitamente. MPRJ
`2026-05-31`, edital47p SHAa42655899f7c0dcb5aef49164d7b2c0cbd6f7e6ede663fadb31887096b8aad62,
p.21, §11.1: “com aplicação prevista para o dia 31 de maio de 2026 (domingo)”.
A [notícia oficial do MPRJ](https://www.mprj.mp.br/visualizar?noticiaId=224001),
publicada em31/05/2026, confirma a realização da preambular naquele domingo.
PGE-AC `2026-05-24`, edital40p SHA954c921cf9e5601accbf688e7f29697bfdae4257f1f264862aed3efaa9bbfac4,
p.14, §9.1: “de 24 de maio de 2026, das 8h às 13h”. Retificações1/2 capturadas
não mudam essa data. O resultado posterior confirma que a objetiva ocorreu;
a conferência não localizou anúncio independente do dia efetivo PGE-AC, e essa
limitação fica explícita em `examDateEvidence`. A publicação do caderno não é
usada para inferir a aplicação. Claims de página/data são conferidas antes do
INSERT, com corte civil de São Paulo, sem aceitar data ausente ou futura.
Os hashes de `programme.sections` e os389/96requisitos permanecem iguais.
A referência operacional agora é
`owner-standing-2026-10-12:official-sources-programs`; o documento da decisão
continua sendo a evidência, sem usar caminho com maiúsculas na coluna SQL.

## Evidência final composta do gabarito MPRJ (migração 0055, 15/10/2026)

**Escrito, revisável e não aplicado.** Nada foi migrado, gravado em produção nem
liberado; a prévia é somente leitura e a admissão continua exigindo prévia e
fingerprint auditáveis. `prepared` não é abertura.

A lacuna é **normativa, não operacional**. O Edital XXXVIII/2025 tinha o subitem
11.7.3 (“com a divulgação dos novos gabaritos, se for o caso”); o **XXXIX/2026 não
tem esse subitem**: vai do gabarito provisório (11.7) ao resultado definitivo
(11.8.2), e 11.1.5 usa “gabarito oficial definitivo” apenas como critério de
pontuação. Logo **não existe gabarito definitivo autônomo da preambular** e ele não
vai existir. A finalidade se comprova por dois documentos oficiais:

| Papel | Documento | Publicado |
|---|---|---|
| Caderno Tipo 1 (100 questões) | `promotor-de-justica-substituto-cns001-tipo-1.pdf` | 01/06/2026 |
| Gabarito Oficial **Preliminar** da Prova Preambular | `mprj-promotor-2026-gabaritos-para-publicacao.pdf` | 01/06/2026 |
| Aviso de 22/06 — julgados os recursos, **mantidos todos os gabaritos** | `22.06-recursos-gabarito-preambular.pdf` | 22/06/2026 |

O aviso de 22/06 invoca o art. 38, IV, da Deliberação CSMP nº 86/2025 e declara
manutenção integral: zero anulação, zero alteração. O aviso de 25/06 (recurso de
nota desprovido sob 11.8.2) é consistente com isso. Prova aplicada em 31/05/2026.

**Modelagem.** Tipo próprio `answer_key_decision` em `exam_edition_documents`,
coluna `exam_editions.answer_key_finality`
(`definitive_document` | `preliminary_plus_maintenance_act`, anulável para as
edições anteriores) e terceiro slot anulável
`contest_product_exam_references.answer_key_decision_document_id` + `…_type`, com
FK composto `(id, exam_edition_id, document_type)`. Alternativas recusadas: deixar
o ato só na auditoria (não entraria na reconferência de link nem na página) e
cadastrá-lo como um segundo `answer_key` (mentiria sobre o tipo e acionaria o
rótulo errado na interface — o relabelamento proibido por via indireta).

**O que o banco não garante.** A coerência entre `answer_key_finality` e o conjunto
de documentos presentes envolve duas tabelas e **não é expressável em CHECK de
tabela única**. Ela é imposta por `src/lib/exams/answer-key-finality.ts` (política
pura), por `validateAnswerKeyFinalityScope` em
`src/lib/exams/admin-exam-reference-policy.ts`, pelo operador
`src/lib/exams/mprj-previous-exam-admission.ts` e pelos testes. O comentário da
migração diz isso onde alguém vá procurar.

**Rótulo derivado do tipo.** `ANSWER_KEY_DOCUMENT_TYPE_LABELS` dá
`GABARITO` ao gabarito e `DECISÃO SOBRE O GABARITO` ao ato; nenhum valor contém
“definitivo”. A página deixou de imprimir `GABARITO` fixo para todo item de
`answerKeys` (`contest-landing.tsx`). Sem o ato, a camada pública **não** mostra o
preliminar sozinho: falha fechada.

**Guardas acrescentadas.** O `--standing` passou a aceitar o par
`mpe-rj-promotor-de-justica-2026=mprj-promotor-substituto-xxxix-2026-preambular`
**somente** enquanto a evidência composta se sustenta na política; o identificador
antigo `…-objetiva`, o sufixo `-preliminar`, a XXXVIII/2025 e qualquer mistura
continuam recusados. Se a FGV publicar um gabarito definitivo da preambular, o
`assertMprjOfficialAnchors` recusa a prévia na hora, antes do fingerprint — o caso
deixa de ser composto e exige decisão própria. Ato com alteração ou anulação de
questão é recusado, não adaptado: é o caso real do XXXVIII/2025 (cinco anulações).

**Sem licença e sem cópia.** Os três documentos são `external_link` +
`metadata_only`, com `source_content_stored: false`; o CHECK novo impede que o ato
seja `hosted_copy` ou `licensed_content`. Nenhuma questão, alternativa, letra de
gabarito ou PDF é copiado, extraído ou armazenado. A quantidade de 100 questões é
metadado declarado com proveniência (`MPRJ_QUESTION_COUNT_CORROBORATION`, capa do
caderno lida em 14/10/2026), **não** extraída do edital nesta execução.

**Grants.** `deploy/grant-app-role.sql` ganhou as duas colunas novas no
`grant insert` de `contest_product_exam_references`. O `grant select` é por tabela
e já alcança colunas novas; o `grant insert` de `exam_edition_documents` já inclui
`document_type`, então o tipo novo não exige grant próprio.

**Pendente, em execução separada e com recibo:** prévia real do operador,
conferência do fingerprint, `--apply`, e depois
`pnpm exams:links:approve --standing` para os três documentos. A migração vai a
produção pelo caminho normal (`deploy/pull-deploy.sh` encadeia as migrations);
nada aqui autoriza rodá-la. O produto segue `draft`, com as 68 questões válidas
ainda exigidas por outro caminho.
