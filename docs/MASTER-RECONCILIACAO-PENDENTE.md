# Master — reconciliação integrada, homologação Stripe pendente

Atualização: 06/09/2026. Reconciliador implantado em `b55327a`; este documento NÃO
atesta prontidão de cobrança LIVE. Veja [resultado da operação](OPERACAO-CONTEUDO-REEMBOLSOS-2026-09-06.md).

## Correção implementada e testada localmente

O checkpoint histórico abaixo foi substituído, no código local, pelo reconciliador
`src/lib/stripe/master-subscription.ts`. Ele está integrado a `process.ts` e à rota
webhook; não é mais um conjunto de validadores desconectados. Não houve alteração
de credenciais, flags, conta Stripe, cobrança ou reembolso externo nesta correção.

- Consulta Subscription, checkout, Invoice, InvoicePayment e PaymentIntent/Charge
  atuais. Confere tentativa persistida, usuário, Customer, plano, modo e vínculo
  da sessão. Metadados isolados não criam usuário nem associam Customer ausente.
- Somente fatura integralmente paga e período finito conferido podem gerar `active`.
  `trialing` não é promoção automática a Master. Cancelamento imediato não é
  desfeito por `invoice.paid` antigo; cancelamento agendado mantém apenas o ciclo pago.
- Estorno/disputa do ciclo atual suspende o acesso Master; eventos do ciclo anterior
  não retiram a renovação atual. Nenhum direito avulso ou de outro cliente é alterado.
  A decisão comercial de reembolso parcial ainda deve ser confirmada pelo responsável
  antes de abrir vendas; o comportamento local provisório conserva a suspensão.
- Consulta disputas atuais por Charge, inclusive em replays. `charge.disputed` não
  é tratado sozinho como prova de disputa ainda aberta. Todas precisam estar
  encerradas favoravelmente (`won`, `warning_closed` ou `prevented`) para restaurar
  o ciclo atual pago, sem reembolso; outra disputa aberta/perdida continua bloqueando.
- O processamento financeiro Master e `stripe_events.processed` compartilham a
  mesma transação/lock. Reentrega pode recuperar `processing` anterior; queda da
  conexão impede commit dos efeitos do executor antigo. Timeout retorna falha/retry.
  Isso NÃO corrige o claim legado dos avulsos.
- E-mail permanece após commit. A janela entre commit e envio ainda não tem outbox
  durável; portanto a correção não comprova entrega de e-mail ou WhatsApp.

Evidências reproduzíveis: `tests/master-subscription-postgres.test.ts` executa o
handler e a rota com PostgreSQL sintético em loopback, Stripe simulada e verificação
HMAC do SDK sem rede. Inclui concorrência superior ao pool, duplicata, rollback,
perda real somente da conexão marcada desta suíte, reentrega, cancelamento, mensal/
anual, reembolso, disputa encerrada, divergências de titularidade e APIs indisponíveis.

Para executar, definir explicitamente
`LEIPROVA_TEST_DATABASE_URL=postgres://leiprova_test@127.0.0.1:55439/leiprova_automation_test`.
Sem essa variável a suíte PostgreSQL é ignorada. Ela não lê `.env`, não acessa Stripe
externa e remove exclusivamente os registros identificados por UUIDs da própria execução.

Antes de LIVE: homologar assinatura/renovação/cancelamento/reembolso reais **em modo
teste**, confirmar política parcial, conferir permissões de leitura de Disputes,
assinatura dos webhooks e recuperação dos avulsos, concluir entrega transacional e
conteúdo liberado por produto. O deploy deve substituir a versão antiga do processo;
não manter o handler legado Master escrevendo paralelamente ao novo reconciliador.

