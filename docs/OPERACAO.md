# Operação da Editalume

Documento de contexto para quem for continuar o projeto — pessoa ou assistente de IA.
Descreve onde as coisas estão, como publicar e quais armadilhas já custaram tempo.

Última aplicação verificada: 06/09/2026, 15h49 BRT (18h49 UTC).
As seções antigas abaixo são histórico; consulte os registros recentes antes de operar.

**Auditoria operacional e pausa Stripe (06/09/2026, 16h10 BRT):** aplicação e
fonte já publicadas e sincronizadas; nenhuma alteração de runtime pendente.
Stripe pausada pelo proprietário, sem novas tentativas de credenciais. Monitor
de 10 normas/4 portais ativo; coletor de 9 fontes cadastradas ativo, porém último
ciclo com 7 falhas e zero capturas novas. 134 requisitos em rascunho, nenhum
mapeado a artigo, fila de geração vazia. Não há operação nacional autônoma nem
geração contínua pelo Maestri comprovada. Ver
[estado auditado e passagem ao time](ESTADO-OPERACIONAL-2026-09-06.md).

**Checkout, entrega e curadoria publicados (`dff881c`, 06/09/2026):** pagamento
por concurso preparado com Elements na página, retomada/cancelamento protegidos,
Master sem tentativas concorrentes independentes, webhook transacional e fila
durável de confirmação por compra/produto. Nova UI administrativa revisa apenas
o vínculo exato, com decisão humana; não aprova questão nem publica produto.
Migrations 0034–0036 e privilégios mínimos aplicados, sem seed. App saudável,
conteúdo/catálogo/planos preservados por hashes, homologação e demais serviços
preservados. 1.174 testes gerais, 139 PostgreSQL adicionais e 12 testes de lock
com papel restrito aprovados; lint, typecheck e builds local/Docker passaram.
Nova leitura Stripe confirmou 76 produtos ativos +152 preços Editalume.
**Checkout continua fechado; chave runtime ainda test.** Worker de entrega
publicado, mas `PURCHASE_DELIVERY_ENABLED=false`; fila vazia. Um e-mail operacional
foi aceito pelo Resend, sem comprovação de entrega e sem compra. WhatsApp não
integrado. Zero dos 75 cursos com o piso válido de 68. Chave de pagamentos só
preparada no Chrome Vini, não criada. Sem canal Maestri disponível nesta sessão:
documentação atualizada não comprova alteração do canvas. Ver
[publicação, backup, imagens e limites](CHECKOUT-ENTREGA-2026-09-06.md).

