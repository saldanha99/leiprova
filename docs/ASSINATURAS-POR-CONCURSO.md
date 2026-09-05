# Assinaturas por concurso — 05/09/2026

## Regra vigente

Solicitação do proprietário: aplicar dois planos aos 75 produtos individuais.
Esta regra substitui a proposta histórica de pagamento único por 6/12 meses.

| Oferta | Cobrança recorrente | Escopo |
| --- | --- | --- |
| Mensal | R$67 por mês | Somente o concurso contratado |
| Anual | R$347 de uma vez por ano | Somente o concurso contratado |

Doze mensalidades somam R$804. A opção anual economiza R$457, ou
56,8408% (exibidos como aproximadamente 57%). Equivalência mensal: R$28,92;
**não é parcelamento**. Renovação automática até cancelamento; cancelar a
renovação mantém somente o período já pago. Master preservado: R$297/mês ou
R$897/ano, com suas regras de acesso próprias.

Mensal em verde-escuro e anual em marfim, com contraste, identificação de
periodicidade e comparação de economia. Os mesmos valores alimentam página,
catálogo, carrinho, administrador e sincronizador Stripe. Adicionais continuam
opcionais/desmarcados e seguem a periodicidade da seleção principal.

## Implementação e compatibilidade

- Fonte central: `src/lib/commerce/catalog.ts`. Chaves novas `monthly`/`annual`.
- Checkout novo usa `mode=subscription`, valores conferidos no servidor e
  metadata `contest_subscription_v2`. Uma seleção de até três cursos gera
  uma assinatura com itens específicos, não uma assinatura Master.
- Migration aditiva `0032_contest_recurring_plans.sql`: IDs de preço mensal/anual,
  identidade/status da assinatura no pedido e histórico de faturas por ciclo.
  Reaplicar privilégios de `deploy/grant-app-role.sql`.
- Colunas e pedidos antigos de pagamento único são preservados. Novos pedidos
  não aceitam `6m`/`12m`; preços antigos não são convertidos nem reutilizados.
  Links antigos de seleção abrem o mensal e exibem expressamente a nova oferta.
- Sincronizador prepara 75 produtos e 150 preços **recorrentes**, mais os dois
  preços Master existentes. Lookup keys `recurring_v2`; `--apply` não foi
  executado nesta mudança. Criar preços não abre vendas nem libera conteúdo.
- Acesso decorre da fatura paga e período informado pela Stripe, nunca da data
  de chegada do evento. Cliente, pedido, preço, moeda, modo, quantidade e
  periodicidade são validados. Eventos repetidos/atrasados não ampliam acesso.
- Falha de renovação não estende a vigência; cancelamento efetivo revoga acesso.
  Um reembolso de ciclo antigo não revoga um ciclo posterior pago.
- Cancelamento de renovação em `/app/compras` exige titularidade e confirmação
  na Stripe, permanece disponível com novas vendas fechadas e não reembolsa
  nem cancela imediatamente. O portal continua disponível quando configurado.
- Proteção contra compra duplicada também verifica assinaturas pendentes de
  cobrança/ativas, mesmo após o vencimento do último acesso pago.

## Validação

Lint, TypeScript, build de produção e **581 testes em 67 arquivos** aprovados. Testes incluem os
75 cursos renderizados, comparação de preços, carrinho, checkout recorrente,
cancelamento pelo titular, isolamento de usuário/curso/Master, concorrência,
renovação, inadimplência, eventos atrasados e devoluções de ciclos distintos.

Banco sintético local com a migration nova aplicada. Toda a sequência de
migrations também passou em outro banco vazio e isolado
`leiprova_recurring_migration_test`; o banco QA antigo tinha objetos de 0030/0031
sem seus registros no journal, portanto não foi usado como prova da cadeia.

Conferência visual no navegador: 1440px desktop, 768px tablet e 390/320px mobile,
sem rolagem horizontal do documento. No carrinho, três cursos anuais totalizam
R$1.041/ano; ao mudar para mensal, R$201/mês. Compra bloqueada como esperado.
Viewports em Chromium não equivalem a homologação em aparelhos físicos.

## Stripe e abertura comercial: ainda pendentes

Não houve criação de chave, produtos, preços, assinatura, cobrança ou alteração
de permissões na conta Stripe nesta entrega. Não houve abertura das flags de
cadastro/vendas nem aprovação editorial automática. As 75 ofertas seguem
em preparação; preservar os controles até a homologação completa.

A chave dedicada deve contemplar as operações usadas: leitura de conta/preços,
produtos/preços na sincronização, clientes e Checkout, leitura/atualização de
assinaturas, leitura de faturas/Invoice Payments/Payment Intents e portal.
Conceder apenas os recursos necessários, sem alterar chaves de outros projetos.
Webhook assinado e versão compatível com o SDK atual precisam ser configurados.

Antes de vender, homologar com credenciais Stripe de teste em ambiente separado:
primeiro pagamento, renovação, falha, cancelamento, eventos concorrentes e
recuperação de falha após criar sessão remota mas antes de persistir seu ID.
Reembolso parcial continua conservador: revoga os acessos do ciclo afetado como
um conjunto, exigindo atendimento/reconciliação. Nenhum desses testes locais
simulados comprova o fluxo externo real. Revisar termos/atendimento e liberar
conteúdo pertinente a cada edição antes de abrir vendas.

Referências primárias: [assinaturas e webhooks](https://docs.stripe.com/billing/subscriptions/webhooks),
[criação de Checkout](https://docs.stripe.com/api/checkout/sessions/create) e
[objeto Invoice](https://docs.stripe.com/api/invoices/object).

## Publicação

Pré-publicação: Mac, GitHub e VPS alinhados em `fe201a5`, checkout do servidor
limpo, 33 GB disponíveis. 75 produtos draft, 244 questões, zero pedidos/compras,
zero assinaturas Master e zero vínculos questão-edição.

Backup `leiprova-before-recurring-prices-20260905.dump` validado por
`pg_restore --list` e preservado na VPS e em `.local/commerce/` no Mac com
permissão 600. SHA-256 em ambas as cópias:
`529de3c1313821ff23b1f2d56aaee28c41e0422558f31ca23d0bd187c114842d`.
Nenhum backup anterior removido.

Pendente de registrar o resultado do deploy. Somente `/opt/leiprova`, ref exata
e `LEIPROVA_SKIP_SEED=1`. Não reiniciar serviços vizinhos.
