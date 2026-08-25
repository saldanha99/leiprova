# LeiProva

SaaS brasileiro para memorização da literalidade da lei, quizzes por carreira e banca, questões originais de múltipla escolha, revisão espaçada e acompanhamento de progresso.

O repositório contém a primeira versão completa do produto: landing page, demonstração pública, autenticação própria, área do aluno, motor de treino, PostgreSQL, checkout personalizado com Stripe, webhook idempotente e publicação por Docker/Traefik.

## Estado da versão

- Landing responsiva e demonstração pública funcionais.
- Cadastro, login, sessão segura e logout.
- Área do aluno com quiz configurável, treino, revisões, biblioteca, Raio-X, materiais, ranking e assinatura.
- Doze questões originais de demonstração, assistidas por IA, ancoradas na Constituição Federal e conferidas contra a fonte oficial; revisão humana independente pendente.
- Banco com versionamento da legislação, proveniência, fila de revisão e histórico de tentativas.
- Checkout Stripe implementado, mas desativado por padrão.
- Super admin com métricas operacionais reais e central de preparação do Stripe Connect.
- Deploy preparado para `https://leiprova.2b.app.br`.

## Stack

- Next.js 16, React 19 e TypeScript
- Tailwind CSS 4
- PostgreSQL 17, Drizzle ORM e PgBouncer
- Stripe Checkout Sessions com `ui_mode: "custom"` e Payment Element
- Docker Compose e Traefik
- Vitest

## Rodar localmente

Requisitos: Node.js 22, pnpm 11 e PostgreSQL.

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abra `http://localhost:3000`. O checkout continua indisponível enquanto `CHECKOUT_ENABLED=false`.
Cadastro e contato também falham fechados por padrão. Para um teste local controlado, use `REGISTRATION_ENABLED=true` e `CONTACT_ENABLED=true`; em produção, só abra esses canais depois de publicar a identificação formal e a rotina de atendimento.

Comandos de verificação:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Para conferir as questões contra o texto oficial no Planalto:

```bash
pnpm content:verify
```

O comando falha se algum gabarito deixar de ser verbatim ou se um distrator
passar a reproduzir a norma — o que daria à questão duas respostas defensáveis.

## Conteúdo jurídico

O conteúdo demonstrativo fica em `src/lib/demo-content.ts` e é inserido pelo `scripts/seed.ts`. Cada item contém:

- dispositivo e redação literal;
- URL da fonte oficial;
- data de verificação;
- uma única alternativa correta;
- distratores autorais com o tipo de alteração registrado;
- explicação editorial.

Antes de publicar novo conteúdo, compare a redação consolidada com a fonte oficial, registre uma nova versão e submeta cada questão a revisão humana. Textos de atos oficiais podem ser reproduzidos, mas questões, comentários e compilações de terceiros podem ter proteção própria. Não faça scraping nem reutilize cadernos de banca sem licença escrita.

## Quiz por carreira, banca e matéria

O construtor de quiz oferece dois caminhos:

- carreira ou cargo → especialização → edição/banca → matéria → tópico;
- banca → matéria → tópico.

O catálogo inclui VUNESP, FGV, FCC e CEBRASPE; Polícia Federal em destaque; e as carreiras Defensoria, Analista, Analista Jurídico, Promotoria, Magistratura, Técnico Judiciário, Delegado, Polícia Civil, Polícia Federal, OAB, Oficial da Promotoria, Oficial de Justiça e Escrivão de Polícia Civil. Magistratura possui recortes Federal, Estadual e do Trabalho.

A banca pertence à edição do concurso, não à carreira. O sistema encontra a última prova pela data da edição e não presume, por exemplo, que toda Magistratura Estadual seja sempre organizada pela FGV.

Os modos de conteúdo são separados por procedência:

- `dry_law`: questão original de literalidade ancorada em fonte oficial;
- `previous_exam`: reprodução somente com licença, titular, referência e validade registradas;
- `original_style`: questão inédita original classificada pelo estilo editorial da banca e revisada antes da publicação.

Há modo treino, com correção após a resposta, e modo prova, cujo gabarito só é liberado após a entrega. O servidor nunca envia a alternativa correta junto com o caderno inicial.