**Editalume e catálogo Stripe publicados (`66ad154`, 06/09/2026):** pedido de
retirada do catálogo antigo e inclusão dos 75 cursos + Master registrado.
Conexão com Chrome Vini via `agent-browser` indisponível; proprietário autorizou
exceção para controle visual. Aba Vini/2timeWeb acessada: catálogo visual com
23 produtos antigos (19 ativos, 4 arquivados), incluindo marcas de outros
projetos; telas de assinaturas ativas e Payment Links vazias, sem inventário
API ainda naquela inspeção inicial. Proprietário confirmou o escopo dos 19 ativos, incluindo as outras
marcas, e a criação da chave restrita. Após verificações de e-mail e autenticador,
a chave `Editalume - catalogo e inventario live` foi emitida e salva com proteção
no Mac/VPS por formulário local privado. Conta própria validada pela API, com
pagamentos/cadastro/recebimentos habilitados. Inventário API: 23 produtos, 19
ativos, 26 preços, zero links ativos, sessões abertas ou assinaturas.
Não usar essa chave limitada de manutenção como credencial do checkout.
Conferência final das variáveis corretas do app: chave secreta test, publicável
test, segredo webhook presente, vendas fechadas. A chave live de manutenção é
separada do runtime; não concluir que pagamento/entrega estejam operacionais.
Os 19 produtos antigos autorizados e seus 22 preços foram arquivados; os quatro
já arquivados e todo o histórico foram preservados. Nenhuma flag alterada.
Inventário após arquivamento confirmou zero produtos ativos. Sincronização dos
75 cursos e Master concluída em contêiner operacional separado; leitura final
validou **76 produtos ativos e 152 novos preços**, valores/recorrência, imagem,
URL e todos os vínculos no banco. Quatro preços históricos dos quatro produtos
já arquivados continuam preservados, fora do catálogo Editalume. Total na conta:
99 produtos (76 ativos/23 arquivados), 178 preços; sem sessões, links ativos ou
assinaturas. Os dois preços Master também foram configurados no app.
Backup exclusivo anterior às escritas verificado no Mac/VPS; 75 produtos locais
com os vínculos Stripe completos e 346 questões preservadas por hash integral.
A marca pública foi
centralizada como Editalume no código e no contexto documental do time, sem
mudar domínio ou identificadores técnicos. Isso não comprova alteração do canvas.
Preparados inventário privado somente leitura, apresentação/retomada do
sincronizador e preflight de identidade/permissões do banco antes da Stripe.
1082 testes, lint e typecheck passaram; build da marca aprovado; 150 integrações
opcionais ignoradas. Deploy app-only aprovado, saúde `ok`, página PGM-RJ
conferida no navegador. Homologação não recriada; sem seed, migração, grants,
e-mail ou WhatsApp de entrega, cobrança ou liberação editorial. Imagem:
`sha256:871d54266b4b09a8c3b132b2e1c185487ccf832ad5ac19338f0afad2c1dd7182`.
Catálogo LIVE criado não significa checkout aberto: faltam runtime, homologação
de pagamentos/entrega e o mínimo válido de conteúdo por concurso.
Ver [estado, acesso e execução do catálogo Stripe](STRIPE-CATALOGO-PRODUCAO.md).

**Autoria privada por cargo (06/09/2026, sem deploy):** 68 novos rascunhos para
treino VUNESP / Analista Jurídico MP-SP, separados em 24 de Constitucional,
22 de Processo Civil e 22 de Processo Penal. Todos com cinco alternativas,
justificativas e fontes oficiais. Autores sem acesso aos simulados de terceiros;
revisão assistida separada e cotejo dos 68 recortes com o Planalto concluídos.
O operador privado gera caderno e recibo, mas não importa, aprova nem publica.
Comparação mecânica com 346 enunciados capturados por transação somente leitura;
nenhuma escrita no banco local/produção. Não há produto Analista MP-SP confirmado
no catálogo; não vincular ao Promotor MP-SP por compartilhar o órgão.
Revisão humana, programa e vínculos continuam pendentes. O piso válido dos
75 cursos não mudou. 932 testes passaram, 150 integrações opcionais ignoradas;
lint, typecheck e build passaram. Sem deploy, alteração de flags, homologação,
Stripe ou gasto OpenRouter. Sem CLI Maestri disponível: agentes Codex executaram
a rodada, não houve alteração de grafos. Ver
[autoria por cargo e caderno privado](AUTORIA-ISOLADA-POR-CARGO.md).

**Preparação dos 75 cursos publicada (`9c7dd4e`):** caderno individual no catálogo
administrativo, fontes e pendências por cargo/edição, plano exportável com piso de 68 questões.
Não gerou/importou/aprovou novas questões. Auditoria após deploy: 312 revisadas,
12 pendentes, 22 rascunhos; ENAM com 68 propostas distintas pendentes; zero produtos
com oportunidade associada e zero cursos no piso válido. Hashes antigos iguais.
Backup verificado no Mac/VPS; app-only, sem seed/migração/grants. Homologação
permaneceu na mesma imagem e data de criação. Checkout continua fechado.
889 testes passaram com concorrência reduzida; 150 integrações opcionais não
executadas. Lint, typecheck e build passaram. QA visual de componente em 390/1440px,
sem overflow; produção saudável e admin redirecionando visitante sem sessão.
Serviço de revisão de vínculos preparado, mas sem rota/UI/privilégios: não está
ativado. Ver [resultado e limites](EXPANSAO-EDITORIAL-75.md).

