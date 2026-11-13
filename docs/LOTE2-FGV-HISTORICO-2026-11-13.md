# Lote 2 FGV histórico — TJGO, TRF-2, TJMS, TJRJ e TJMS Cartórios (13/11/2026)

Pedido do proprietário em 12–13/11/2026: começar a admissão dos editais e provas
dos 63 rascunhos, pelo lote FGV com objetiva realizada e gabarito definitivo.
Mesmo caminho do [lote 1](LOTE1-FGV-HISTORICO-2026-10-29.md): treino histórico com
legislação atual, autorização `owner-standing-2026-10-12:official-sources-programs`,
auditoria `owner_standing_authorization`, `humanReview:false`. Nenhuma revisão
humana é presumida.

Pesquisa de pistas por dois agentes Haiku (dossiês privados em
`.local/editorial/dossies-haiku-20261113/`); nenhuma pista foi usada como evidência.
Cada fonte abaixo foi capturada pela política oficial existente e conferida no PDF.

## Fontes conferidas

| Produto | Edital (SHA-256) | Programa | Formato | Objetiva | Gabarito definitivo |
|---|---|---|---|---|---|
| TJGO 59º — Edital 01/2025, consolidado 13/01/2026 | `fbac0aa8…` 62 p. | Anexo II, p. 43–58, 14 disciplinas | 12.5: 100 MC, 5 alt. | 29/03/2026 (12.1) | portal, 28/04/2026 |
| TRF-2 XIX — Edital 154/2025, retificado pelo 157/2025 | `e6c210d1…` 58 p. | Anexo I, p. 30–56, 15 disciplinas | 12.5: 100 MC, 5 alt. | 12/04/2026 (12.1) | portal, retificado 06/05/2026 |

A data da objetiva vem do edital (`actualDayIndependentlyVerified:false`): o texto do
gabarito não é extraído, pela política de material de prova. Caderno Tipo 1 e
gabarito definitivo foram publicados depois das datas previstas. A 1ª retificação do
TJGO só altera o item 6.3.2; a do TRF-2 altera datas das etapas seguintes. Nenhuma
das duas muda o programa.

No TRF-2, o título "DIREITO FINANCEIRO E TRIBUTÁRIO" só agrupa as duas disciplinas.
Os subtítulos A)–H) de Noções Gerais e as notas de inclusão por resolução também não
viram requisitos. A oportunidade fica com escopo `regional` e jurisdição RJ, como o
TRF-5.

## Aplicação em produção

Backup prévio: `/opt/leiprova/backups/leiprova-20261113T022117Z.dump`, SHA-256
`1ba044e9ad9d9bf5e22618e6b632d4315b92767bc6fbc71cdee495e560ae824d`.
Código: `62e1e10` e `043f02f`. Só as imagens `opportunity-approver` e
`editorial-binding-importer` foram reconstruídas.

| Produto | Oportunidade (pública) | Requisitos | Classificados | Contrato MC5 |
|---|---|---:|---:|---|
| tj-go-juiz-de-direito-2026 | `490d499b-db72-471b-8a47-e5e958a13b86` | 238 | 156 | `18d26048…` |
| trf-2-juiz-federal-2-regiao | `caead5b1-7aba-4306-99b4-7a35e377bda2` | 218 | 160 | `e6a7135f…` |

Links de prova anterior (caderno Tipo 1 e gabarito definitivo, `metadata_only`) foram
registrados e aprovados por `approve-previous-exam-links.ts --standing`. Ficaram sem
classificação os requisitos cuja disciplina não tem entrada exata no catálogo:

- TJGO: Consumidor, Criança e Adolescente, Tributário e Financeiro (título invertido em
  relação ao catálogo) e Noções Gerais.
- TRF-2: Internacional (título literal diferente) e Noções Gerais.
- Três requisitos que atravessam páginas, sem prova literal por fragmentos.

Depois da aplicação, o relatório do proprietário mostra TJGO e TRF-2 bloqueados
**somente** por "0 de 68 questões aprovadas". Os dois entraram no foco do motor
(`EDITORIAL_FOCUS_PRODUCTS`).

Recibos privados: `/opt/leiprova/.local/editorial/lote2-fgv-20261113/`
(`vps-preview-*`, `apply-*`, `contracts/`, `classify/`) e
`.local/editorial/fgv-historical-previous-exam-previews/lote2-*`.

## Segunda parte — TJMS e TJRJ (servidores)

Os dois editais trazem vários cargos no mesmo anexo e programa em prosa. O extrator
ganhou recursos para isso (`951ceea`, `128ba79`):

- `stopLine`: a extração termina na linha literal que abre o cargo seguinte. A linha é
  obrigatória, e a extração bloqueia se ela não aparecer.
- `itemMode: "sentences"` (TJMS): cada período literal vira um requisito.
- `itemMode: "top-level-numbers"` (TJRJ): o número de primeiro nível abre o item, e os
  subitens 1.1, 1.2.1 etc. ficam dentro dele.