A fábrica autoral processa até 250 itens por lote em duas etapas atômicas: um
responsável confere e envia os rascunhos; depois, uma confirmação de revisão
humana libera todos os itens elegíveis. Fonte, formato, gabarito e originalidade
são recalculados no servidor antes de cada lote.

## Planos de referência

| Plano | Cobrança | Preço configurado na interface |
|---|---:|---:|
| Ritmo Mensal | recorrente | R$ 297,00/mês |
| Foco Anual | recorrente | R$ 897,00/ano |

Os valores são decisões comerciais iniciais. Confirme-os antes de criar os Prices na Stripe e habilitar pagamentos.

## Ativação segura da Stripe

As chaves enviadas em conversa devem ser consideradas expostas e nunca devem entrar neste repositório ou na VPS. Revogue-as, crie primeiro uma configuração de teste e só depois uma nova chave restrita de produção.

Variáveis obrigatórias:

```dotenv
CHECKOUT_ENABLED=true
STRIPE_SECRET_KEY=rk_test_ou_rk_live_nova
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_ou_pk_live_...
STRIPE_PRICE_RITMO=price_...
STRIPE_PRICE_FOCO=price_...
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...
```

Permissões mínimas da nova restricted key:

- Checkout Sessions: escrita;
- Customers: escrita;
- Customer Portal: escrita;
- demais recursos: nenhum, salvo leitura caso o painel exija leitura separada para recuperar uma Checkout Session.