**Referências por banca/cargo (06/09):** análise privada de três simulados únicos,
300 questões, para parametrização específica de Analista Jurídico MP-SP. Não é
corpus oficial VUNESP, não foi publicado nem alterou o perfil ativo da banca.
Regras persistidas em `AGENTS.md` e
[política de referências](REFERENCIAS-POR-BANCA-E-CARGO.md). PDFs/dossiês somente
em `.local/editorial/vunesp-referencias-20260906/`; proibido incorporá-los a Git,
Docker ou acervo de questões. O Simulado 1 já contém comentários; 2 e 3 não.

**Piso de 68 questões e revisão dos 80 publicados (`9f58d5d`):** novas vendas
exigem 68 questões distintas com vínculo válido ao produto exato, sem revogar
em bloco o acesso de quem já comprou. Painel administrativo mostra meta/déficit.
As 80 receberam revisão e declaração humana específicas; 22 novas FGV foram
importadas apenas como rascunhos. Total: 346 questões, sendo 312 revisadas,
12 pendentes e 22 rascunhos. ENAM tem 68 candidatas distintas, nenhuma com vínculo
aprovado; as 79 linhas pendentes incluem 11 versões históricas. **Zero dos 75
cursos já cumpre o mínimo válido.** Produtos/edital, requisitos e curadoria ainda
precisam de revisão. Acervo antigo preservado, backup verificado, deploy sem seed,
nenhuma nova migração nem escrita no banco local, homologação não alterada.
Stripe continua sem produtos/preços dos concursos vinculados e vendas fechadas.
Ver [resultado, recibos e próximos passos](MINIMO-68-POR-CONCURSO.md).

**Conteúdo por produto e reembolsos publicados (`b55327a`):** reconciliador Master
integrado, migration 0033 e isolamento por produto. 80 questões novas importadas
somente como rascunhos, 46 propostas ENAM pendentes e 14 bloqueadas por divergência
de disciplina. Total 324 questões: 232 revisadas, 12 pendentes e 80 rascunhos.
Acervo anterior preservado por comparação de hashes; deploy sem seed, backup no
Mac e VPS, app saudável e homologação não alterada. Os 75 produtos ainda não têm
preços/produtos Stripe vinculados; vendas permanecem fechadas. Revisão humana,
homologação Stripe e entrega transacional continuam pendentes. Houve também um
desvio de migração no banco local, separado da produção, informado ao responsável.
Veja o [resultado completo e limites](OPERACAO-CONTEUDO-REEMBOLSOS-2026-09-06.md).

**Homologação persistente e checkout premium publicados (`282474b`):**

