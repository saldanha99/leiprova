# Curadoria editorial por produto

Implementação de 06/09/2026, implantada em `b55327a`. Foram importadas 46 propostas
pendentes, nenhuma aprovada. Veja [resultado e limites da operação](OPERACAO-CONTEUDO-REEMBOLSOS-2026-09-06.md).

## Regra de acesso

Uma compra individual concede acesso somente às questões com vínculo **aprovado para o `productSlug` comprado**. Duas ofertas de cargos diferentes podem compartilhar a mesma oportunidade oficial sem compartilhar automaticamente seu acervo. `question_opportunities` continua sendo contexto editorial legado, não uma concessão comercial de acesso.

O vínculo precisa de produto/oportunidade, requisito específico, documento e captura quando existente, artigo e versão oficiais vigentes, citação literal do requisito, citação legal e justificativa de aderência. Uma afinidade de banca ou de disciplina não equivale a cobertura integral do edital.

Na leitura, o servidor revalida a revisão da questão/requisito/oportunidade, a fonte aprovada, versão legal vigente, conteúdo e alternativas exatos, mapeamento de disciplina/tópico/artigo, e perfil/banca efetiva no modo inédito. Mudanças materiais ou suspensão fecham o vínculo. Compra expirada, futura ou revogada não concede acesso. O Master Stripe exige estado `active`, período iniciado e ambos os términos finitos no futuro; `trialing`, período desconhecido e `infinity` não concedem Master. Provedores explícitos `synthetic_test`/`manual` também precisam de término finito.

As questões demonstrativas gratuitas continuam gratuitas. Essa regra não torna secreto o texto público da legislação nem remove a demonstração gratuita existente.

## Operador de propostas

Tabela: `contest_product_question_bindings`, migration `0033_product_question_curation`. Não há backfill, aprovação, publicação ou vínculo comercial automático. O importador permanece limitado a criar propostas. A revisão humana administrativa descrita abaixo acrescenta somente os campos de decisão aos grants do aplicativo; não permite alterar evidências nem apagar vínculos.

Contrato JSON, sem `status` ou campos de revisor:

```json
{
  "schemaVersion": 1,
  "items": [{
    "productSlug": "enam-exame-nacional-da-magistratura-2026-2",
    "opportunityPublicId": "e2a89a5e-fdb4-415d-b988-55756c5c1aef",
    "requirementId": 7,
    "questionPublicId": "IDENTIFICADOR_REAL_DA_QUESTAO_NO_BANCO",
    "requirementQuote": "CITAÇÃO LITERAL DO REQUISITO SELECIONADO",
    "legalQuote": "CITAÇÃO LITERAL DO ARTIGO OFICIAL VINCULADO À QUESTÃO",
    "scopeNotes": "Justificativa específica do que a questão cobre e do que não cobre; revisão humana ainda necessária."
  }]
}
```

O exemplo contém marcadores, não é um lote executável. Confirme os IDs no destino atual; não transforme o exemplo em autorização de revisão. Uma proposta pode referenciar requisito ainda em rascunho ou produto ainda sem mapeamento oficial, mas será listada com bloqueios e nunca fará esse mapeamento por conta própria. Questões suspensas, fontes legais não vigentes e citações inexistentes são rejeitadas.

Localmente, o JSON fica em `.local/editorial/`. Execute `pnpm editorial:bindings:import --input=CAMINHO --actor=UUID --mode=preview` com `LEIPROVA_BINDING_DATABASE_URL` explícita do banco permitido. Depois de conferir, use `--mode=import-pending --fingerprint=SHA256_DO_PREVIEW`. O operador precisa ser admin/editor existente, mas é registrado **como proponente**, nunca como revisor. Nenhuma atestação editorial anterior, inclusive a do lote de 160, é reaproveitada como aprovação desta curadoria.

Em produção, o serviço manual `editorial-binding-importer` lê exclusivamente `/binding-input/proposals.json`, volume somente leitura de `.local/editorial/binding-input`. Exige `LEIPROVA_BINDING_IMPORT_APPROVED=import_pending_bindings` e papel `leiprova_app` no pooler do LeiProva. O mesmo contrato de preview/impressão digital permanece obrigatório. Não é serviço contínuo ou publicador e não gera cobrança em provedores de IA.

Uma reexecução do mesmo conteúdo/contexto reutiliza a identidade, não duplica auditoria nem rebaixa eventual revisão futura. Contexto ou conteúdo alterado produz nova proposta; mudança entre preview e aplicação aborta. Novos rascunhos podem ser propostos agora, mas sua revisão posterior exige atualizar o dossiê/proposta antes de uma decisão de curadoria.

## Revisão humana administrativa

