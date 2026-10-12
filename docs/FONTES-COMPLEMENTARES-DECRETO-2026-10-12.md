# Decreto 12.807: persistência e consumo de fontes complementares

O operador `scripts/approve-procurement-supplementary-sources.ts` prepara a aprovação automatizada do corpo do Decreto 12.807/2025 e do anexo, como **duas fontes com IDs próprios**. Não modifica o literal da Lei 14.133, os 182 artigos revisados, os nove artigos pendentes, questões, vínculos ou produtos. Código disponível não comprova aplicação: somente os IDs e o recibo devolvidos por uma execução real provam a revisão.

## Evidência e limites

Fontes exatas: [corpo](https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-publicacaooriginal-177646-pe.html), [anexo oficial](https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-anexo-pe.pdf) e [situação da norma](https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-norma-pe.html). O corpo tem cinco artigos; o anexo é a tabela de nove dispositivos, na página 17 do DOU de 30/12/2025, compartilhada com outros decretos. A extração PDF recorta a região conferida por coordenadas e só aceita o arquivo bruto exato; não importa o restante da página. As células são reconstruídas preservando valores e descrições, com espaços normalizados. Cabeçalho de identificação normalizado não se apresenta como redação de artigo da Lei 14.133.

| Evidência | SHA-256 bruto | SHA-256 normalizado pertinente |
|---|---|---|
| Corpo | ba0e69a80dcee00a68793e9dd52ef323654b2b6921cddcb6610bd05bdf50b1c1 | 5c4c9f103ef230574bb034709ae8b377d8447e95ae604be0f0e137ed2c9f24b0 |
| Anexo | 6d12b7f6adb3d6b65ecf5da44ec54eb8b201c7c90a75499d21cbba38841b2fb9 | ddbdd639d2139bb56d156267d4ca875a4e56e97e4cc3e2764a4a8ae94906fe7e |
| Ficha | 64bba0bf0f12c09cd0ac59c686f1b35fb5e55a440cbc3a3527b2e79a5f3b5df6 | não substitui corpo/anexo |

O acesso usa TLS normal, identidade honesta, robots Câmara, URL exata, ausência de redirects, MIME e limites de bytes. Erro HTTP200,403/429, PDF novo, descrição alterada, linha ausente ou mudança da ficha bloqueiam a operação. Não há espelho, proxy, fingimento de navegador ou aprovação por similaridade. A ficha observada informa ausência de revogação expressa: é uma observação datada, sem promessa de validade futura.

`normative_effective_from=2026-01-01`, `normative_valid_until=NULL`. A cobertura editorial é `2026-01-01..2026-12-31`, num campo diferente: não declara que o decreto expire juridicamente em 31/12/2026. Os nove valores ficam em centavos inteiros, com dispositivo exato e representações do anexo. O limite base não substitui condições legais, agregação ou duplicação aplicável, como art.75 §3. ADI/recontratação permanecem excluídas.

## Integração de schema e permissões pelo operador principal

Arquivos novos: `drizzle/0053_legal_complementary_sources.sql` e `src/lib/db/schema-complementary.ts`. O módulo utiliza FK para ato alvo 14.133 e usuários/auditoria existentes, preservando todos os IDs. Corpo/anexo possuem origem, parser, raw/body hashes, fatos, fingerprint, datas, estado, revisor e `approval_audit_id` próprios. Os dados aprovados são imutáveis; mudanças exigem outra versão auditada. Fonte suspensa/rejeitada/superada não é restaurada automaticamente.

O operador principal integra o export após sua QA:

```ts
export { legalComplementarySources } from "./schema-complementary";
```

Depois de registrar/aplicar 0053 pela rotina normal e confirmar a propriedade da tabela pelo papel de manutenção, adicionar somente à lista SELECT do script de grants:

```sql
grant select on legal_complementary_sources to :app_user;
```

Não dar APP INSERT/UPDATE/DELETE, acesso à sequência ou função privilegiada. RLS permite SELECT apenas de linhas `approved` com `last_verified_at` dentro de seis horas; manutenção usa o proprietário existente. Export, journal e grants foram integrados e aplicados pelo operador principal na revisão234daeb. Os12 testes PostgreSQL reais de constraints/RLS passaram antes da aplicação.

## Operação e recibos reais

**Aplicado em12/10/2026:** corpo ID1, público
`a4537c02-594a-4f06-8cf2-82b029e9dd41`; anexo ID2, público
`bf60d8aa-584e-45d5-890b-2ccebcb0b3ca`. Auditoria real **7176**,
`editorial.legal_complementary_sources.approved`, ato alvo22, fingerprint
`eadebca092a414eb45c5fb77b0ee9457ea6143c5af4c6095685d742fed6db5e0`.
O monitor recapturou o par e a ficha às07h35m49s UTC, auditoria **7177**,
`editorial.legal_complementary_sources.verified`, saída0. Metadados JSONBobjeto,
`humanReview:false`; nenhuma questão/artigo foi aprovado por essas operações.
Os nove artigos da Lei14.133 continuam pendentes; integração com Autor/acesso
continua sendo uma etapa separada. Recibos privados em
`/opt/leiprova/backups/decree-complementary-applied-20261012.json` e
`/opt/leiprova/backups/decree-monitor-first-run-20261012.log`.

