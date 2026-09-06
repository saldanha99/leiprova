# Curadoria editorial por produto

Implementação local de 06/09/2026. Este documento não declara publicação ou aprovação em produção.

## Regra de acesso

Uma compra individual concede acesso somente às questões com vínculo **aprovado para o `productSlug` comprado**. Duas ofertas de cargos diferentes podem compartilhar a mesma oportunidade oficial sem compartilhar automaticamente seu acervo. `question_opportunities` continua sendo contexto editorial legado, não uma concessão comercial de acesso.

O vínculo precisa de produto/oportunidade, requisito específico, documento e captura quando existente, artigo e versão oficiais vigentes, citação literal do requisito, citação legal e justificativa de aderência. Uma afinidade de banca ou de disciplina não equivale a cobertura integral do edital.

Na leitura, o servidor revalida a revisão da questão/requisito/oportunidade, a fonte aprovada, versão legal vigente, conteúdo e alternativas exatos, mapeamento de disciplina/tópico/artigo, e perfil/banca efetiva no modo inédito. Mudanças materiais ou suspensão fecham o vínculo. Compra expirada, futura ou revogada não concede acesso. O Master Stripe exige estado `active`, período iniciado e ambos os términos finitos no futuro; `trialing`, período desconhecido e `infinity` não concedem Master. Provedores explícitos `synthetic_test`/`manual` também precisam de término finito.

As questões demonstrativas gratuitas continuam gratuitas. Essa regra não torna secreto o texto público da legislação nem remove a demonstração gratuita existente.

## Operador de propostas

Tabela nova: `contest_product_question_bindings`, migration `0033_product_question_curation`. Não há backfill, aprovação, publicação ou vínculo comercial automático. O papel do aplicativo tem SELECT e INSERT somente nas colunas de proposta, sem UPDATE/DELETE ou permissão de escrever campos de revisão.

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

## Revisão e liberação futuras

Este operador deliberadamente **não aprova mapas**. A decisão humana futura deverá revisar o dossiê de aderência com fontes e escopo, confirmar explicitamente o conteúdo e recalcular sua impressão sob locks apropriados. Precisa registrar revisor, data e justificativa reais; não basta alterar o status ou presumir que a aprovação de uma questão aprovou todos os produtos. A seleção/públicação dos produtos, cobertura mínima e eventual mapa legado de edição continuam etapas separadas. O piloto previsto é ENAM 1:1; não distribuir questões indiscriminadamente aos 75 produtos.

`listReleasedContestProducts` também exige o vínculo comercial aprovado. Publicar só o schema não abre produtos nem habilita checkouts. A revisão editorial de questões já aprovada é preservada pelo novo operador.

## Verificação e homologação

`tests/product-binding-policy.test.ts` cobre contrato/destinos/citações. `tests/product-binding-postgres.test.ts` usa somente servidor exclusivo `127.0.0.1:55441/leiprova_binding_test`, papéis `leiprova_binding_owner` e `leiprova_binding_app`, schema migrado e grants de produção. Stripe, clientes, editais e textos desse teste são fictícios; não envia e-mails ou WhatsApp.

Verificação executada: **35 testes passaram**, sendo 25 de integração PostgreSQL e 10 de contrato. Também passaram typecheck e lint dos arquivos alterados. Isso verifica o código no sandbox, não substitui homologação end-to-end de compra e entrega na Stripe.

Fixtures persistentes de QA receberam vínculos aprovados **sintéticos** e perfil/organizador fictícios explícitos, apenas no bootstrap já restrito ao banco separado. Após levar a migração à homologação, aplicar também os grants e o bootstrap sintético é necessário para manter os testes Alfa/Beta. Nenhum conteúdo real deve passar pelo helper `synthetic-product-bindings`.

Durante a preparação ocorreu um desvio de destino **local**, documentado integralmente em [relato da migração](RELATO-MIGRACAO-LOCAL-2026-09-06.md). Nos testes de migração, fixar sempre **ambas** `DATABASE_URL` e `MIGRATION_DATABASE_URL`, e confirmar banco/porta antes de qualquer gravação.