Restrinja a chave ao IP fixo da VPS. Cadastre o endpoint `https://leiprova.2b.app.br/api/stripe/webhook` e assine estes eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`

Cartão e Link atendem às assinaturas. Pix não está habilitado porque os planos atuais são recorrentes.

## Sociedade e split de pagamentos

Stripe Connect não deve ser tratado automaticamente como distribuição societária de lucros. Se a receita pertence a um único CNPJ, a alternativa normalmente mais simples é receber integralmente na empresa e distribuir resultados pela contabilidade conforme o contrato social.

Quando professores, autores ou parceiros independentes possuem participação contratual em cada venda, o desenho previsto é Stripe Connect com `separate charges and transfers`: a plataforma cobra a assinatura e cria transferências idempotentes para múltiplas contas conectadas. Cada recebedor precisa concluir onboarding e KYC da Stripe.

Contas conectadas brasileiras aparecem atualmente como disponibilidade em prévia. Não habilite split até a Stripe aprovar o perfil da plataforma, os países envolvidos e as capabilities necessárias. Reembolsos e disputas também exigem reserva e reversão proporcional dos repasses.

Referências oficiais: [disponibilidade do Connect](https://docs.stripe.com/connect/how-connect-works#availability), [tipos de cobrança](https://docs.stripe.com/connect/charges), [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers), [assinaturas com Connect](https://docs.stripe.com/connect/subscriptions) e [Stripe Tax com Connect](https://docs.stripe.com/tax/connect).

O painel `/admin/stripe-connect` já possui o modelo de dados para parceiros, regras percentuais versionadas, lotes ligados ao checkout e ledger individual de transferências/reversões. As operações da API usam uma chave exclusiva do Connect e permanecem bloqueadas por padrão:

```dotenv
STRIPE_CONNECT_ENABLED=false
STRIPE_CONNECT_ONBOARDING_ENABLED=false
STRIPE_CONNECT_BR_APPROVED=false
STRIPE_CONNECT_MODE=test
STRIPE_CONNECT_SECRET_KEY=
STRIPE_CONNECT_COUNTRY=BR
STRIPE_CONNECT_CURRENCY=brl
STRIPE_CONNECT_RETURN_URL=https://leiprova.2b.app.br/admin/stripe-connect?onboarding=retorno
STRIPE_CONNECT_REFRESH_URL=https://leiprova.2b.app.br/admin/stripe-connect?onboarding=renovar
```

Não reutilize a chave do checkout. Para preparar um recebedor sem liberar repasses, mantenha `STRIPE_CONNECT_ENABLED=false`, use `STRIPE_CONNECT_MODE=test` e ligue somente `STRIPE_CONNECT_ONBOARDING_ENABLED=true`. Crie uma nova restricted key com acesso mínimo a Accounts e Account Links; adicione Transfers somente quando o executor financeiro for aprovado. Valide tudo em teste e só mude para live depois da aprovação explícita do Connect no Brasil. A tela nunca recebe a chave nem dados bancários; o onboarding hospedado pela Stripe coleta as informações de KYC.

## Super admin

Somente usuários com `users.role = 'admin'` acessam `/admin`; editores continuam sem acesso financeiro. A visão geral exibe dados reais de usuários, assinaturas com acesso, questões revisadas, edições, sessões de quiz e contatos. A área Connect é deliberadamente somente leitura até que haja aprovação, recebedores verificados e uma regra de split que feche em 100%.

## Deploy

> Contexto operacional completo — hospedagem, ambiente local, flags e armadilhas conhecidas — em [`docs/OPERACAO.md`](docs/OPERACAO.md).

A infraestrutura usa banco dedicado, papel proprietário só para migrações e papel de aplicação com privilégios mínimos. O app entra na rede externa `forza` para ser descoberto pelo Traefik já existente.

A VPS mantém `/opt/leiprova` como clone deste repositório. O `.env` fica fora do versionamento: salve as variáveis em `/opt/leiprova/.env`, com permissão `600`.

Para publicar uma nova versão, faça o push para `main` e execute na VPS:

```bash
cd /opt/leiprova
./deploy/pull-deploy.sh
```

O `pull-deploy.sh` traz `origin/main` por fast-forward e chama o `deploy.sh`. Ele aborta se encontrar alteração local não commitada, de modo que uma correção feita direto no servidor nunca seja sobrescrita em silêncio — leve-a para o repositório antes de publicar. Para publicar outra ref, passe-a como argumento: `./deploy/pull-deploy.sh origin/hotfix`.

O `deploy.sh` continua disponível para rodar o ciclo sem tocar no git. Ele compila as imagens, sobe banco e pool, executa migrações, reaplica privilégios, faz o seed idempotente e inicia o app. Verificações úteis:

```bash
docker compose ps
docker compose logs --tail=100 app
curl --fail https://leiprova.2b.app.br/api/health
```

O backup lógico está em `deploy/backup.sh`, mantém 14 dias e grava em `/opt/leiprova/backups`. Agende-o diariamente fora do horário de pico e copie os arquivos periodicamente para outro servidor ou armazenamento de objetos.

## Antes de vender

Roteiros detalhados: [`docs/REVISAO-JURIDICA.md`](docs/REVISAO-JURIDICA.md) e
[`docs/CHECKOUT-SANDBOX.md`](docs/CHECKOUT-SANDBOX.md).

1. Preencher a identificação do fornecedor nas variáveis `SUPPLIER_*` do `.env`. Enquanto qualquer campo estiver vazio, `getCheckoutAvailability` devolve `supplier_identity` e o checkout não abre.
2. Fazer revisão jurídica dos termos, privacidade, reembolso e promessas comerciais.
3. Aprovar preços, política de atualizações e SLA de suporte.
4. Validar o checkout em modo de teste, incluindo pagamento aprovado, recusado, renovação, atraso e cancelamento.
5. Criar rotina editorial contínua para detectar alterações legislativas e suspender questões desatualizadas.
6. Cadastrar o domínio no Cloudflare Email Service, validar SPF/DKIM/DMARC e preencher as variáveis `TRANSACTIONAL_EMAIL_*`/`CLOUDFLARE_*` somente na VPS. O primeiro acesso, a recuperação de senha e o convite após a compra já estão implementados e permanecem sem envio enquanto a flag estiver fechada.

## Segurança operacional

- Nenhum segredo deve ser versionado.
- Cookies de sessão são `httpOnly`, `secure` em produção e armazenam somente token aleatório; o banco guarda seu hash.
- Senhas usam Argon2id.
- Login, cadastro, contato e respostas possuem limites persistentes por janela de tempo.
- Liberação de acesso depende do webhook, não do navegador.
- Eventos Stripe são verificados pelo corpo bruto e processados com idempotência.
- Nunca habilite o checkout antes da rotação das credenciais expostas e de um teste completo em sandbox.
