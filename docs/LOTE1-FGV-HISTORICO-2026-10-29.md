# Lote 1 FGV histórico — TJPR, TJBA, TJPE e MPGO (29/10/2026)

Decisão do proprietário em 28–29/10/2026: abrir as preparações restantes por
lotes, começando pelos concursos FGV de magistratura e MP com objetiva já
realizada, em **treino histórico com legislação atual**. Autorização operacional:
`owner-standing-2026-10-12:official-sources-programs` (ver
[AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md](AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md)),
auditoria `owner_standing_authorization`, `humanReview:false`. Nenhuma revisão
humana é presumida.

## Código (branch `codex/lote1-fgv-historico`)

- `official-course-preview-candidates.ts`: quatro receitas novas com **layout
  explícito do anexo** — títulos de disciplina literais (com linha de
  continuação), linhas de cabeçalho/rodapé descartadas por padrões ancorados e,
  para programas em prosa (TJBA, TJPE), separação dos itens numerados da mesma
  linha. Título ausente, repetido, fora de ordem ou continuação divergente bloqueia.
- `composite-course-admission.ts`: alvos com `cycleYear` e `lifecycleStatus`
  (antes fixos em 2026/`result_published`; MPRJ e PGE-AC mantêm os mesmos valores).
  Requisito literal repetido entre disciplinas só passa se a receita o declarar
  (`repeatableRequirements`, caso MPGO "17. Súmulas…"); a fonte guarda a primeira.
- `fgv-historical-previous-exam-admission.ts` + `register-fgv-historical-previous-exam-links.ts`:
  registro genérico, por configuração, de caderno Tipo 1 + gabarito definitivo
  (só metadados), no lugar de um módulo por produto. O fingerprint cobre as
  âncoras conferidas (órgão, edital, rótulos, datas): o portal FGV injeta script
  de CDN com token por requisição e o hash bruto do HTML nunca se repete.
- `official-question-contract.ts`: aceita a cláusula "com somente uma opção correta" (MPGO 12.4).
- `programme-subject-classification.ts`: escopo inclui as quatro oportunidades.
- `source-monitor-policy.ts`: caminhos exatos dos editais e marcos de fase.
- Teste `tests/fgv-historical-lote1.test.ts`.

QA no Mac: lint (0 erros fora de `.maestri/`, diretório privado não versionado),
typecheck, build de produção e suíte geral com 2.042 testes aprovados; 3 falhas
pré-existentes de testes de deploy que exigem Linux/root (mesmas falhas na linha
de base sem esta mudança). Publicação: fast-forward em `/opt/leiprova` e
reconstrução **somente** da imagem `leiprova-opportunity-approver`; app e workers
não foram recriados. Backup prévio:
`/opt/leiprova/backups/before-lote1-fgv-20261029.dump`, SHA-256
`1dec11e4ad5da3b90aee7da437e786c5169d9de605d6bad8703b6ea3bfd3dcc6`.

## Fontes conferidas

| Produto | Edital (SHA-256) | Programa | Formato | Objetiva | Gabarito definitivo |
|---|---|---|---|---|---|
| TJPR 001/2025 | `a14217cc…` 118 p. | p. 75–110, 18 disciplinas | 10.4: 100 MC, 5 alt. | 22/02/2026 | Edital 028/2025 |
| TJBA 01/2026 | `22fba928…` 76 p. | p. 50–66, 14 disciplinas | 9.4: 100 MC, 5 alt. | 24/05/2026 | publicado 25/06/2026 |
| TJPE 01/2026 | `677cfec3…` 72 p. | p. 52–68, 14 disciplinas | 10.4: 100 MC, 5 alt. | 27/09/2026 | **não publicado** |
| MPGO 182/2025-CSMP | `fd02aa8c…` 69 p. | p. 49–63, 10 disciplinas | 12.4: 100 MC, 5 alt. | 01/02/2026 | Comunicado 09 |

Ressalvas registradas nas receitas: o arquivo TJPR chama-se "minuta", mas o
cabeçalho e o portal o identificam como edital retificado em 12/12/2025; as
retificações TJBA citam "Edital de Abertura nº 05/2025"; o edital MPGO cita
aprovação "na 14ª Sessão Ordinária, realizada no dia 15 de outubro de 2025",
posterior à assinatura (22/09) e à publicação (26/09/2025), sem explicação
oficial — a data da sessão não é usada; identidade, banca e programa não dependem dela.

## Aplicação em produção

| Produto | Oportunidade (pública) | Requisitos | Auditoria admissão | Edição-base | Contrato MC5 |
|---|---|---:|---:|---|---|
| tj-pr-juiz-de-direito-2025-2026 | `abaa2e58-94f6-4fa8-8e62-56acff473257` | 386 | 28348 | `tjpr-juiz-substituto-001-2025-objetiva` | `cca2ca82…` |
| tj-ba-juiz-de-direito-2026 | `6499c538-f497-4bd8-903e-79f5eab08a4a` | 326 | 28346 | `tjba-juiz-substituto-01-2026-objetiva` | `e78d358e…` |
| tj-pe-juiz-de-direito-2026 | `47651e54-2255-4eb3-b0d6-6383fefe4b8d` | 331 | 28347 | — | — |
| mpe-go-promotor-de-justica-2025 | `91b8928d-cd05-4ad7-ac06-a9079a235c4c` | 147 | 28345 | `mpgo-promotor-substituto-63-2025-preambular` | `49d19239…` |

Links de prova anterior aprovados pelo `approve-previous-exam-links.ts --standing`
(caderno + gabarito definitivo, `metadata_only`). Classificação de disciplinas:
883 requisitos receberam disciplina canônica; 14 ficaram fora por prova literal
de fragmentos entre páginas, e as disciplinas sem entrada exata no catálogo
(Consumidor, Criança e Adolescente, Noções Gerais, legislação local do TJPR,
Tutela de Interesses Difusos e Legislação do MP no MPGO) não foram classificadas.
A fila só cria autoria para requisito com disciplina.

Após a admissão, o relatório do proprietário mostrou TJPR, TJBA e MPGO bloqueados
**somente** por "0 de 68 questões aprovadas". O TJPE continua também sem prova
anterior aprovada: sem gabarito definitivo não há edição-base nem contrato de
formato, então recebe mapeamentos mas não autoria. Quando a FGV publicar o
gabarito definitivo, acrescentar o documento à receita/registro e repetir o
cadastro, o contrato e a classificação já preparada.

Recibos privados: `/opt/leiprova/.local/editorial/lote1-fgv-20261029/`
(`preview/`, `apply/`, `prev-exam/`, `contracts/`, `classify/`).
