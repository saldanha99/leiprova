# Arquivamento limitado do catálogo antigo — 06/09/2026

Operador preparado para a autorização específica de arquivar os **19 produtos
ativos antigos** da conta 2timeWeb. Esta documentação não afirma que a operação
já foi executada. O estado factual permanece em `STRIPE-CATALOGO-PRODUCAO.md`.

## Escopo e barreiras

- O snapshot UI aprovado tem 23 IDs: 19 ativos e quatro já arquivados. Seu
  SHA-256 está fixado no operador. Não editar ou substituir esse arquivo.
- IDs e nomes reais permanecem somente no snapshot privado. O escopo é derivado
  dos bytes que passam pelo hash fixo, nunca da lista corrente da API. Cada
  execução reautentica esses bytes; um plano de prévia editado não é aceito como
  autorização. Não há opção de hash alternativo no CLI.
- Somente os 19 IDs ativos aprovados são elegíveis. Os quatro arquivados e
  qualquer produto novo, inclusive Editalume, ficam fora das ações.
- Requer inventário API live do operador `inventory-stripe-catalog.ts`, capturado
  há no máximo 24 horas, e a conta exata `acct_1TCQvlBkl6797u2u`.
- Qualquer Payment Link ativo ou Checkout Session aberta bloqueia a operação,
  mesmo de produto fora do escopo. Resolver esses casos manualmente e recapturar
  o inventário; este operador não dispõe de alteração de links ou sessões.
- Os nomes e IDs dos produtos, a propriedade/modo dos preços e a lista de preços
  são relidos antes das ações. Mudanças inesperadas interrompem a execução.
- As únicas escritas Stripe são `products.update` e `prices.update`, com
  `active: false`. Sem DELETE, reativação, reembolso, cobrança, cancelamento de
  assinatura, alteração de cliente, acesso de aluno, banco ou feature flag.
- **Arquivar não cancela assinaturas existentes nem suas cobranças futuras.**
  O inventário cobre preços de catálogo, não todos os preços inline/históricos.
  Não representa auditoria financeira completa ou restauração integral de conta.

## Prévia sem rede

Na raiz técnica `leiprova`, após obter o inventário API na pasta privada:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/retire-stripe-catalog.ts \
  --mode=live \
  --ui=.local/commerce/stripe-ui-inventory-20260906.json \
  --inventory=.local/commerce/stripe-inventory/ARQUIVO-CAPTURADO.json
```

Trocar somente `ARQUIVO-CAPTURADO.json` pelo arquivo real. Sem `--apply`, não há
rede, escrita Stripe ou necessidade de chave. A prévia não valida estado remoto.
Não transportar snapshots privados para Git, Docker, prompts ou notas do canvas.

## Execução autorizada e retomada

Adicionar `--apply` somente após conferir a prévia e resolver eventuais bloqueios.
O ambiente precisa conter `STRIPE_SECRET_KEY` restrita, prefixo `rk_live_`, e
`LEIPROVA_COMMERCE_EXPECTED_STRIPE_ACCOUNT` com a conta exata autorizada. Não
passar chaves em argumentos, colar em conversas ou imprimir `.env`.

O recibo é criado em `.local/commerce/stripe-retirement/`, diretório `0700`,
arquivo JSONL `0600` exclusivo. Registra IDs, hashes e eventos sem nomes de
clientes, e-mails, URLs de checkout ou segredos. Cada `intent` é sincronizado em
disco antes da chamada; `confirmed` só aparece após nova leitura de `active=false`.

Se houver interrupção, pode existir resultado parcial: não há rollback
automático. Preservar o recibo, reler o estado remoto e retomar com os mesmos
inventários enquanto válidos. Recursos já arquivados são reconhecidos por leitura,
sem nova escrita. Se a captura vencer ou surgirem preços/nome divergentes,
recapturar o inventário API e revisar o motivo; não ampliar os 19 IDs autorizados.
Nenhuma receita, assinatura ou entrega ao aluno é conciliada por este operador.
