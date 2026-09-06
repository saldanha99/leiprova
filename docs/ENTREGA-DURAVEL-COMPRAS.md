# Entrega durável após compra — Editalume

Fundação local da fila transacional, não declaração de envio real ou de vendas abertas.
A migration `0034_purchase_delivery_outbox` foi gerada com snapshot/journal coerentes;
sua existência no Git não comprova aplicação em produção.

## Integração

`enqueuePurchaseDelivery(tx, { userId, scope, purchaseId, productSlug })`, em
`src/lib/commerce/purchase-delivery.ts`, usa exclusivamente a transação recebida.
Chamar depois de persistir pagamento confirmado e direitos, antes do commit:

- Master: `scope = master`, `purchaseId = checkout_attempts.id`, `productSlug = plans.slug`.
- Concurso: `scope = contest`, `purchaseId = contest_orders.id`, `productSlug` exato de cada linha.

A chave é SHA-256 da versão/escopo/compra/produto, independente do evento Stripe.
Renovações/reentregas da mesma compra não criam outra confirmação. Titular e vínculo
precisam conferir. Vigência histórica/futura não bloqueia um webhook financeiro correto:
o worker decide se o acesso ainda pode ser comunicado. Uma entrada existente não é reaberta.
Nenhum envio externo ocorre na transação da compra.

## Worker e estados

`runPurchaseDeliveryWorker({ limit: 10 })` roda depois do commit, por execução explícita.
O operador `scripts/run-purchase-delivery.ts` só executa com `--run`; sem esse argumento
mostra uma prévia sem banco/envio. `pnpm delivery:run --run --limit=10` usa Node/tsx com
`--conditions=react-server` e a implementação `server-only` já embarcada no Next, sem
enfraquecer a proteção do código da aplicação nem adicionar dependência. O comando inclui
`--env-file-if-exists=.env`, conforme o padrão do projeto; não roda sozinho.

O serviço `purchase-delivery` no Compose usa `--run --loop --limit=10`: uma rodada a cada
60 segundos, sem sobrepor rodadas longas. `SIGTERM` interrompe a espera e permite concluir
a rodada vigente. Executa como UID/GID 1000 (usuário `node` da imagem base), rootfs somente
leitura, `/tmp` efêmero e caps removidas, sem portas, volumes ou chaves Stripe. O pool tem
duas conexões. A imagem alvo `migrator` inclui os módulos necessários; o comando NÃO é o
migrador. A inclusão do serviço no arquivo não comprova que foi publicado/iniciado.

O canal exige `PURCHASE_DELIVERY_ENABLED=true` (padrão `false`), a configuração
transacional já existente e `APP_URL` ou
`NEXT_PUBLIC_APP_URL` válido. Sem isso retorna `disabled`, sem reservar trabalhos.
Não usar chave Stripe de manutenção para e-mail nem modificar segredos para testar a fila.
`PURCHASE_DELIVERY_ENABLED` é independente de `CHECKOUT_ENABLED`: fechar novas vendas
não deve interromper a entrega de compras confirmadas anteriormente.

- `pending`: aguardando primeira reserva.
- `processing`: lease de dois minutos, com token e tentativa conferidos em cada conclusão.
- `retry`: falha recuperável, com atraso progressivo e máximo de seis reservas.
- `queued`: **aceito pelo Resend, não comprova entrega, leitura ou ausência de bounce**.
- `manual_review`: limite de tentativas, payload alterado, confirmação incerta ou janela segura esgotada.
- `cancelled`: direito não disponível quando o worker conferiu a compra exata.

Claim usa `FOR UPDATE SKIP LOCKED`. Atualizações e eventos são atômicos e protegidos
por fencing; resultado atrasado não sobrescreve uma reserva nova. A chamada ao Resend
é fora de qualquer transação/lock de banco. A preparação congela destinatário, nome,
produto, remetente, origem e versão do template; um hash do corpo detecta divergência.
Nenhuma senha ou token pessoal bruto é armazenado no payload.

O provedor recebe sempre `purchase-delivery/v1/<id>`. A deduplicação Resend tem janela
de 24 horas; a fila para automaticamente em **23 horas após preparar o primeiro envio**.
Nunca zerar tentativas/janela nem reenviar `manual_review` sem conferir o provedor:
uma resposta perdida pode já ter sido aceita. Não há promessa de exactly-once externo
ilimitado; leases locais não substituem idempotência e conciliação do provedor.

O estado do direito é revalidado antes de preparar o envio. Um reembolso concorrente
depois dessa leitura ainda pode cruzar a mensagem; o e-mail nunca concede direitos e
a plataforma consulta o estado atual. Mensagens avulsas não prometem Master.

## Senha e acesso

Uma compra **não redefine senha**, não revoga sessões e não emite token de reset.
O recibo aponta a `/entrar` e, quando necessário, a `/recuperar-acesso`; o fluxo
existente envia um link pessoal de uso único para o e-mail da conta. Compradores que
passaram pelo cadastro rápido com senha provisória usam esse fluxo para definir a senha.
Não inferir que `email_verified_at` vazio signifique ausência de senha definida.

## Privilégios e observabilidade

Permissões novas mínimas, a aplicar separadamente pelo operador responsável:

- `purchase_delivery_outbox`: SELECT, INSERT e UPDATE; sem DELETE.
- `purchase_delivery_events`: SELECT e INSERT; sem UPDATE/DELETE.
- Sem sequence nova; IDs são gerados na aplicação.

O arquivo `deploy/purchase-delivery-grants.sql` é o complemento mínimo para aplicação
isolada após a migration 0034. O `grant-app-role.sql` central também inclui os mesmos
grants, para não perdê-los ao revogar e reatribuir privilégios em uma publicação futura.
O complemento usa a variável psql `app_user` como identificador protegido; não precisa
de papel owner na fila. O fluxo padrão de deploy inclui a construção e inicialização
do worker, que continua sem enviar enquanto `PURCHASE_DELIVERY_ENABLED` estiver fechado.

Leituras de usuários e vínculos comerciais já existentes continuam necessárias.
Não conceder acesso da fila aos usuários finais. Payload contém destinatário e nome:
é dado pessoal operacional, não deve aparecer em logs, telas públicas, notas do Maestri
ou relatórios gerais. O histórico usa apenas IDs, estados, tentativa e código sanitizado.
Exclusão de usuário faz cascade da fila/histórico associado conforme a FK.

Não há integração de WhatsApp, webhook de entrega Resend ou reenvio administrativo nesta
fundação. Nenhuma dessas capacidades deve ser anunciada como funcionando apenas porque
um trabalho ficou `queued`.

## Verificação

Testes unitários cobrem contratos, payload, isolamento, dedupe, configuração e estados.
`tests/purchase-delivery-postgres.test.ts` exige explicitamente um cluster efêmero em
`127.0.0.1:55479/leiprova_webhook_test`, usuário sintético `leiprova_test`; usa schema
aleatório próprio e remove só esse schema no encerramento. Não conecta em produção.
