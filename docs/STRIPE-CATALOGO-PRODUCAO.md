# Catálogo Stripe — preparação de produção

## Estado verificado em 06/09/2026

O proprietário solicitou retirar os produtos e checkouts antigos da conta
2timeWeb e integrar os 75 concursos e o Master. A autorização não significa
cancelar assinaturas, reembolsar clientes, apagar faturas ou alterar projetos
vizinhos da VPS. Antes de qualquer retirada, identificar os objetos exatos.

**Nenhum produto, preço, link, sessão, assinatura ou chave Stripe foi criado,
removido ou alterado nesta rodada. Nenhuma sincronização remota foi executada.**

- Conta autorizada: `acct_1TCQvlBkl6797u2u`, Chrome **Vini** (`Profile 4`).
- O Chrome estava em execução, sem conexão de depuração disponível para
  `agent-browser --auto-connect`. Uma sessão anterior também não conectou.
- Foi solicitada exceção ao proprietário para controle visual do Chrome;
  não presumir que a exceção já foi concedida. Não copiar perfil/cookies.
- No aplicativo de produção, a presença e o modo foram conferidos sem exibir
  valores: chave secreta **test**, chave publicável ausente, segredo de webhook
  presente. A presença de segredo não prova que o endpoint esteja homologado.
- `CHECKOUT_ENABLED=false` e `CONTEST_CHECKOUT_ENABLED=false` confirmados.
- O catálogo externo atual ainda não foi inventariado; não afirmar quantidades
  de produtos antigos, links removidos ou clientes afetados.

## Catálogo que será sincronizado

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

IDs e metadata exatos identificam produtos do LeiProva. Arquivados compatíveis
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

A Stripe limita a exclusão de produtos/preços conforme os vínculos e uso.
Referências oficiais: [gerenciamento e arquivamento](https://docs.stripe.com/products-prices/manage-prices)
e [API de produtos](https://docs.stripe.com/api/products/list). As assinaturas
existentes não são canceladas simplesmente pelo arquivamento do produto.

## Conexão e aplicação do catálogo

1. Acessar a conta correta no Chrome Vini, conferir modo live e estado cadastral.
2. Criar, se necessário, credencial restrita dedicada ao LeiProva. Não reutilizar
   chaves de outros projetos nem alterar segurança global por conveniência.
   Sincronização precisa conta/produtos/preços; inventário também precisa ler
   links, Checkout, assinaturas e itens. O runtime tem necessidades próprias de
   clientes, sessões, faturamento, portal e reconciliação.
3. Fazer backup do banco exclusivo LeiProva antes de gravar vínculos e registrar
   estado prévio da configuração. Não abrir novas permissões para `leiprova_app`
   só para executar manutenção: usar conexão operacional explícita e limitada.
4. Conferir prévia `pnpm stripe:catalog --mode=live`. `--apply` exige conta, modo,
   domínio, ambiente e banco explícitos; nada deve apontar para homologação.
5. Persistir IDs retornados, inclusive `STRIPE_PRICE_RITMO` e `STRIPE_PRICE_FOCO`,
   apenas na configuração do ambiente correspondente. Nunca executar seed.
6. Conferir os 76 produtos e 152 preços por leitura da API, apresentação e IDs
   no banco; só então declarar catálogo configurado. Não declarar checkouts
   funcionais apenas porque há objetos de produto.

## Antes de abrir vendas

Permanece necessária homologação externa: pagamento inicial, renovação,
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

Lint, typecheck, build e **988 testes passaram**; 150 integrações opcionais
não foram executadas. As prévias de inventário e catálogo funcionaram sem
credencial e sem acesso à API. O inventário recebeu revisão independente,
incluindo testes de paginação, modo e redirecionamento de pasta privada.
Os testes de sincronização usam fakes: não são homologação Stripe live ou test.
Nenhum deploy, escrita de banco, emissão de chave ou captura autenticada foi
executado. Código salvo em branch de desenvolvimento; produção não atualizada.
