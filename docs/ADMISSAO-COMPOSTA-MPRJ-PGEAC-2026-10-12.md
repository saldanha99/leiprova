# Admissão delimitada de programas compostos — MPRJ e PGE-AC

Operador novo `scripts/admit-composite-official-course.ts`, separado da admissão
MPMT. Estado deste documento: **implementado e testado em prévia/simulador de
transação; nenhuma admissão no banco executada por este trabalho**.

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
oral/discursiva. Caderno e gabarito definitivo de prova anterior são verificados
pelo verificador oficial existente, sem armazenar/extrair seu conteúdo; permanecem
links externos **pendentes de aprovação para o produto**. Direitos de reprodução
não são presumidos.

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