- `skipRepeatedRequirements`: guarda só a primeira ocorrência de um literal repetido.
- Glifos de uso privado colados aos títulos (U+F034 no TJMS) não contam como texto do
  título.

| Produto | Cargo admitido | Edital (SHA-256) | Objetiva | Requisitos | Classificados | Contrato MC5 |
|---|---|---|---|---:|---:|---|
| tj-ms-analista-judiciario-area-fim-reta-final | Analista Judiciário - Área Fim (XI Concurso, Edital 01/2025) | `c7cab526…` 41 p. | 25/01/2026, 60 questões, 5 alt. | 417 | 375 | `a03ae3b6…` |
| tj-rj-analista-e-tecnico-2025 | Analista Judiciário – Sem Especialidade (LXII, Edital 01/2025) | `61b3eacc…` 83 p. | 01/02/2026, 70 questões, 5 alt. | 117 | 90 | `b6a6a710…` |

Oportunidades: TJMS `b3f5c5f7-a411-4cf4-a157-627d1280c9f4` e TJRJ
`8bacb802-758a-4733-9f85-d3882eb71a1b`. As duas ficam na categoria `tribunais`, a mesma
do catálogo. Caderno Tipo 1 e gabarito definitivo foram registrados e aprovados
(`metadata_only`).

Ficaram sem classificação os requisitos destas disciplinas, que não têm entrada exata
no catálogo:

- TJMS: Língua Portuguesa e Noções de Legislação.
- TJRJ: Língua Portuguesa, Legislação Especial, PcD, Ética e Legislação.

Também ficaram de fora 9 períodos do TJMS sem prova literal por fragmentos e 1 item do
TJRJ. O TJRJ cobre só o cargo sem especialidade: as especialidades e o Técnico (Edital
02/2025) não foram admitidos.

Backup anterior: `backups/leiprova-20261113T032404Z.dump`, SHA-256
`50dc33ca8f80684c2c840441171b0c3c3e848ebc7252afbddc4ba3b7a4bb6899`.

## Terceira parte — TJMS Cartórios (VI Concurso de Notas e de Registro)

Edital 01/2025, 2ª publicação com retificação (16/10/2025), `765407ef…`, 74 p.; Anexo II
nas p. 53–68. A objetiva de ingresso por provimento foi em 01/03/2026 (item 10.2), com
100 questões e 5 alternativas (item 10.9). O Edital 04/2025 só corrige o Anexo I (serventias).

O anexo traz os títulos no início do parágrafo ("DIREITO CIVIL. Lei de…"). O extrator ganhou
`inline: true` por título (`0dbc59e`): o título abre a seção e o resto da linha é o primeiro
período. Na classificação, o nome literal é o prefixo em maiúsculas antes do ponto. O título
"DIREITO NOTARIAL E REGISTRAL" leva o glifo U+F034, preservado como no TJMS Área Fim.

Como o TJMS Área Fim já usa sigla, edital 01/2025 e ano 2025, o número oficial desta
oportunidade é `01/2025-Notarial` (`85e4394`), no padrão do MPGO (`182/2025-CSMP`). A
proteção contra duplicidade não foi afrouxada.

| Produto | Oportunidade | Requisitos | Classificados | Contrato MC5 |
|---|---|---:|---:|---|
| tj-ms-cartorios-reta-final | `a20215e4-027f-489d-b064-2c5dafa14ca8` | 1.143 | 747 | `03936edd…` |

Caderno Tipo 1 (provimento, 02/03/2026) e gabarito definitivo republicado (07/05/2026)
foram registrados e aprovados (`metadata_only`). Ficaram sem classificação as seções
notariais e registrais, as leis e atos normativos locais, Conhecimentos Gerais e a
legislação especial, que não têm entrada no catálogo. Também ficaram de fora 3 períodos
que atravessam páginas sem prova literal. Backup anterior:
`backups/leiprova-20261113T164834Z.dump`, SHA-256
`bd5aa33726a31fc2707892a6c9a54973e44e1cedea481c2e5db032fd66d57276`.

## TRT-24 — não admitido

A anulação do Edital 01/2024 (comunicado de 26/08/2025, PROAD 18693/2023) tratava da
distribuição das vagas de cotas raciais. O CSJT suspendeu a anulação (PCA
1000876-34.2025.5.90.0000, 23/09/2025), e o Pleno do TRT-24 a reformou por unanimidade em
06/10/2025 (PROAD 4437/2025). O concurso foi mantido válido. A objetiva de Analista
Judiciário (manhã de 09/03/2025) foi reaplicada porque não seguia a 1ª retificação. A de
Técnico Judiciário não foi reaplicada.

A admissão continua bloqueada por dois motivos:

- A 1ª retificação (21/11/2024) altera o programa por exclusões parciais ("(...)") e trocas
  "Onde se lê / Leia-se" dentro das disciplinas. O admissor composto só substitui
  disciplinas inteiras; seria preciso um recurso de retificação item a item.
- A 2ª retificação (`retificacao-13.02.pdf`) é recusada pela política de captura ("não
  identificado como edital"), e o efeito dela no programa não pode ser provado. A recusa não
  foi contornada.
