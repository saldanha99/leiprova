# Roteiro de validação do checkout em sandbox

Executar **antes** de qualquer cobrança real. Nada aqui exige chave de produção:
tudo roda com chaves de teste da Stripe, que começam com `sk_test_`/`rk_test_`
e `pk_test_`.

O que já está coberto por teste automatizado (`pnpm test`) e não precisa ser
reconferido à mão: tradução dos status da Stripe para o modelo local, recusa de
`userId`/`planId` malformados vindos dos metadados, cálculo da janela de
vigência, guarda de metadados contra eventos de outra aplicação na mesma conta.
O que este roteiro cobre é o que só aparece com a Stripe de verdade no circuito.

## Pré-condições

1. Preencher a identificação do fornecedor no `.env` — `SUPPLIER_LEGAL_NAME`,
   `SUPPLIER_TAX_ID`, `SUPPLIER_ADDRESS`, `SUPPLIER_EMAIL`,
   `SUPPLIER_SUPPORT_CHANNEL`, `SUPPLIER_DPO_CONTACT`. Sem isso
   `getCheckoutAvailability` devolve `supplier_identity` e o checkout **não abre**,
   por decisão de código.
2. Criar uma configuração de **teste** na Stripe, com os três Prices, e uma
   restricted key nova. Nunca reaproveitar chave que já circulou em conversa.
3. `CHECKOUT_ENABLED=true` e `REGISTRATION_ENABLED=true` apenas no ambiente local.
4. Encaminhar os eventos para a aplicação:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

O `whsec_` que o comando imprime vai em `STRIPE_WEBHOOK_SECRET`. Sem ele a
verificação de assinatura falha e o webhook rejeita tudo — que é o comportamento
correto.

## Cartões de teste

| Cenário | Número |
|---|---|
| Aprovado | 4242 4242 4242 4242 |
| Recusado (genérico) | 4000 0000 0000 0002 |
| Exige autenticação (3DS) | 4000 0025 0000 3155 |
| Falha após autenticação | 4000 0000 0000 9995 |

Qualquer validade futura e qualquer CVC.

## Casos a executar

Para cada um, confira **os três lados**: a tela, a tabela `subscriptions` e a
tabela `stripe_events`.

1. **Pagamento aprovado, plano mensal.** Assinatura em `active`, acesso liberado
   na área do aluno, `stripe_events` com o evento em `processed`.
2. **Pagamento recusado.** Nenhuma assinatura ativa criada; o acesso continua
   restrito às cinco questões livres.
3. **3DS exigido.** O acesso só é liberado após a autenticação, não antes.
4. **Falha após autenticação.** Mesmo resultado do caso 2.
5. **Pagamento único (Fundador).** Acesso concedido sem renovação futura.
6. **Renovação.** Avance o relógio com `stripe billing` ou dispare
   `invoice.paid`; a janela de vigência deve estender, não duplicar.
7. **Atraso.** `past_due` **não** pode liberar acesso.
8. **Cancelamento.** Acesso permanece até o fim do ciclo pago e cessa depois.
9. **Reembolso dentro de 7 dias.** Confirme que o acesso é revogado e que o
   registro permite provar a data do pedido.

## Verificações que costumam passar despercebidas

**Idempotência.** Reenvie o mesmo evento duas vezes:

```bash
stripe events resend evt_XXXXXXXX
```

A segunda entrega não pode criar uma segunda assinatura nem estender a vigência.
O `route.ts` reivindica o evento com `insert ... onConflictDoNothing` seguido de
um `update` condicionado ao status, então a segunda passagem deve encontrar o
evento já `processed` e sair sem reprocessar.

**Assinatura inválida.** Envie um corpo com `Stripe-Signature` incorreta: a rota
deve responder erro sem tocar no banco.

**Corpo bruto.** A verificação usa o corpo sem parse. Se algum middleware passar
a reserializar o JSON, a assinatura quebra — teste depois de mexer em middleware.

**Evento de outra aplicação.** Um evento sem `metadata.app === "leiprova"` deve
ser ignorado. Relevante se a mesma conta Stripe atender outro produto.

**Modo da chave.** `stripeKeyExpectsLivemode` existe para impedir que uma chave
`live` processe evento de teste, e vice-versa. Confirme que a troca test↔live
não passa silenciosamente.

## Antes de virar a chave para produção

- Cadastrar o endpoint `https://leiprova.2b.app.br/api/stripe/webhook` e assinar
  os dez eventos listados no README.
- Restringir a chave ao IP fixo da VPS.
- Rodar o caso 1 e o caso 9 uma vez em produção, com valor real e cartão próprio,
  antes de abrir para o público.
