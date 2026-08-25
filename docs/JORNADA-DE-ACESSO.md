# Jornada de compra e primeiro acesso

## Fluxo implementado

1. O visitante escolhe um plano no site e informa nome, e-mail e aceite dos termos, sem criar senha ainda.
2. O checkout personalizado cria uma tentativa durável e envia o pagamento à Stripe.
3. O webhook confirma a compra, ativa a assinatura e emite um convite único ligado à tentativa.
4. O LeiProva envia um e-mail com link pessoal de 24 horas para `/ativar-acesso`.
5. O comprador cria ou atualiza a senha. O token é consumido, sessões anteriores são encerradas e uma nova sessão é criada.
6. O usuário entra diretamente em `/app`.

A tela `/recuperar-acesso` usa a mesma infraestrutura. Ela nunca revela se o e-mail informado existe no banco.

## Segurança e idempotência

- O token bruto nunca é persistido; o banco guarda apenas SHA-256.
- Cada tentativa de checkout pode emitir somente um convite inicial.
- O link funciona uma vez e expira em 24 horas.
- Trocar a senha encerra as sessões anteriores.
- Limites por IP e e-mail reduzem abuso e enumeração de contas.
- Uma indisponibilidade do provedor de e-mail não desfaz nem bloqueia a compra confirmada.
- Status de envio e falhas sem segredo são registrados em `account_access_tokens` e `audit_logs`.

## Configuração do Resend

O aplicativo na VPS usa a API REST do Resend. Antes de ligar o envio:

1. Cadastre `2b.app.br` no Resend. A configuração usa `send.2b.app.br` como Return-Path, sem substituir os MX da Locaweb no domínio principal.
2. Aguarde a validação dos registros SPF, DKIM e DMARC.
3. Crie uma API key com permissão somente de envio e restrita ao domínio cadastrado.
4. Preencha somente em `/opt/leiprova/.env`:

```dotenv
TRANSACTIONAL_EMAIL_ENABLED=true
RESEND_API_KEY=re_...
TRANSACTIONAL_EMAIL_FROM=LeiProva <acesso@2b.app.br>
```

5. Teste primeiro com uma compra Stripe em modo de teste e confirme recebimento, spam, expiração e reuso do link.

O plano gratuito do Resend é suficiente para a validação inicial, mas tem cotas diária e mensal. Monitore o uso e a taxa de rejeição antes de abrir o checkout.

Não ligue `CHECKOUT_ENABLED`, `REGISTRATION_ENABLED` ou `TRANSACTIONAL_EMAIL_ENABLED` até concluir identificação do fornecedor, rotação das chaves e validação do sandbox.
