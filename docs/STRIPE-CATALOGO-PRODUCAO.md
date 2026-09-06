# Catálogo Stripe — aplicação de produção

## Estado verificado em 06/09/2026

O proprietário solicitou retirar os produtos e checkouts antigos da conta
2timeWeb e integrar os 75 concursos e o Master. A autorização não significa
cancelar assinaturas, reembolsar clientes, apagar faturas ou alterar projetos
vizinhos da VPS. Antes de qualquer retirada, identificar os objetos exatos.

**Uma chave restrita de catálogo Editalume foi emitida após as verificações
concluídas pelo proprietário. Os 19 produtos antigos autorizados e seus 22 preços
foram arquivados e conferidos. Histórico preservado; os quatro produtos que já
estavam arquivados não foram alterados. Os 75 concursos + Master foram criados
em LIVE, com 152 novos preços e vínculos no banco de produção. Verificação
independente do catálogo passou. A aplicação da marca foi publicada.**

- Conta autorizada: `acct_1TCQvlBkl6797u2u`, Chrome **Vini** (`Profile 4`).
- O Chrome estava em execução, sem conexão de depuração disponível para
  `agent-browser --auto-connect`. Uma sessão anterior também não conectou.
- O proprietário confirmou a exceção para controle visual do Chrome nesta
  operação. A aba autenticada do perfil **Vini** foi acessada e a conta
  **2timeWeb** conferida. Não copiar perfil/cookies; a exceção não autoriza
  contornar confirmações de criação de acesso sensível.
- No aplicativo de produção, a conferência final das variáveis efetivamente
  usadas confirmou chave secreta **test**, `STRIPE_PUBLISHABLE_KEY` **test** e
  segredo de webhook presente. A anotação anterior de publicável ausente não
  descrevia essa variável correta. A presença de segredo não prova que o endpoint
  esteja homologado. A chave LIVE de manutenção é separada e não foi instalada
  como chave de execução de pagamentos.
- `CHECKOUT_ENABLED=false` e `CONTEST_CHECKOUT_ENABLED=false` confirmados.
- A listagem visual do catálogo mostrou **23 produtos, 19 ativos e 4 arquivados**,
  em duas páginas. São produtos antigos de outras marcas, não os 75 concursos.
  As telas de assinaturas ativas e Payment Links apresentaram estado vazio.
  Isso não substitui o inventário paginado da API nem comprova ausência de
  sessões Checkout abertas ou de histórico financeiro.
  Os 23 IDs distintos e status visíveis estão no registro privado
  `.local/commerce/stripe-ui-inventory-20260906.json` (permissão 600, fora de Git).
- Chave restrita criada: nome `Editalume - catalogo e inventario live`;
  Products/Prices com gravação;
  Accounts, Subscriptions, Checkout Sessions e Payment Links somente leitura.
  As seis seleções foram conferidas no DOM. O proprietário concluiu a
  verificação de e-mail e do autenticador diretamente no Chrome Vini.
  A transferência foi concluída por formulário privado em loopback, usando a
  aba autorizada sem expor o valor na conversa. Chave salva em arquivo `0600`
  privado no Mac e na VPS, fora de Git e Docker; clipboard temporário limpo.
  A API confirmou a conta própria e `charges_enabled`, `details_submitted` e
  `payouts_enabled` verdadeiros. Nunca colocar o valor em logs, Git, canvas ou
  conversa. Esta credencial de manutenção não atende
  às permissões do checkout em execução e não deve substituir sua chave.
- O proprietário confirmou expressamente o arquivamento dos **19 ativos**
  antigos, incluindo as outras marcas observadas. Os quatro já arquivados,
  assinaturas, histórico financeiro e novos produtos permanecem fora das
  mutações. O operador dedicado fixa esse escopo; não derivá-lo de um filtro
  móvel após criar o catálogo Editalume.
- Conferência somente leitura do banco de produção **antes da operação**: 75 produtos locais,
  nenhum com `stripe_product_id`; nenhuma assinatura local encontrada.
  Preflight operacional aprovado sem conceder privilégios ou alterar dados.
  Backup do banco exclusivo concluído e verificado no Mac e na VPS:
  `editalume-before-stripe-20260906T175337Z.dump`, SHA-256
  `9f3b54a2147f4a5ef9bb1970cbc33cca69d7d8c4611d12b5808a635991bae0ba`.
