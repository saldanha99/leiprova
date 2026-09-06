# Master — contrato preparado, integração pendente

Data: 05/09/2026. Este documento NÃO atesta prontidão de cobrança LIVE.

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