- [Homologação](https://homolog.leiprova.2b.app.br/entrar) com três perfis
  sintéticos validados: administrador, Master e cliente de um concurso. Banco,
  volume, rede interna e imagens separados da produção; HTTPS válido, aviso
  visível e bloqueio de indexação. Senhas apenas no arquivo privado indicado em
  [acessos operacionais](ACESSOS-OPERACIONAIS.md).
- Cloudflare acessada no **Chrome Daniel**; registro A `homolog.leiprova`
  criado para `187.127.46.251`, DNS only, TTL Auto. Os demais registros foram
  preservados. Stripe permanece no **Chrome Vini**. Informação também salva
  em `AGENTS.md` e na nota ACCESS-ROUTING do workspace exclusivo do Maestri.
- Produção recompilada e publicada sem seed, após backup verificado. App
  saudável, `/api/health` retornando `ok`, checkout público PGM-RJ conferido
  no navegador e em viewport mobile. Acervo preservado: 232 revisadas e 12
  pendentes. A homologação permaneceu saudável e sem recriação neste deploy.
- Checkout por concurso com cartões mensal/anual distintos, economia anual
  de R$457 (aproximadamente 57%), adicionais opcionais desmarcados e alternativa
  Master. A finalização de pagamento continua hospedada pela Stripe; esta entrega
  personaliza a página de escolha, não implementa um formulário próprio de cartão.
- `CHECKOUT_ENABLED=false` e `CONTEST_CHECKOUT_ENABLED=false` confirmados no
  app publicado. Botão de compra desabilitado. Nenhuma cobrança, chave Stripe
  ou produto externo foi criado nesta entrega. O catálogo preparado prevê
  75 produtos de concurso + um Master, total de 76 produtos e 152 preços.
- Sete nós e cinco notas observados no workspace **LeiProva — Fábrica Editorial**.
  Inicialização/modelos e layout final ainda precisam ser conferidos; o Mac foi
  bloqueado durante a interface. Não há geração contínua de questões ativada por
  essa montagem. Veja [estado do time](MAESTRI-FABRICA-EDITORIAL.md).
- Verificação local final: lint, typecheck e build aprovados; 702 testes passaram
  e 63 testes de integração foram ignorados por falta de seus ambientes opcionais.
  Esse total inclui preparação não integrada do contrato Master, posterior à
  imagem publicada. Os bloqueios reais de eventos antigos, estornos Master e
  recuperação de webhook continuam descritos em
  [Master pendente](MASTER-RECONCILIACAO-PENDENTE.md) e
  [homologação Stripe pendente](STRIPE-PENDENCIAS-HOMOLOGACAO.md).

Imagem de produção desta entrega:
`sha256:30c651a071a6fb4049db64bc8313c39e60cd91587f87b871c96440dbab4a9e0c`.
Backup anterior no Mac e na VPS: `leiprova-before-qa-checkout-20260906.dump`,
SHA-256 `6698dc48b448b3aabdbf53a28092f7066b1889909bf20bd0c6af23a1c5ce6628`.

**Nova regra comercial publicada em 05/09/2026 (`70e76fb`):** os 75 concursos individuais passam a
R$67/mês ou R$347/ano, assinaturas recorrentes. Propostas antigas de 6/12 meses
com pagamento único abaixo são históricas. Master inalterado. Veja
[assinaturas por concurso e estado de publicação](ASSINATURAS-POR-CONCURSO.md).
581 testes aprovados, 75 URLs conferidas em produção, migration 0032 aplicada,
acervo preservado. Configuração/homologação Stripe ainda pendentes; vendas fechadas.

**Redesenho publicado em 05/09/2026:** páginas de curso com direção editorial própria, fotografia sem pessoas, método visual, tour computador/tablet/celular e ofertas mais claras. Código `c4f70c3`, 547 testes aprovados, 75 rotas conferidas em produção, backup preservado e deploy sem seed. A aba original da Stripe no Chrome Vini já está acessível; chave live e homologação ainda não concluídas, vendas fechadas. Veja [design e resultado da publicação](DESIGN-CURSOS-V2.md).

**Publicação de catálogo em 05/09/2026:** menu premium, 75 páginas de planejamento e infraestrutura de compra avulsa publicados; migration 0031 aplicada. Cobranças permanecem fechadas: Stripe ainda em teste e nenhum conteúdo vinculado às edições. Acervo 232 revisadas + 12 pendentes preservado. Veja [publicação e pendências comerciais](PRODUCAO-CONCURSOS.md) antes de abrir vendas. As seções históricas abaixo não substituem essa conferência.

**Estado editorial verificado em 05/09/2026:** motor publicado, migrations até 0030,
160 questões novas aprovadas (40 por perfil interno), acervo anterior preservado.
Total: 232 revisadas e 12 pendentes. Backup verificado no servidor e no Mac.
Veja o resultado em [operação do lote de 160](OPERACAO-LOTE-160.md); as seções históricas
abaixo não devem ser usadas para inferir as contagens atuais.

Continuação autorizada em 05/09/2026: [operação controlada do lote de 160 questões](OPERACAO-LOTE-160.md).
Inclui compatibilidade explícita Planalto/Senado, confirmação humana vinculada ao conteúdo/mapeamento,
operador interno com papel restrito e deploy sem seed para preservar o acervo revisado.

Atualização de desenvolvimento em 05/09/2026: veja [operação automatizada — P0](OPERACAO-AUTOMATIZADA-P0.md)
para migrations, permissões e QA da nova fundação editorial. As mudanças foram validadas
somente localmente; o estado de produção descrito abaixo é histórico, não uma nova checagem da VPS.

Continuação local: [importação de rascunhos das assinaturas](IMPORTACAO-RASCUNHOS-LOCAIS.md),
com migration 0030 para ampliar locks do catálogo. Validada apenas no banco sintético;
sem aplicação na VPS ou aprovação/publicação das 160 questões do lote.

## Onde o projeto vive

| Ambiente | Endereço | Observação |
|---|---|---|
| Repositório | https://github.com/saldanha99/leiprova | Público. Commits assinados como `saldanhaClaw`, conta dona é `saldanha99`. |
| Produção | https://leiprova.2b.app.br | VPS Hostinger `srv1801171.hstgr.cloud`, IP `187.127.46.251`. |
| Acesso SSH | `ssh wisewolf-vps` | Alias já configurado, usuário `root`. |
| Diretório na VPS | `/opt/leiprova` | Clone de `origin/main`. |

A VPS é **compartilhada**: roda cerca de 28 contêineres de vários projetos
(Supabase completo, Forza, Hermes2, Wise Wolf, FisioAgenda), todos atrás de um
único Traefik na 80/443. Por isso o `docker-compose.yml` entra na rede externa
`forza` em vez de subir o próprio proxy. Verifique espaço em disco antes de
builds grandes — a máquina é dividida com os outros projetos.

Contêineres do projeto: `leiprova-app` (Next), `leiprova-pooler` (PgBouncer
1.25.2), `leiprova-db` (postgres:17.10-alpine), `leiprova-legal-monitor`
(fontes jurídicas) e `leiprova-editorial-automation` (editais e fila).

## Publicar em produção

```bash
git push origin main
ssh wisewolf-vps 'cd /opt/leiprova && LEIPROVA_SKIP_SEED=1 ./deploy/pull-deploy.sh'
```

O `pull-deploy.sh` traz a ref por fast-forward e encadeia o `deploy.sh`, que
compila as imagens, sobe banco e pool, roda migrations, reaplica privilégios e
recria app e workers quando necessário. Banco e pooler permanecem de pé.
Use `LEIPROVA_SKIP_SEED=1` em atualizações para preservar o acervo; sem essa
variável o script também executa o seed. Homologação usa seu compose e suas
imagens fixadas, não o comando de produção. Há uma breve janela de reinício do app.

O script **aborta** se encontrar alteração local não commitada em
`/opt/leiprova`. Isso é proposital: até 2026-08-23 o deploy era cópia manual de
arquivos do Mac, e o servidor divergiu do código-fonte sem ninguém perceber —
havia uma versão antiga de `tests/stripe-connect.test.ts` e dois arquivos órfãos
(`route.ts`, `stripe-connect.ts`) largados na raiz por um hotfix. Se o script
reclamar, leve a correção para o repositório em vez de forçar.

`/opt/leiprova/.env` **não é versionado** e sobrevive a qualquer deploy.
Permissão `600`, dono `root`. `backups/` está em `.git/info/exclude`.

Verificações após publicar:

```bash
ssh wisewolf-vps 'docker ps --filter name=leiprova'
curl --fail https://leiprova.2b.app.br/api/health
```

## Rodar localmente

Requer Node 22+ (24 funciona), pnpm 11 e PostgreSQL.

```bash
pnpm install
cp .env.example .env      # preencha DATABASE_URL e MIGRATION_DATABASE_URL
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Comandos de verificação — todos passando na última checagem
(56 testes em 11 arquivos):

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

O `pnpm build` funciona **sem `.env`**: nada lê variável de ambiente em tempo de
import, e o `src/lib/db/client.ts` só conecta em runtime. Não é preciso banco
para compilar.

### Armadilha: scripts executados por tsx não liam o .env

O projeto não tem `dotenv`. O `drizzle-kit migrate` carrega o `.env` sozinho,
mas `tsx scripts/seed.ts` não — então `pnpm db:seed` falhava com
"Defina MIGRATION_DATABASE_URL ou DATABASE_URL" logo após o `cp .env.example .env`
que o README manda fazer. Em produção o problema não aparecia porque o Docker
injeta as variáveis.

Corrigido em `package.json` com `--env-file-if-exists=.env` nos scripts `db:seed`
e `admin:bootstrap`. Use essa flag, e não `--env-file`, em qualquer script novo
que rode por `tsx`: ela é no-op dentro do contêiner, onde não existe `.env`.

## Feature flags

Tudo que é comercial fecha por padrão. Estado em produção na última verificação:

| Flag | Produção | Significado |
|---|---|---|
| `REGISTRATION_ENABLED` | `false` | `/cadastro` exibe "Cadastros abrem em breve", sem formulário. |
| `CONTACT_ENABLED` | `false` | Formulário de contato fecha. |
| `PRIVACY_REQUESTS_ENABLED` | `false` por padrão | Abre somente o formulário de direitos LGPD em `/privacidade`; não abre cadastro, contato comercial ou checkout. |
| `CHECKOUT_ENABLED` | `false` | Sem chaves Stripe preenchidas. |
| `SUPPLIER_*` | vazias | Seis variáveis de identificação do fornecedor. Enquanto faltar qualquer uma, o checkout não abre — trava aplicada em `getCheckoutAvailability`, não em documentação. |
| `STRIPE_CONNECT_ENABLED` | `true` | **Diverge do README**, que pede `false`. |
| `STRIPE_CONNECT_ONBOARDING_ENABLED` | `true` | Idem. |
| `STRIPE_CONNECT_MODE` | `test` | Contém o risco do item acima. |
| `STRIPE_CONNECT_BR_APPROVED` | `false` | Trava final. |

`EDITORIAL_OWNER_APPROVER_EMAIL` identifica a única conta editorial proprietária. Ela pode
registrar a exceção `owner_override` na aprovação de um PDF oficial e concluir com a mesma
conta as revisões de fontes, compilações e requisitos. A nota humana continua obrigatória e a
auditoria registra `owner_self_review`. Outras contas continuam impedidas de revisar o que
elas mesmas iniciaram. Essa permissão nunca publica questões automaticamente.

O corpus jurídico integral é capturado em `/admin/fontes-oficiais` somente depois que a
fotografia de monitoramento da norma foi aprovada. A captura encontra a compilação monovigente
da mesma norma no Senado e permanece pendente. A conta proprietária configurada pode conferir e
aprovar a versão que ela própria capturou; a decisão exige nota, ativa os artigos em lote e fica
registrada na auditoria. A ausência de uma compilação monovigente bloqueia a importação, em vez
de promover texto original ou histórico.

O `leiprova-legal-monitor` confere fontes diariamente. Quando a fotografia atual já está
aprovada, ele também captura automaticamente uma nova compilação oficial para
`pending_review`; não ativa artigos. O `leiprova-editorial-automation` roda a cada seis
horas, procura PDFs elegíveis em fontes de concurso aprovadas, captura no máximo seis versões
novas por execução e extrai itens literais de PDFs já aprovados para `draft`. Falhas são
isoladas e auditadas; aprovação e publicação permanecem manuais.

A divergência do Connect está contida em quatro camadas: modo `test`, chave
`rk_test` (não live), `BR_APPROVED=false` e o único parceiro cadastrado em
status `restricted` com `charges_enabled` e `payouts_enabled` falsos. Nenhum
valor pode se mover. Ainda assim, decida se o README muda ou se a flag volta.

**Antes de ligar o checkout:** as chaves Stripe que circularam em conversa devem
ser tratadas como comprometidas e rotacionadas. Nunca versione segredo.

## Canal de privacidade

O formulário de `/privacidade` é independente dos canais comerciais. Quando
`PRIVACY_REQUESTS_ENABLED=true`, a solicitação é registrada em
`contact_messages`, recebe protocolo no formato `LP-LGPD-AAAAMMDD-XXXXXXXX` e
usa um modelo publicado no Resend para confirmar o recebimento.

Variáveis mantidas somente no `.env` da VPS:

```dotenv
PRIVACY_REQUESTS_ENABLED=true
SUPPLIER_DPO_CONTACT=lgpd@dominio.example
RESEND_LGPD_TEMPLATE_ID=identificador-do-modelo-publicado
LGPD_EMAIL_FROM=LeiProva Privacidade <lgpd@dominio.example>
```

O envio depende também de `TRANSACTIONAL_EMAIL_ENABLED`, `RESEND_API_KEY` e do
domínio autenticado. O formulário aplica honeypot, validação no servidor,
limites separados por IP/e-mail e não registra o IP em texto puro.

O atendimento comercial pode usar o próprio formulário de `/contato` como
endereço eletrônico do fornecedor, sem depender de caixa postal externa. Nesse
caso, configure `SUPPLIER_EMAIL` com a URL HTTPS do formulário e mantenha
`CONTACT_ENABLED=true`; as mensagens ficam registradas em `contact_messages`.

## Backups

`deploy/backup.sh` roda diariamente às 03:17 UTC, grava em
`/opt/leiprova/backups` e mantém 14 dias. Os dumps são pequenos porque o banco
de produção ainda está praticamente vazio (~11 MB). Copie periodicamente para
outro servidor ou armazenamento de objetos — hoje o backup vive na mesma
máquina que ele protege, o que não cobre perda do servidor.

Dump manual antes de uma mudança arriscada:

```bash
ssh wisewolf-vps 'docker exec leiprova-db pg_dump -U leiprova_owner -d leiprova -Fc' > pre-mudanca.dump
```

## Estado do conteúdo

`pnpm content:verify` confere as questões contra o Planalto e falha se um gabarito não for verbatim ou se um distrator reproduzir a norma.

O banco de produção tem **12 questões**, todas ancoradas na Constituição Federal,
assistidas por IA e conferidas contra a fonte oficial — mas **sem revisão humana
independente registrada**. Cinco delas são liberadas sem assinatura, listadas em
`src/lib/study/access-policy.ts`.

O catálogo de navegação já é amplo (13 carreiras, 4 bancas, 13 matérias, 45
tópicos), o que cria uma expectativa que o acervo ainda não sustenta. Ampliar
conteúdo é o gargalo do produto, não a engenharia.

O schema suporta três procedências, e a distinção é jurídica, não cosmética:

- `dry_law` — questão original de literalidade ancorada em fonte oficial;
- `previous_exam` — reprodução **só com licença**, titular e validade registrados;
- `original_style` — inédita, classificada pelo estilo da banca, revisada antes de publicar.

Textos de atos oficiais podem ser reproduzidos. Questões, comentários e
compilações de terceiros têm proteção própria: não faça scraping nem reutilize
cadernos de banca sem licença escrita.

## Nota para quem roda em macOS

Se o repositório estiver dentro de `~/Documents` e o processo não tiver Full Disk
Access, o TCC estrangula a I/O: `rename()` para fora da pasta trava
indefinidamente e leitura em massa cai para ~0,5 arquivo/s (`git status`, `tar` e
`rsync` parecem travados). Fora de `~/Documents` tudo volta ao normal. Solução:
conceder Full Disk Access em Ajustes do Sistema › Privacidade e Segurança.
