# Revisão automatizada parcial da Lei 14.133 — 12/10/2026

O operador `scripts/review-standing-procurement-law.ts` é distinto do operador LGPD e somente aceita a Lei 14.133/2021, seu monitor Senado `33382036`, o PDF compilado exato da Câmara e o parser `camara-procurement-pdf-unpdf1.8.1-v1.0.0`. Ele prepara uma versão com **191 artigos preservados**, dos quais **182 recebem `reviewed` e nove permanecem `pending_review`**. A captura textual é marcada aprovada com notas e auditoria explicitamente **parciais**; isso não equivale a aprovação dos 191 artigos para treino/autoria.

Autorização: `owner-standing-2026-10-12:official-sources-programs`, documentada em `AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md`. Auditoria `owner_standing_authorization`, `humanReview:false`; conferência posterior permanece necessária. Este documento descreve código, não um recibo de execução em produção.

## Pendências efetivamente preservadas

| Artigo inteiro pendente | Motivo |
|---|---|
| 6, 37, 70, 95, 184-A | Dependência dos valores anuais ainda não integrada ao corpus de autoria |
| 75 | Mesma dependência monetária e inteiro teor primário da ADI 6890 não revisado |
| 175 | Prazo do §2 encerrado em 2023 exige contexto temporal |
| 191 | Escolha de regime licitatório antigo encerrada; sobrevivência contratual requer contexto |
| 193 | Revogação em 2023 requer contexto temporal |

Nenhum desses nove artigos é convertido em `reviewed`, nem removido do literal. Os consumidores de treino, biblioteca, materiais, autoria e vínculos exigem `legal_articles.editorial_status='reviewed'` e versão atual. A partição utiliza esse controle existente, sem inventar um gate apenas documental. A liberação futura das nove pendências exige outro escopo de revisão efetiva; repetir este operador não altera essa decisão.

## Prova delimitada dos vetos

O dossiê privado `licitacoes-reconciliacao-20261012` conferiu 11 segmentos em promulgações oficiais de 10/06/2021,21/05/2024 e01/07/2025. Hashes, URLs e datas das três capturas, mais hashes dos segmentos, estão no helper; o corpo integral privado não acompanha a aplicação. O rótulo isolado “Mantém Veto” na ficha do art.54 §1 não apaga a disposição promulgada. A execução confere os 11 segmentos do snapshot, exige o corpus completo já confrontado, recaptura o PDF e compara seu hash bruto. Não declara nova captura das páginas de promulgação nem revisão humana.

- SHA-256 do PDF bruto: `55643452fd720ee726267f62ad2ee59bff0120c5ec9495b9ee7babc74c5ea026`.
- SHA-256 do corpus canônico: `e622788d8a7da96d4e77deb8a1ea458ca1014fc44a8dd8a86df310d02a598e8a`.
- SHA-256 do dossiê privado: `7bf19c75cb52d961a06ba4640f5d2819c1695ab4801ee368d4c81f46dc85dfd0`.

Mudança até mesmo nos bytes do PDF exige reconciliação nova; texto aparentemente igual não autoriza atualizar a prova automaticamente. Valores nominais do texto legal são preservados; não são trocados pelos limites de 2026. O Decreto12.807 e a ADI não são ativados por este comando.

## Operação na VPS

Usar `MIGRATION_DATABASE_URL` de manutenção já existente, papel `leiprova_owner` e banco `leiprova`, nunca URL de aplicação. `LEGAL_STANDING_REVIEW_REFERENCE` deve conter a referência exata acima. `ADMIN_EMAILS` deve identificar um único administrador; vazio exige exatamente um administrador no banco. O comando não modifica grants ou flags comerciais.

Inspeção sem rede e sem escrita:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/review-standing-procurement-law.ts --inspect snapshot=<UUID>
```

A saída indica `wouldReviewArticleCount:182`, `wouldDeferArticleCount:9`, checksum e fingerprint. Esses valores são a proposta, não comprovam que a revisão ocorreu.

Prévia com acesso oficial fresco, zero escrita:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/review-standing-procurement-law.ts --standing snapshot=<UUID> checksum=<SHA> fingerprint=<SHA> rawpdf=55643452fd720ee726267f62ad2ee59bff0120c5ec9495b9ee7babc74c5ea026 dossier=7bf19c75cb52d961a06ba4640f5d2819c1695ab4801ee368d4c81f46dc85dfd0
```

Somente adicionar `--apply` após conferir a prévia concreta e o corte na VPS correta. O proprietário já autorizou a revisão automatizada; isso é um procedimento operacional de conferência, não uma nova exigência de permissão humana. Não aplicar no banco antigo congelado.

O Senado e o PDF Câmara são buscados fora da transação. Robots Câmara é conferido com identificador honesto, TLS regular, URL exata, ausência de redirects, MIME e assinatura PDF, limites de bytes/páginas e timeout. Erros HTTP/403/429 bloqueiam; não existe alternativa silenciosa. As duas fontes devem coincidir integralmente com os snapshots e ter no máximo cinco minutos. Uma transação serializable curta trava ato e snapshots, revalida identidade/fingerprint/conteúdo/frescor e administrador único antes de qualquer mutação.

A auditoria `editorial.legal_text.partially_approved` registra 191 capturados,182 revisados,9 pendentes, motivos, rawPDF, dossiê e prova dos11 vetos. O snapshot usa `approved` somente acompanhado de nota explícita de revisão parcial; a disponibilidade depende dos estados dos artigos. Um recibo exato e uma versão atual com 182 reviewed/9 pending iguais permitem `unchanged`. Alteração de direitos, texto, ordem, estados, razões, corpus, provas ou versão impede repetição; não restaura suspensões nem libera os nove pendentes.

Não aprova questões, programas, vínculos comerciais ou produtos e não cria prova de cobrança Stripe. Nenhum apply ou escrita de banco foi executado durante a implementação.