O caderno `/admin/catalogo-produtos` oferece **Revisar vínculos deste produto**, em `/admin/catalogo-produtos/[slug]/vinculos`. A página e a Server Action exigem `requireSuperAdmin`; o ator vem exclusivamente da sessão, nunca do formulário. A origem deve coincidir com `APP_URL` (ou `NEXT_PUBLIC_APP_URL`), com HTTPS em produção. Não existe endpoint público de aprovação.

O revisor prepara uma decisão para **um vínculo, um produto e uma edição exatos**, com nota de 20–2.000 caracteres. A prévia é somente leitura e mostra questão autoral/alternativas/gabarito registrado, cargo, banca, edição, requisito, citações, versões, hashes e bloqueios. Questões de terceiros ficam ocultas. Na segunda etapa, os três checks de identidade da edição, programa/fontes e aderência vêm desmarcados. Proposta própria permanece sujeita à política de revisão independente e à exceção proprietária explícita já existente.

A aplicação recalcula SHA-256 incluindo ator, IDs, nota, decisão e contexto completo, sob locks e transação serializável. Alteração entre prévia e decisão exige nova conferência. Aprovar exige a regra completa de elegibilidade e revalidação após a gravação; falhas revertem a transação. Rejeitar altera somente o vínculo selecionado, não a questão globalmente nem seus vínculos em outros produtos. Sem edição identificada, não se presume uma edição para decidir.

Este fluxo **não revisa juridicamente uma questão em rascunho, não aprova requisito/documento, não associa produto à oportunidade, não publica produto e não abre checkout**. A seleção/publicação, o mínimo de 68 questões distintas válidas e demais liberações continuam etapas separadas. O piloto previsto é ENAM 1:1; não distribuir questões indiscriminadamente aos 75 produtos. Nenhuma aprovação editorial é registrada apenas por uma execução de IA.

Para a operação, migration `0036_product_binding_review_lock` e grants precisam estar aplicados no destino correto. A função `public.lock_product_binding_review_product(text)` bloqueia uma única linha validada, sem DML, com `search_path` fixo, timeout e execução pública revogada; o app recebe somente `EXECUTE`, **não UPDATE no catálogo**. Para a decisão, os únicos novos campos graváveis são `status`, `reviewed_by_user_id`, `reviewed_at`, `review_notes` e `updated_at` de `contest_product_question_bindings`. Auditoria usa INSERT já autorizado. Privilégio ausente falha fechado, sem credencial alternativa.

A existência desta UI no código não prova implantação, revisão humana concluída ou disponibilidade comercial dos produtos.

`listReleasedContestProducts` também exige o vínculo comercial aprovado. Publicar só o schema não abre produtos nem habilita checkouts. A revisão editorial de questões já aprovada é preservada pelo novo operador.

## Verificação e homologação

`tests/product-binding-policy.test.ts` cobre contrato/destinos/citações. `tests/product-binding-postgres.test.ts` usa somente servidor exclusivo `127.0.0.1:55441/leiprova_binding_test`, papéis `leiprova_binding_owner` e `leiprova_binding_app`, schema migrado e grants de produção. Stripe, clientes, editais e textos desse teste são fictícios; não envia e-mails ou WhatsApp.

Verificação executada: **35 testes passaram**, sendo 25 de integração PostgreSQL e 10 de contrato. Também passaram typecheck e lint dos arquivos alterados. Isso verifica o código no sandbox, não substitui homologação end-to-end de compra e entrega na Stripe.

Na etapa da UI, passaram **74 testes focais** (policy, serviço, autorização/origem, consulta e apresentação) e **12 testes PostgreSQL reais** da função de lock com papel restrito em cluster temporário exclusivo `127.0.0.1:55447/leiprova_binding_lock_test`. O cluster foi encerrado após a verificação. Prévia visual estática do componente real e CSS atual foi conferida via `agent-browser` em 1440×1000 e 390×844, sem overflow e com confirmações desmarcadas; usa apenas dados sintéticos, sem sessão, banco ou submissões reais. Typecheck e lint focal passaram. Esta verificação não atesta aplicação real de uma decisão administrativa nem substitui homologação autenticada após o deploy.

Fixtures persistentes de QA receberam vínculos aprovados **sintéticos** e perfil/organizador fictícios explícitos, apenas no bootstrap já restrito ao banco separado. Após levar a migração à homologação, aplicar também os grants e o bootstrap sintético é necessário para manter os testes Alfa/Beta. Nenhum conteúdo real deve passar pelo helper `synthetic-product-bindings`.

Durante a preparação ocorreu um desvio de destino **local**, documentado integralmente em [relato da migração](RELATO-MIGRACAO-LOCAL-2026-09-06.md). Nos testes de migração, fixar sempre **ambas** `DATABASE_URL` e `MIGRATION_DATABASE_URL`, e confirmar banco/porta antes de qualquer gravação.
