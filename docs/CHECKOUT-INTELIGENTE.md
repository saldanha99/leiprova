# Checkout inteligente — Edital Lei Seca (branch `feat/checkout-inteligente`)

Preparado em 20/11/2026 a pedido do Vinícius. **Nada está ativo**: cada parte liga por
configuração, depois do deploy aprovado.

## 1. Pix + cartão na mesma tela

- Código: `CHECKOUT_PAYMENT_METHODS=card,pix` (padrão `card`). Vale para o Master e para
  as assinaturas de concurso; o Payment Element mostra Pix e cartão juntos.
- Verificado na Stripe em **modo de teste** (20/11/2026): sessão de assinatura com
  `["card","pix"]` criada com sucesso (teste automático em `tests/checkout-payment-methods.test.ts`).
- **Conta live (`acct_1TCQvl…`, BR) hoje NÃO tem Pix**: capacidades ativas só `card_payments`
  e `boleto_payments`; na configuração padrão de métodos, Pix = indisponível.
- **Parcelamento**: a Stripe aceita parcelas só em pagamento único. Como Master e concursos
  são assinaturas recorrentes, não há parcelamento nelas. Para parcelar seria preciso um
  plano de pagamento único (ex.: anual à vista ou parcelado), o que é decisão de oferta/preço.

### O que o Vinícius ativa no painel da Stripe (live)
1. Configurações → Pagamentos → Métodos de pagamento → **Pix** → ativar (ou "Solicitar acesso").
   Pode pedir aceite de termos e dados da empresa: **só o Vinícius aceita**.
2. Na mesma tela, conferir que o Pix ficou "Ativado" na configuração padrão.
3. Depois do OK de deploy: definir `CHECKOUT_PAYMENT_METHODS=card,pix` no `.env` da VPS.
4. A chave live do servidor é restrita (`rk_live_…`) e não lê métodos de pagamento;
   isso não impede o checkout, só a conferência automática.

## 2. Order bump (oferta extra) — configurável, desligado

`ORDER_BUMP_CONFIG` (JSON) em `src/lib/commerce/order-bump.ts`. Sem a variável, nada aparece.
O valor vem de um **preço que já existe na Stripe**; nenhum preço ou desconto foi criado.

**Opção A — "Segundo concurso da mesma carreira"** (recomendada)
- Mostrada no carrinho de concurso quando há 1 ou 2 concursos (o carrinho aceita até 3 da
  mesma carreira e periodicidade).
- Por quê: quem estuda TJ-RS Juiz estuda a mesma lei seca que TJ-PR/TJ-BA; o segundo
  concurso aproveita quase todo o estudo, então a percepção de valor é alta e o ticket sobe
  sem mudar de produto. Usa os preços atuais; um cupom só se o Vinícius definir o percentual.

**Opção B — "Trocar pelo Master"**
- Mostrada quando o carrinho tem 2 ou mais concursos: o Master (R$ 297/mês ou R$ 897/ano,
  preços já cadastrados) libera todos os concursos e o acervo inteiro.
- Por quê: com 2–3 concursos o cliente já paga perto do Master; a comparação lado a lado
  ancora o Master como a escolha óbvia. Risco: canibaliza a venda por concurso.

## 3. Recuperação de abandono — rascunhos, sem disparo

O pedido pendente já fica salvo (`contest_orders` / `checkout_attempts`) e já existe a
retomada do pedido exato em **Meus concursos** (`ResumeContestOrder`). Hoje há 1 pedido
expirado e 1 tentativa criada em produção.

**LGPD / opt-in**
- E-mail: lembrete único de uma compra iniciada pelo próprio titular, com descadastro.
  Base: legítimo interesse, informado na política de privacidade. Recomendo também um
  checkbox de consentimento no cadastro.
- WhatsApp: hoje não coletamos telefone. Só com campo de telefone + opt-in explícito
  ("Quero receber lembretes pelo WhatsApp"). Sem isso, não enviar.
- Nada é disparado automaticamente sem o OK do Vinícius.

### Rascunho — e-mail (1 h depois do abandono)
Assunto: Seu acesso ao {CONCURSO} ficou a um passo

> Oi, {NOME}!
>
> Você começou a assinatura do {CONCURSO} no Edital Lei Seca e o pagamento não foi
> concluído. Seu pedido está guardado do jeito que você montou.
>
> [Retomar meu pedido]({LINK_RETOMADA})
>
> Lá você paga com cartão ou Pix e o acesso é liberado assim que a Stripe confirma.
> Se preferir não continuar, é só ignorar este e-mail: não enviaremos outro lembrete
> sobre este pedido.
>
> Equipe Edital Lei Seca
> [Não quero receber lembretes]({LINK_DESCADASTRO})

### Rascunho — WhatsApp (só com opt-in)
> Oi, {NOME}! Aqui é do Edital Lei Seca. Sua assinatura do {CONCURSO} ficou pendente.
> Seu pedido está salvo; para concluir com cartão ou Pix: {LINK_RETOMADA}
> Se não quiser mais lembretes, responda SAIR.

`{LINK_RETOMADA}` = `/app/compras?pedido={id}` (retomada do pedido exato, exige login).

## 4. Rastreamento (LEI 10)

- `src/lib/tracking.ts`: captura todos os parâmetros da URL (sessionStorage), `_fbp`,
  `_fbc` (reconstruído do `fbclid`), `_ga`; `event_id` igual no Pixel e na CAPI:
  `InitiateCheckout` e `AddPaymentInfo` no navegador; `Purchase` = `purchase_<sessão>`
  no navegador (página de retorno) e no servidor (webhook).
- Atribuição gravada por pedido em `audit_logs` (`tracking.checkout_attribution`).
- CTAs de checkout: `<a>` com id `cta-checkout-*`, sem `target="_blank"`.
- Formulário de compra: e-mail antes do nome.

### Variáveis (todas desligadas sem valor)
| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_GTM_ID` | ID do container web (GTM-XXXX). Sem ele, nada carrega e a CSP não muda. |
| `NEXT_PUBLIC_GTM_SERVER_URL` | Domínio do Stape (ex.: `https://sgtm.editaleiseca.com.br`), de onde o `gtm.js` é servido. |
| `STAPE_SERVER_EVENTS_URL` | Endpoint do Data Client do Stape para o Purchase server-side (CAPI). |
| `CHECKOUT_PAYMENT_METHODS` | `card` (padrão) ou `card,pix`. |
| `ORDER_BUMP_CONFIG` | JSON da oferta extra (seção 2). |

No GTM/Stape (Vinícius): tags de Pixel e CAPI lendo `event_id` do dataLayer/evento,
para a deduplicação da Meta.

## 5. Desempenho
- `listReleasedContestProducts` (home, /concursos, carrinho, Master) recalculava a contagem
  completa por produto a cada requisição. Agora fica 5 min na memória do processo, servida
  enquanto recalcula. A venda continua revalidando a cobertura antes de cobrar.
- Medido em produção antes (20/11/2026): home 12,5–19,4 s; /concursos 13,0–15,5 s.
  Depois: medir após o deploy aprovado (a primeira visita de cada processo ainda espera o cálculo).
