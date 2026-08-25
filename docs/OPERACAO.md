# Operação do LeiProva

Documento de contexto para quem for continuar o projeto — pessoa ou assistente de IA.
Descreve onde as coisas estão, como publicar e quais armadilhas já custaram tempo.

Última verificação completa: 2026-08-25.

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
1.25.2), `leiprova-db` (postgres:17.10-alpine).

## Publicar em produção

```bash
git push origin main
ssh wisewolf-vps 'cd /opt/leiprova && ./deploy/pull-deploy.sh'
```

O `pull-deploy.sh` traz a ref por fast-forward e encadeia o `deploy.sh`, que
compila as imagens, sobe banco e pool, roda migrations, reaplica privilégios,
executa o seed idempotente e recria o app. Só o `leiprova-app` é recriado; banco
e pooler continuam de pé. A janela de indisponibilidade é de poucos segundos.

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
