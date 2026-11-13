# Lote 2 FGV histórico — TJGO e TRF-2 (13/11/2026)

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
