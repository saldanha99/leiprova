# Publicação e abertura comercial — 05/09/2026

**Atualização posterior:** redesenho dos cursos publicado em `c4f70c3`, com
75 URLs verificadas e acervo preservado. A sessão autenticada da Stripe na
aba original do perfil Vini está acessível, conta `acct_1TCQvlBkl6797u2u`.
Formulário de chave restrita aberto, sem salvar. Não pedir novo login/CDP.
Nenhuma configuração Stripe live criada; pendências de homologação e conteúdo
abaixo continuam válidas. Ver [resultado editorial v2](DESIGN-CURSOS-V2.md).

## Autorização e escopo

O proprietário solicitou preparar todos os checkouts para produção e autorizou as publicações. Os valores apresentados foram R$67/6 meses e R$87/12 meses por edição; Master R$297/mês e R$897/ano. A autorização comercial não é uma declaração de revisão individual de editais ou questões, nem licença para conteúdo de terceiros.

Escopo: somente LeiProva, `/opt/leiprova`, domínio `https://leiprova.2b.app.br`. Não alterar projetos vizinhos, infraestrutura compartilhada, dados de outros serviços ou permissões globais.

## Conferência inicial na produção

- Git do Mac, GitHub e VPS alinhados em `902c46ef6b1def0dbda202f8787613867bab27e1`; checkout da VPS sem alterações locais.
- Aplicação e banco saudáveis; aproximadamente 34 GB disponíveis no volume.
- Acervo: 232 questões revisadas, 12 pendentes; seis oportunidades revisadas; **zero vínculos entre questões e edições**.
- Nenhuma assinatura ativa ou histórica e nenhuma conta sintética de QA nessa base.
- Planos do banco: R$297 mensal e R$897 anual, iguais à oferta central.
- Identificação do fornecedor e remetente transacional completos. Cadastro e checkout fechados; contato e envio transacional configurados.
- Chaves de pagamento e chave pública da Stripe em TESTE. Inspeção somente de leitura da conta retornou HTTP 403 com a chave restrita; identidade e habilitação live da conta não foram confirmadas. Nenhum produto, preço, cobrança ou webhook criado na Stripe.

## O que pode ser publicado agora

O menu, as 75 páginas comerciais de planejamento, os preços propostos e as prévias de checkout podem ser publicados como **em preparação**. O tour é ilustrativo e não comprova conteúdo disponível. Cada edição permanece sem venda, com `noindex` e fora do sitemap até validação e liberação. Os registros oficiais já revisados mantêm suas regras existentes.

Não transformar as 232 questões gerais em 75 cursos por associação automática. É necessário validar a edição/cargo/programa, produzir e revisar seu conteúdo, conferir fontes e registrar os vínculos corretos. As 12 questões pendentes não são aprovadas por esta autorização.

## Preparação técnica para live

- `STRIPE_PAYMENTS_MODE=live` no serviço de produção. Chaves teste ou mistura de chaves pública/secreta são recusadas, mesmo que alguém abra a flag por engano.
- `CONTEST_CHECKOUT_ENABLED` é encaminhada pelo Docker Compose, com padrão fechado. `CHECKOUT_ENABLED` também continua fechado até a homologação.
- Webhooks e portal não dependem da flag de novas vendas para processar cancelamentos de clientes existentes, mas exigem credenciais do modo correto.
- `scripts/sync-contest-stripe.ts --mode=live` faz simulação sem escrita: 75 produtos, 150 preços avulsos, dois preços Master.
- `--apply` exige chave live, ambiente `production`, domínio exato, banco `leiprova` e `LEIPROVA_COMMERCE_EXPECTED_STRIPE_ACCOUNT=acct_...` confirmado. A conta precisa corresponder e estar habilitada. A chave restrita deve permitir leitura de conta e operações de produtos/preços. O script recusa mistura de modos no banco, verifica os valores dos planos e não troca o catálogo Master quando já existem assinaturas ativas sem reconciliação.
- Sincronização é retomável por identificação e idempotência. Preços ficam associados ao produto específico; IDs Master são gravados no banco e exibidos para atualização das variáveis públicas de preço. Não são criadas sessões nem cobranças e nenhuma edição é liberada automaticamente.
- Homologação usa banco com sufixo `_test` ou `_staging`, credenciais teste e domínio separado. O domínio público não aceita teste.

