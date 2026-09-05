# Catálogo e comércio por concurso — continuação local

Data: 05/09/2026. Projeto LeiProva / marca Editalume. Branch `codex/concursos-premium`.

> **Preços/periodicidade superados:** a regra vigente é R$67/mês ou R$347/ano
> por concurso, com renovação recorrente e Master inalterado. Veja
> [assinaturas por concurso](ASSINATURAS-POR-CONCURSO.md). O restante desta
> página registra a implementação histórica de pagamento único.

> Continuação autorizada para produção: [publicação e abertura comercial](PRODUCAO-CONCURSOS.md). O texto abaixo registra a entrega local anterior. O sincronizador agora também prepara modo live, com verificação explícita de conta/ambiente; isso não significa que tenha sido aplicado na Stripe.

## Entrega implementada

- Mega menu e catálogo com carreira → estado/abrangência → cargo e edição. Oito categorias, 75 produtos planejados, busca, filtros e adaptação para celular.
- Cada edição tem página e URL canônica próprias, imagem original, benefícios, tour ilustrativo, ofertas, Master e FAQ. Regionais podem aparecer em vários estados sem duplicar produto ou canonical.
- Preços centralizados: avulso R$67/6 meses ou R$87/12 meses, pagamento único; Master R$297/mês ou R$897/ano. Os valores Master foram preservados, não aprovados como nova cobrança real.
- Carrinho por produto com extensão de prazo e até dois concursos adicionais da mesma carreira, sempre opcionais/desmarcados. Master é uma alternativa explícita, não um extra adicionado automaticamente. Não há desconto fictício nem venda pós-compra de um clique.
- Checkout hospedado da Stripe, uma sessão por seleção, preços por produto, total conferido no servidor, identidade e modo teste/live validados. Não há coleta local de dados de cartão.
- Compras avulsas liberam somente questões revisadas vinculadas à edição adquirida e dentro da vigência. Master usa a assinatura existente. Acesso gratuito preservado; avulso não vira Master.
- Confirmação por webhook assinado, idempotência, proteção contra tentativas sobrepostas, revogação em reembolso/contestação, histórico individual em `/app/compras` e cancelamento de sessões pendentes já identificadas.
- Painel `/admin/catalogo-produtos` exclusivo de administrador, com preços, preparação editorial e configuração Stripe. É um painel de inspeção: não possui botão de liberação editorial/comercial automática.

## Estado real e limites

**Implementado e testado localmente, não publicado. Stripe ainda não sincronizada. Nenhum pagamento real realizado.** Não foram alteradas senhas, conteúdo, configuração ou banco de produção. Não houve commit, push, deploy nem uso de OpenRouter.

As 75 ofertas são pesquisa pública, não 75 cursos prontos. Veja [método e contagens da pesquisa](research/README.md). Cada produto nasce em `draft`, sem vínculo editorial presumido. Só a combinação de oportunidade oficial revisada/atual, categoria compatível, questões revisadas vinculadas e liberação comercial explícita permite disponibilização. Essa verificação técnica não substitui avaliação humana de adequação e cobertura do conteúdo.

As páginas planejadas são `noindex` e ficam fora do sitemap. Páginas revisadas preservam SEO; produtos vinculados usam sua URL canônica. Não anunciar páginas em preparação como cursos disponíveis nem prometer indexação ou aprovação.

Não há chaves Stripe utilizáveis configuradas no ambiente local. `scripts/sync-contest-stripe.ts` foi executado somente em simulação: 75 produtos, 150 preços avulsos, dois preços Master, zero escritas externas. `--apply` aceita somente chave de TESTE e exige ambiente e banco de homologação explícitos. Mantém os produtos como rascunho. Não é um sincronizador autorizado para produção.

## Homologação segura antes de vender

