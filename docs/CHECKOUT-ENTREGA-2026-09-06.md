# Checkout, entrega e curadoria — 06/09/2026

## Escopo desta etapa

Preparação do pagamento incorporado à página e da confirmação durável de acesso.
Nenhuma dessas mudanças, isoladamente, abre vendas ou declara os 75 cursos prontos.
Marca Editalume; repositório, domínio e IDs técnicos permanecem `leiprova`.

- Concurso: Stripe Elements na própria página, seleção mensal/anual consistente,
  adicionais opcionais e retomada do pedido exato. Campos de cartão pertencem à
  Stripe; o servidor da Editalume não recebe os dados brutos do cartão.
- Master: reserva única por pessoa/plano, chave e expiração persistidas antes da
  chamada externa; abas concorrentes não criam novas tentativas independentes.
  Uma assinatura em regularização ou uma tentativa legada ambígua bloqueia outra
  contratação, sem presumir cancelamento.
- Pedido avulso: modo hosted/elements preservado, recuperação limitada de sessões
  e cancelamento com comparação do estado atual. Pagamento concluído nunca é
  convertido em cancelamento de pedido pendente. Reembolso financeiro é um fluxo
  distinto e não foi disparado nesta etapa.
- Webhook: registro do evento, direitos e entrega na mesma transação. Queda de
  conexão não deixa uma continuação tardia alterar outra transação. Patch local
  versionado para postgres-js 3.4.9 nos caminhos ESM e CommonJS, com testes reais.
- Entrega: uma confirmação por compra/produto, após pagamento e direitos
  persistidos. Worker separado, tentativas limitadas e revisão operacional quando
  a resposta do provedor for incerta. Ver [contrato da fila](ENTREGA-DURAVEL-COMPRAS.md).
- Curadoria: formulário administrativo para revisar o vínculo da questão ao
  concurso exato, com nota e confirmação humana. Não aprova automaticamente
  questões, fontes, programa ou produto. Ver [curadoria](CURADORIA-POR-PRODUTO.md).

## Implantação controlada

Migrations novas: 0034 (outbox), 0035 (recuperação do checkout), 0036 (lock de um
produto sem UPDATE no catálogo). Os dois complementos `purchase-delivery-grants.sql`
e `product-binding-review-grants.sql` permitem conceder somente os privilégios novos,
sem revogar/reaplicar o restante do papel da aplicação. O script central de grants
também os preserva em publicações futuras.

Antes de migrar: backup e hashes integrais de questões, opções, catálogo e planos.
Publicar somente app e worker de entrega; não executar seed nem recriar homologação.
Encerrar o processo antigo antes de recuperar eventos antigos em processamento.
Não usar a chave de manutenção do catálogo como credencial de pagamento.

## Verificação e limites atuais

Validação local: lint, typecheck; 1.174 testes gerais passaram, 221 integrações
opcionais ignoradas nessa rodada. Rodada específica executou 139 testes PostgreSQL
com Stripe simulada; outros 12 testes PostgreSQL conferiram o lock com papel restrito.
São ambientes sintéticos isolados, não pagamentos reais nem homologação Stripe ponta a ponta.

Um único e-mail operacional foi aceito pelo Resend para o proprietário, com chave
idempotente. A credencial atual não permite consultar o estado de entrega: **aceito
não comprova chegada à caixa de entrada**. Não foi um e-mail de compra, não mudou
senha nem concedeu direito. Não há confirmação de automação WhatsApp funcionando.

O catálogo Stripe LIVE já possui os 75 produtos de concurso e um Master, com 152
preços recorrentes. A imagem é editorial compartilhada, não 75 fotografias exclusivas.
A credencial LIVE de manutenção é separada do runtime, que ainda precisa da chave de
pagamentos e da validação de endpoint/eventos. Um rascunho da chave restrita foi
preparado no Chrome Vini; **não emitido nesta etapa**.

Acervo antes desta publicação: 346 questões (312 revisadas, 12 pendentes e 22
rascunhos). Nenhum curso já tem o piso de 68 vínculos válidos. O plano privado dos
75 produtos organiza fontes e pendências por banca/cargo/edição; não é liberação
editorial. Os 68 rascunhos de Analista Jurídico MP-SP não pertencem ao produto Promotor.

Maestri: o CLI/canal do canvas não está disponível nesta sessão. O contexto de
acessos continua documentado (Stripe no Chrome Vini; Cloudflare no Chrome Daniel),
mas não há evidência de atualização do grafo ou de agentes externos em execução
por esta etapa. Não confundir os auxiliares Codex de implementação com esses nós.

Este registro será complementado após a conferência efetiva da implantação.