Exige `MIGRATION_DATABASE_URL` de `leiprova_owner` no banco `leiprova`, administrador único e `LEGAL_STANDING_REVIEW_REFERENCE=owner-standing-2026-10-12:official-sources-programs`. A decisão permanente do proprietário autoriza revisão automatizada; a auditoria registra `owner_standing_authorization` e `humanReview:false`.

Prévia, acesso oficial fresco, zero escrita:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/approve-procurement-supplementary-sources.ts
```

Aplicação concreta, depois de conferir o fingerprint produzido na prévia na VPS correta:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/approve-procurement-supplementary-sources.ts --apply fingerprint=<SHA-exato-da-previa>
```

Toda a rede ocorre antes da transação. O fingerprint liga provas das três fontes, fatos/períodos e identidade do ato alvo. Captura deve ter menos de cinco minutos; transação serializable com timeout trava o ato, revalida identidade, administrador e fontes existentes antes de escrever. A auditoria `editorial.legal_complementary_sources.approved` é gravada no mesmo commit das duas fontes; cada linha aponta para o recibo, com UUID público previamente registrado. A saída traz os dois IDs numéricos reais e o auditID. Drizzle recebe objetos JSONB, não strings serializadas como se fossem objetos.

Repetição só produz `unchanged` se houver exatamente o mesmo par aprovado, mesmo fingerprint, literal/hashes/fatos/períodos/direitos de origem, metadado de situação e recibo com os UUIDs do par. Não apaga nem restaura uma fonte alterada, suspensa ou aprovada por outro caminho.

## Uso pelo Autor: conexão implementada, liberação ainda separada

`src/lib/official-sources/decree-complementary-query.ts` oferece `readApprovedDecreeAuthoringContext(db, legalActId, input)`. Busca dois IDs aprovados, verifica origem/parser/raw/body/fatos/períodos/auditoria e adiciona recibos reais ao pacote preparado. Recusa ID ausente, fonte pendente/suspensa, par de auditorias diferente e alteração da prova. Retorna `approved_dependency_context` e `contentFingerprint` sobre literal/base legal, foco/valor/data do caso, IDs/URLs/raw/body hashes, fingerprint e recibos reais. A ordenação do par é estável. Atualização do lease não muda o conteúdo; frescor é validado separadamente em cada consumo. Mantém `publicationAllowed:false`, `lawArticleReviewStillRequired:true` e `questionApprovalStillRequired:true`.

O contrato de autoria deve consumir essa função e persistir os dois IDs/fingerprint/recibos como dependências de cada questão monetária, além do artigo/versão da Lei14133, chave de dispositivo e exercício 2026. O comando **não liga essa função à fila do Autor e não aprova os nove artigos pendentes**. Antes dessa liberação, o operador principal deve integrar o contrato, suas certificações e as consultas que validam dependências. Um campo no payload sem validação efetiva não basta. Os contextos 175/191/193 exigem fontes temporais próprias; o decreto não os autoriza.

## ADI 6890 permanece sem íntegra

Novas rotas públicas oficiais verificadas em 12/10/2026: pesquisa de inteiro teor do portal STF respondeu 403; `digital.stf.jus.br/publico/publicacoes` respondeu 403; `jurisprudencia.stf.jus.br/pages/search` falhou sem corpo/HTTP detalhado na ferramenta. Robots dessas rotas não ficou acessível. O índice oficial localiza a publicação DJe 18/09/2024, mas não forneceu a íntegra PDF. Limitação registrada em `.local/editorial/licitacoes-reconciliacao-20261012/adi6890-access-alternatives.json`, com URLs, datas e status, sem hash inventado e sem substituir a decisão pela ficha Câmara.


## Verificação contínua: implementação e agendamento ainda necessários

O LegalMonitor que lê o snapshot Senado da Lei 14.133 não observa automaticamente as três URLs do decreto. Há um comando separado, `scripts/verify-procurement-supplementary-sources.ts`, padrão prévia sem escrita, e `--apply` para execução pelo worker de manutenção. O operador principal deve vinculá-lo à rotina existente do LegalMonitor; recomenda-se execução a cada hora. Não houve instalação de cron, recibo de rotina ou promessa de autoria 24/7 durante esta implementação.

O verificador recaptura corpo/anexo/ficha por acesso regular. Se as provas forem idênticas e o recibo ainda corresponder, renova `last_verified_at` e grava auditoria `editorial.legal_complementary_sources.verified`, com IDs reais e observação datada. Qualquer divergência, indicação de revogação ou impossibilidade de conferir suspende o par e registra `editorial.legal_complementary_sources.suspended`. Falha de transporte não é declarada revogação: o motivo é dependência oficial não verificada. Não renova lease de fonte pendente/suspensa nem a reativa.

Mesmo com o worker parado, RLS e o consumidor recusam fontes cuja última verificação seja mais antiga que seis horas. Isso é lease editorial, não prazo de vigência normativa. Pacote do Autor carrega último horário verificado, prazo desse lease e fingerprint. A publicação/certificação e o acesso a questões dependentes devem conferir novamente o estado/lease e IDs atuais: um pacote antes válido não autoriza publicação ou acesso posterior ao vencimento/suspensão. Essas ligações à fila, certificação e acesso continuam obrigação de integração do operador principal antes de liberar os nove artigos.

A suspensão mantém dados e recibos antigos. Reativação requer outro processo explícito de reconciliação e versão auditada; este worker não faz restauração automática. O operador de aprovação também não deve fingir nova versão sobre uma fonte suspensa com o mesmo fingerprint.