1. Preparar ambiente separado de produção. Aplicar migration `0031_parched_ser_duncan.sql` e os privilégios de `deploy/grant-app-role.sql`. Nunca rodar o seed legado sobre o acervo revisado.
2. Configurar chave Stripe de teste e segredo do webhook diretamente no ambiente seguro, sem enviá-los por chat. Definir `LEIPROVA_COMMERCE_ENVIRONMENT=staging` e `LEIPROVA_COMMERCE_DATABASE_URL` com o banco de homologação. Rodar o script via `pnpm exec tsx --env-file-if-exists=.env scripts/sync-contest-stripe.ts` primeiro sem `--apply`; revisar a simulação antes da aplicação.
3. Registrar os IDs públicos dos preços Master nas variáveis existentes e conferir os 150 preços por concurso no painel. O aplicativo não cria preços a partir de valores enviados pelo navegador.
4. Revisar cada edição com fonte oficial e conteúdo próprio/licenciado. Vincular a oportunidade correta e registrar responsável/data da liberação. Uma única questão revisada atende apenas ao gate técnico mínimo, não representa curso completo ou cobertura do edital.
5. Apenas em homologação, configurar identificação do fornecedor, comunicação transacional e os gates existentes, além de `CONTEST_CHECKOUT_ENABLED`. Validar compras, adicionais, cancelamento, expiração, devolução, contestação, eventos repetidos, falhas e acessos com cartões de teste oficiais da Stripe.
6. Rever termos comerciais, atendimento, prazos, política de devolução, catálogo realmente entregue e autorização dos preços antes de abrir vendas reais. O aplicativo não deve misturar dados de pagamento de teste com produção.
7. Publicação exige decisão explícita, backup, revisão do diff/ref e deploy restrito ao LeiProva com `LEIPROVA_SKIP_SEED=1`. Nunca reiniciar serviços de outros projetos.

Pendências conhecidas para homologação: falha de rede após criar a sessão Stripe mas antes de persistir seu ID exige reconciliação/repetição da mesma seleção; a interface não cancela pedido sem ID de sessão conhecido. Reembolso parcial revoga conservadoramente todos os acessos daquela compra, exigindo atendimento/reconciliação antes de eventual restauração. O fluxo externo completo da Stripe ainda não foi exercitado com credenciais reais de teste. Não abrir vendas antes de resolver/validar esses casos.

## QA e acessos

Lint, TypeScript e 465 testes em 62 arquivos passaram, incluindo 22 novos testes de catálogo/carrinho e banco sintético: valor, moeda, modo, identidade, idempotência, prazo, escopo de acesso, devolução e isolamento entre usuários. O build de produção foi aprovado na cópia isolada. Testes de pagamento usam simulações, não cobranças na Stripe.

Navegação e screenshots usam agent-browser. Prévia isolada em `http://127.0.0.1:3098/concursos`; depende de este Mac e os processos locais estarem ligados. Chromium com viewports responsivos não substitui teste em aparelhos físicos.

Conferência visual: menu em 320×812 e 1440×1000; catálogo em 390×844 e 768×1024; cabeçalho da home e página PC-BA em 320×812. Sem rolagem horizontal do documento nesses recortes. Filtro Bahia retornou as duas ofertas PC-BA; Escape fechou o menu. O carrinho passou de R$67 para R$87 e, com dois adicionais selecionados manualmente, totalizou R$221; compra permaneceu bloqueada. A página planejada PC-BA apresentou `noindex` e não constou no sitemap. Admin e cliente avulso também entraram no build da prévia, e o cliente foi redirecionado ao tentar abrir o painel administrativo.

Quatro contas de QA: administrador, cliente Master, cliente avulso e gratuito. Credenciais aleatórias ficam apenas em `.local/commerce/ACESSOS-DE-TESTE.md` e `.local/commerce/acessos-qa.json`, permissões 600, ignoradas por Git e Docker. Não são contas de produção. A compra e assinatura de QA são sintéticas e não representam cobrança nem liberação editorial.

O script `scripts/setup-local-commerce-qa.ts` recusa qualquer banco diferente do cluster sintético em `127.0.0.1:55439/leiprova_automation_test`. Não usar credenciais QA em produção. O servidor preexistente do usuário na porta 3000 foi preservado.

## Organização técnica

- Fonte de catálogo e valores avulsos: `src/lib/commerce/catalog.ts` e `planning-catalog.json`.
- Master: `src/lib/plans.ts`, mantendo slugs legados para compatibilidade.
- Persistência: `contest_store_products`, `contest_orders`, `contest_purchases`; preço Stripe e acesso por edição separados da assinatura.
- Checkout: `/checkout/concurso/[slug]` → `/api/stripe/contest-checkout` → webhook existente → `/app/compras`.
- Nenhum segredo, arquivo privado de QA ou conteúdo jurídico pago foi incluído na pesquisa/versionamento.