- Inventário API completo capturado antes de qualquer alteração: 23 produtos,
  19 ativos, 26 preços de catálogo, zero links ativos, zero sessões abertas e
  zero assinaturas. Arquivo privado `inventory-live-2026-09-06T18-03-24-355Z.json`,
  SHA-256 `29bc824c2296b7341dc7440fa13fda790296a794479a9521311ef43c136b9aba`.
  A prévia de arquivamento delimitou 19 produtos e 22 preços associados.
  Leitura adicional confirmou ausência de `default_price` nos 19 ativos.
- Arquivamento concluído com recibo privado incremental em
  `.local/commerce/stripe-retirement/`. Inventário posterior, antes de criar os
  novos produtos: 23 produtos, **zero ativos**, 26 preços, nenhum link ativo,
  sessão aberta ou assinatura. Arquivo `inventory-live-2026-09-06T18-09-11-302Z.json`,
  SHA-256 `b783eb77ff6648b648a8852b151d588732fb5f5d56fb1eb633e4e04d355a4171`.
  Somente `active=false` foi aplicado; não houve DELETE, reembolso ou cobrança.
- Sincronizador `a98ce92` executado em contêiner efêmero separado, com banco
  interno direto e saída HTTPS, sem portas publicadas. Concluiu com código 0;
  contêiner removido após preservar recibo. Nenhum seed, migração ou grant.
  Todos os 75 vínculos e os dois planos Master foram persistidos. Os dois IDs
  Master também foram instalados nas variáveis próprias da aplicação, com
  backup do `.env`; demais valores e flags preservados.
- Conferência independente de todos os vínculos, modo, preços, periodicidade,
  identidade, imagem e URL: **75 cursos / 76 produtos ativos / 152 preços
  Editalume ativos**, sem divergências. Há quatro preços ativos históricos dos
  quatro produtos já arquivados e preservados. Foram comparados com os snapshots
  anteriores por hash; não são preços novos nem vínculos da Editalume.
  A conta tem, portanto, 99 produtos totais (76 ativos, 23 arquivados), 178 preços
  totais (152 ativos da Editalume + 4 ativos legados), zero links ativos, sessões
  abertas ou assinaturas. Criar catálogo não cria automaticamente sessões de compra.
- Inventário final: `inventory-live-2026-09-06T18-15-08-320Z.json`, SHA-256
  `d0f47e100df0ab6aecab9b54d24d16204eb1acd9aa9780c3db1f4584f115fe72`.
  Verificação independente: `verification-live-2026-09-06T18-14-53-218Z-f9568c5e.json`,
  SHA-256 `a8567a117bc4e04effcd2c89620a37cc9aa9e3adf2ed8758fc4e4da5c950363d`.
  Painel Chrome Vini também mostrou 76 ativos e 23 arquivados; aba deixada aberta.

## Catálogo sincronizado e verificado

| Escopo | Produtos | Preços | Valores recorrentes |
|---|---:|---:|---|
| Concursos individuais | 75 | 150 | R$67/mês e R$347/ano |
| Master | 1 | 2 | R$297/mês e R$897/ano |
| Total | 76 | 152 | Sem cobrança nesta preparação |

Apresentação centralizada inclui nome, descrição, página canônica e fotografia
editorial existente. O arquivo `editorial-study-v2.webp` foi aberto e carregou
em produção (1536×1024). **É uma foto compartilhada do projeto, não 75 fotografias
exclusivas.** O título, a edição e a URL distinguem cada concurso. O Master
descreve acesso aos concursos liberados, não promete conteúdo ainda inexistente.

IDs e metadata legados identificam tecnicamente produtos da Editalume. Arquivados compatíveis
só podem ser reativados com opção explícita `--reactivate`; incompatibilidades
e duplicatas são bloqueadas. Preços históricos não são convertidos. A rotina
não altera impostos, assinaturas, histórico de compras ou flags comerciais.