Fontes oficiais: [ordenação e duplicação de eventos](https://docs.stripe.com/webhooks),
[Invoice Payments](https://docs.stripe.com/api/invoice-payment/list),
[estados de disputas](https://docs.stripe.com/api/disputes/object),
[múltiplas disputas por pagamento](https://docs.stripe.com/disputes/api).

## Histórico de 05/09/2026 — não representa o código atual

## Estado deste checkpoint

- `src/lib/stripe/master-policy.ts` contém validadores puros de titularidade, preço, período pago e reversão financeira, com testes sintéticos em `tests/master-policy.test.ts`.
- O módulo NÃO está importado pelo webhook nem pelo checkout. `src/app/api/stripe/webhook/process.ts` permanece com o comportamento anterior.
- Portanto, os dois bloqueios encontrados no Master continuam pendentes: eventos antigos podem sobrescrever estado mais recente; os handlers Master não reconciliam devoluções/contestações.
- O rascunho não homologado do reconciliador está apenas em `.local/commerce/master-reconciliation-draft.ts.txt`, ignorado pelo Git e fora do typecheck/build. Não copiá-lo para runtime sem concluir os testes abaixo.
- Não houve mudança de schema, ambiente, Stripe externo, deploy ou gates de venda neste trabalho.

## Contrato aprovado para implementação posterior

1. Eventos são gatilhos, não a fonte final de estado. Sob lock por assinatura, buscar a Subscription atual na Stripe antes de qualquer escrita local.
2. Exigir tentativa local persistida, vínculo exato de usuário interno/público, Customer previamente registrado, assinatura, plano, Price, moeda BRL, quantidade 1 e periodicidade mensal/anual. Não anexar Customer ou conceder acesso por metadados sem tentativa correspondente.
3. Liberar somente pela fatura atual efetivamente paga, com InvoicePayment, PaymentIntent e Charge correspondentes conferidos e fim finito. Não usar data de chegada do evento para prolongar acesso. Trial e compra Master vitalícia não estão homologados por este contrato.
4. Devolução/contestação: seguir PaymentIntent → InvoicePayment → Invoice → Subscription; conferir titularidade/modo; revogar somente o ciclo atual afetado. Reembolso parcial também suspende esse ciclo conforme política atual dos concursos. Evento de fatura antiga não pode remover uma renovação posterior, compra avulsa ou acesso de outro cliente.
5. Confirmar charge.amount_refunded/refunded/disputed nos replays para não reativar o mesmo ciclo estornado. Não cancelar nem reembolsar a assinatura na Stripe automaticamente; aqui se trata somente do acesso local.
6. Falhas de API, vínculo divergente ou informação financeira incompleta devem lançar erro para rollback/retry, nunca conceder acesso pelo payload antigo. Não apagar registros legados: casos sem evidência suficiente exigem reconciliação assistida, preservando o histórico local.
7. Confirmar e-mail somente após commit; falha de e-mail não desfaz pagamento. A idempotência e a corrida entre eventos devem ser verificadas no banco, não presumidas a partir dos testes unitários.

## Valores e ajustes permitidos

- Preço integral BRL com um único item recorrente licenciado; mensal e anual conforme plano local confiável.
- Cupom parcial positivo pode ser aceito apenas quando subtotal, desconto e total pagos conferem na fatura oficial e na cobrança.
- Permanecem BLOQUEADOS até homologação própria: crédito/saldo de cliente, notas de crédito como forma de pagamento, gratuidade 100%, pró-rata/upgrade no meio do ciclo, pagamento externo, pagamento parcial, imposto adicional e liquidação em múltiplos pagamentos.
- Um estorno confirmado deve ser tratado antes da validação de notas de crédito para que uma nota posterior não impeça revogação. Essa ordem pertence ao reconciliador ainda pendente; os validadores puros não escrevem nem revogam acesso.

## Banco, locks e legado

O desenho usa um único advisory transaction lock por assinatura e exclusivamente a conexão `tx` durante a transação. Isso evita adquirir uma segunda conexão do pool enquanto a primeira segura o lock. Consultas Stripe dentro da transação mantêm uma conexão ocupada; timeouts precisam resultar em rollback/retry. Ainda é necessário medir contenção e testar concorrência real. O rascunho não constitui prova de ausência de deadlock.

Não alterar a identidade de uma assinatura existente em um upsert. Casos legados devem manter histórico e acesso já comprovado, sem conceder novo acesso indefinido. A auditoria pontual encontrou zero assinaturas de produção; isso não autoriza remover guardas nem assumir que continuará assim.

## Homologação obrigatória antes de integrar/liberar

- PostgreSQL sintético: mensal/anual, início/fim exatos e isolamento Master versus avulso/outro cliente.
- Entregas concorrentes e repetidas, fatura antiga após cancelamento, fatura antiga após renovação, falha de renovação, cancelamento agendado e imediato.
- Devolução total/parcial, disputa, evento antes de invoice.paid, replay após estorno e reversão de ciclo anterior.
- Falha de Subscription/Invoice/PaymentIntent API, metadados divergentes, Customer ausente, preço/cadência/mode divergentes, tentativa inexistente e registros legados.
- Checkout expirado tardio, corrida entre criação da sessão e primeiro evento, confirmação de e-mail no máximo uma vez por tentativa.
- Verificar assinatura de webhook, modo da conta, permissões restritas e recuperação de eventos presos em `processing` (lease ainda pendente em tarefa separada).
- Só então importar o reconciliador em `process.ts`, mantendo precedência e isolamento dos handlers de concursos, revisar diff, executar testes/build centrais e homologar sandbox ponta a ponta.

Referências oficiais usadas para o desenho: [eventos de assinaturas](https://docs.stripe.com/billing/subscriptions/webhooks), [Invoice Payments](https://docs.stripe.com/api/invoice-payment/list), [Subscription](https://docs.stripe.com/api/subscriptions/object).