## Pendências que impedem vendas reais

1. Rotacionar as credenciais que tenham circulado fora do ambiente seguro e configurar chave live, chave pública live e webhook live na VPS. Não enviar segredos por chat nem copiá-los para o repositório.
2. Confirmar conta Stripe correta, habilitação para cobranças e permissões da chave. Registrar o endpoint `/api/stripe/webhook`, com assinatura e versão compatíveis (`2026-07-29.dahlia`). Incluir os eventos de Checkout, assinaturas/faturas e reembolso/contestação usados pelo processador.
3. Homologar o fluxo completo com credenciais de teste em ambiente separado, incluindo retorno, eventos atrasados/repetidos, cancelamento e falha de rede. As limitações de reconciliação de sessão sem ID persistido e reembolso parcial estão descritas no documento de comércio; não declarar o sistema pronto para cobrar antes de resolvê-las/validá-las.
4. Liberar editorial e comercialmente cada edição com conteúdo pertinente. Não usar apenas o mínimo técnico de uma questão como comprovação de um curso completo.
5. Conferir condições comerciais, atendimento e termos que correspondam ao acesso avulso e ao Master efetivamente entregues. Só então abrir cadastro e vendas, preservando controle de acesso.

Referências primárias: [Checklist live da Stripe](https://docs.stripe.com/get-started/checklist/go-live) e [separação das chaves e ambientes](https://docs.stripe.com/keys).

## Verificação e publicação

Lint, TypeScript, build de produção e 472 testes em 63 arquivos aprovados. Inclui sete novos testes para recusar teste no domínio público, chaves misturadas e destinos de sincronização incorretos. A simulação live realizou zero escritas externas.

Publicar somente após backup verificável e com `LEIPROVA_SKIP_SEED=1`. A migration 0031 acrescenta três tabelas comerciais; reaplicar `deploy/grant-app-role.sql`. Não executar seed legado nem copiar contas/dados de QA para produção. Conferir saúde, catálogo, página de concurso, checkout bloqueado e preservação das contagens após deploy.

## Resultado da execução

- Publicação concluída em 05/09/2026, código `2732a9d2700dd057a7b80288fbdbfe4a9c5cf8fb`. Branch de funcionalidade integrada por fast-forward à main; deploy da ref exata, sem seed.
- Backup anterior verificado por `pg_restore --list`, preservado na VPS e copiado para a área privada do Mac: `leiprova-before-contest-commerce-20260905T221153Z.dump`. SHA-256 `770bd21aa90ef5c2107eea4efd030de35319fdb11211a5a39f435974343f503b`. Nenhum backup anterior removido.
- Migration 0031 aplicada (registro 32 no histórico), privilégios restritos reaplicados e serviços LeiProva saudáveis. Nenhum serviço de outro projeto reiniciado.
- As 75 linhas comerciais foram cadastradas no banco de produção em `draft`, com modo de destino `live`, **sem IDs Stripe, vínculos editoriais ou liberação de venda**. Isso registra a preparação, não a criação de 75 produtos na Stripe.
- Contagens preservadas: 232 questões revisadas, 12 pendentes e seis oportunidades revisadas. Zero pedidos, zero compras e zero contas QA na produção.
- As 75 URLs do novo catálogo responderam HTTP 200, com uma H1, canonical própria e `noindex`; nenhuma falhou. Menu abriu no celular; catálogo em 390px sem rolagem horizontal.
- Saúde pública HTTP 200. Endpoints de checkout Master e avulso retornaram HTTP 503 com as flags fechadas, sem gerar compra. Stripe live não configurada/aplicada; solicitação de configuração segura encaminhada ao proprietário.
- Catálogo público: https://leiprova.2b.app.br/concursos. Checkout por edição publicado como prévia: https://leiprova.2b.app.br/checkout/concurso/pc-ba-delegado-2026.

**Resultado parcial do objetivo:** páginas e infraestrutura publicadas; recebimento de pagamentos reais e liberação dos cursos continuam bloqueados pelas pendências acima. Não foi registrada aprovação editorial fictícia nem movido dinheiro.