A sincronização Stripe/banco não é uma transação distribuída: pode concluir
parte do catálogo antes de encontrar um conflito. A retomada reutiliza IDs,
mas requer conferência de antes/depois. Escritas de vínculos verificam o retorno
do banco e recusam substituir IDs que tenham divergido durante a execução.
Master legado v1 incompatível é bloqueado para reconciliação, não convertido.
O operador não cria sessões Checkout nem links de pagamento independentes.

## Inventário anterior à retirada

```bash
pnpm stripe:inventory --mode=live
```

Sem `--capture`, é apenas uma prévia: não acessa a API e não comprova inventário.
Com `--capture`, exige chave do modo escolhido e
`LEIPROVA_COMMERCE_EXPECTED_STRIPE_ACCOUNT=acct_1TCQvlBkl6797u2u` e confere a
conta recebida antes de listar. As credenciais ficam em armazenamento privado
operacional, nunca no comando, Git, canvas ou conversa.

O operador usa somente leituras na Stripe. Percorre produtos, preços ativos e
arquivados, links ativos, sessões abertas e assinaturas, paginando também os
itens. Guarda IDs e relações comerciais, sem objetos de cliente, e-mails,
endereços, dados de cartão, URLs de sessão ou metadata arbitrária.

O relatório fica em `.local/commerce/stripe-inventory/`, fora de Git e Docker,
com permissão 600 e hash. Erros, páginas incompletas ou limite excedido abortam
a captura. O limite é de 10 mil por coleção; preços ativos e arquivados são
coleções separadas. `catalogPrices` exclui preços inline, conforme a API da
Stripe. No modo test, assinaturas vinculadas a Test Clocks não integram a lista
padrão. O relatório explicita essas exclusões e não é auditoria financeira completa.
É uma leitura paginada durante uma janela de tempo, **não um snapshot
transacional da conta**. Os objetos podem mudar; conferir cada ID antes de agir.

## Retirada segura dos antigos

1. Capturar inventário completo antes de criar novos produtos; separar IDs que
   serão preservados/reutilizados dos antigos. Não aplicar filtros móveis de
   “todos os produtos” depois de iniciar a criação.
2. Conferir vínculos de assinaturas. Se surgirem produtos de outros projetos,
   resolver o escopo concreto com o responsável antes de uma retirada ambígua.
3. Preferir arquivar produtos/preços e desativar links. Isso é recuperável e
   preserva o histórico; não equivale a cancelar a assinatura de um cliente.
4. Sessões Checkout abertas precisam de análise e expiração individual quando
   elegíveis; sessões concluídas, pagamentos e faturas permanecem como histórico.
5. Guardar antes/depois por ID e informar o que foi retirado e como recuperar.

O operador de inventário **não implementa remoção em massa**. Não existe neste
comando uma flag escondida de exclusão ou arquivamento.

O operador separado `scripts/retire-stripe-catalog.ts` tem prévia sem rede e
aplicação explícita, limitada aos 19 produtos confirmados. Exige o snapshot UI
autorizado e inventário API privado recente; bloqueia links ativos ou sessões
abertas. Registra cada intenção e confirmação em recibo privado durável.
Ver [escopo e execução do arquivamento](STRIPE-ARQUIVAMENTO-ESCOPO-20260906.md).

A Stripe limita a exclusão de produtos/preços conforme os vínculos e uso.
Referências oficiais: [gerenciamento e arquivamento](https://docs.stripe.com/products-prices/manage-prices)
e [API de produtos](https://docs.stripe.com/api/products/list). As assinaturas
existentes não são canceladas simplesmente pelo arquivamento do produto.

## Conexão e aplicação do catálogo

1. Acessar a conta correta no Chrome Vini, conferir modo live e estado cadastral.
2. Criar, se necessário, credencial restrita dedicada à Editalume. Não reutilizar
   chaves de outros projetos nem alterar segurança global por conveniência.
   Sincronização precisa conta/produtos/preços; inventário também precisa ler
   links, Checkout, assinaturas e itens. O runtime tem necessidades próprias de
   clientes, sessões, faturamento, portal e reconciliação.
3. Fazer backup do banco exclusivo da Editalume antes de gravar vínculos e registrar
   estado prévio da configuração. Não abrir novas permissões para `leiprova_app`
   só para executar manutenção: usar conexão operacional explícita e limitada.
4. Conferir prévia `pnpm stripe:catalog --mode=live`. `--apply` exige conta, modo,
   domínio, ambiente e banco explícitos; nada deve apontar para homologação.
   Antes de chamar Stripe, o sincronizador confere identidade real do banco,
   usuário atual/de sessão, schema, RLS e os 26 privilégios de coluna usados.
   A inspeção termina em transação somente leitura curta e não concede grants.
   Usuários `*_app`, réplica e destino somente leitura são recusados. Ainda é
   necessário usar a rota SSH/VPS autorizada; o preflight não autentica por si
   só a máquina nem garante disponibilidade/permissões futuras.
5. Persistir IDs retornados, inclusive `STRIPE_PRICE_RITMO` e `STRIPE_PRICE_FOCO`,
   apenas na configuração do ambiente correspondente. Nunca executar seed.
6. Conferir os 76 produtos e 152 preços por leitura da API, apresentação e IDs
   no banco; só então declarar catálogo configurado. Não declarar checkouts
   funcionais apenas porque há objetos de produto.

## Antes de abrir vendas

Permanece necessária a credencial LIVE própria do runtime, com permissões
adequadas de checkout/faturamento e chave publicável do mesmo modo. A chave
restrita de manutenção não pode ser ampliada ou reutilizada silenciosamente.
Depois, homologação externa: pagamento inicial, renovação,
inadimplência, cancelamento, reembolso, eventos repetidos/fora de ordem, perda
de execução e recuperação. O webhook de concursos ainda tem pendências de
recuperação de `processing`; entrega durável de mensagens também não foi
concluída. Não há confirmação de WhatsApp de entrega funcionando.

Também faltam vínculos editoriais válidos e o mínimo de 68 questões por curso.
O lote privado recém-criado para Analista MP-SP não supre os 75 produtos.
Ver `STRIPE-PENDENCIAS-HOMOLOGACAO.md`, `MASTER-RECONCILIACAO-PENDENTE.md` e
`MINIMO-68-POR-CONCURSO.md`. Preservar as guardas de conteúdo, titularidade,
fornecedor e pagamento; não habilitar vendas para contornar essas pendências.

Esta preparação não transforma Checkout hospedado dos concursos em formulário
embutido: a página de seleção é própria, a etapa financeira continua na Stripe.

## Verificação desta preparação

Lint, typecheck e **1082 testes passaram**; 150 integrações opcionais
não foram executadas. As prévias de inventário e catálogo funcionaram sem
credencial e sem acesso à API. O inventário recebeu revisão independente,
incluindo testes de paginação, modo e redirecionamento de pasta privada.
O preflight do banco recebeu revisão independente; 49 testes focais novos
passaram. Os testes de sincronização usam fakes: não são homologação Stripe
live ou test. A emissão da chave, os inventários API, o arquivamento e a
sincronização controlada estão registrados acima. O novo operador de arquivamento passou em 26 testes
focais; as alterações de marca passaram em 175 testes focais distintos, lint e
typecheck. O build local da marca passou; a refatoração posterior do operador
somente operacional passou novamente em lint, typecheck e suíte completa.
Publicação app-only de `66ad154` em 06/09/2026, 15h13 BRT, após o build na VPS.
Imagem da aplicação: `sha256:871d54266b4b09a8c3b132b2e1c185487ccf832ad5ac19338f0afad2c1dd7182`.
Saúde aprovada, `/api/health` retornando `ok`, página PGM-RJ conferida no navegador
com Editalume e ofertas R$67/mês / R$347/ano, mostrando vendas ainda não abertas.
As 346 questões mantiveram o hash integral `639ad91749f2714f4dd3d8672666d95e`.
Homologação permaneceu na mesma imagem e data de criação; não foi recriada.
Nenhum e-mail, WhatsApp, pagamento, reembolso ou liberação editorial foi realizado.
