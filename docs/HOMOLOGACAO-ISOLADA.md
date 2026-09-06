# Acessos e homologação isolada

## Status atual — PUBLICADA E VALIDADA

Em **05/09/2026**, a homologação dedicada foi publicada e validada em
**https://homolog.leiprova.2b.app.br/entrar**, com o código aprovado `282474b`.
Ela é persistente na VPS e **não depende de o Mac permanecer ligado**.
Este ambiente não é produção: contém apenas cursos, exercícios e acessos
sintéticos para testar a plataforma, sem validade jurídica ou cobrança real.

| Perfil | Login | Acesso validado |
| --- | --- | --- |
| Administrador QA | `qa-admin@example.invalid` | Painel `/admin` |
| Cliente Master QA | `qa-master@example.invalid` | Área `/app`, cursos fictícios Alfa e Beta; sem painel administrativo |
| Cliente individual QA | `qa-avulso@example.invalid` | Área `/app`, somente o curso fictício Alfa; sem painel administrativo |

Para consultar as senhas, use
`.local/commerce/qa-persistente/ACESSOS-HOMOLOGACAO.md`, arquivo privado com
permissão 600, fora de Git e Docker. Não colar seu conteúdo em documentos,
conversas ou no canvas. As identidades têm os mesmos nomes dos testes antigos,
mas **as senhas da homologação persistente são diferentes das locais**.
Os acessos sintéticos Master e individual têm vigência até **05/10/2026**,
no horário de São Paulo; a renovação exige execução explícita do bootstrap.

Evidências da validação pública, realizada sem ignorar erros de certificado:

- HTTPS com certificado Let's Encrypt válido e `/api/health` retornando 200.
- Três logins concluídos; clientes redirecionados para `/app` ao tentar `/admin`.
- Master recebeu 4 exercícios Alfa e 4 Beta. Individual recebeu 4 Alfa e nenhum
  Beta; tentativa forçada de responder a Beta retornou 404, sem gravar tentativa.
- Checkout individual e Master retornaram 503, sem criar checkout, eventos ou
  referências Stripe. Cadastro, contato, e-mails e Connect continuam fechados;
  não há workers de geração ou publicação neste ambiente.
- Banner de homologação visível em desktop e mobile; cabeçalhos
  `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store`
  e `X-LeiProva-Environment: synthetic-qa` conferidos. A página estática de
  memorização usa o domínio de homologação em seu canonical.
- Banco novo com exatamente 3 perfis, 2 cursos e 8 exercícios sintéticos;
  nenhum dado de produção copiado. Contêineres, banco, volume e segredos próprios.
- Durante esta publicação de QA, a imagem, o contêiner e o horário de início
  da aplicação de produção permaneceram inalterados. Essa evidência se refere
  à operação de QA, não a deploys de produção posteriores e independentes.

O relatório técnico detalhado, sem senhas, está no arquivo privado
`.local/commerce/qa-persistente/VERIFICACAO-PUBLICACAO.md`.

## Por que os acessos antigos não funcionavam no site público

As contas `qa-admin@example.invalid`, `qa-master@example.invalid` e
`qa-avulso@example.invalid` foram criadas exclusivamente no banco sintético deste
Mac. O endereço é **http://127.0.0.1:3098/entrar**, não o domínio de produção.
Os três logins foram novamente validados em 05/09/2026; as senhas existentes não
foram trocadas. O Mac e os processos locais precisam continuar ligados.

As credenciais locais permanecem em `.local/commerce/ACESSOS-DE-TESTE.md` e
`.local/commerce/acessos-qa.json`, com permissão 600, fora de Git e Docker.
Administrador entra em `/admin`; clientes são redirecionados a `/app` se
tentarem acessar esse painel. Master tem acesso integral de QA; individual tem
uma única compra sintética PC-BA, não uma assinatura Master.

`setup-local-commerce-qa.ts` agora usa o plano mensal atual, renova a vigência de
homologação e atualiza a fixture de maneira idempotente. Não aceita conexão remota.

## Arquitetura do ambiente persistente publicado

Endereço validado: `https://homolog.leiprova.2b.app.br/entrar`.

- `deploy/docker-compose.qa.yml`: contêineres `leiprova-qa-app` e `leiprova-qa-db`;
  banco `leiprova_qa`, volume `leiprova_qa_pgdata`, rede `leiprova_qa_internal`.
- Nenhum volume, banco, usuário ou segredo de produção é reutilizado.
- Compartilha somente a rede externa `forza` para o Traefik, com nomes de rota
  e middleware exclusivos. Não altera o proxy compartilhado.
- O app tem **imagem própria de homologação**, compilada com
  `LEIPROVA_BUILD_PROFILE=qa`; não reutiliza a imagem do app de produção. O
  domínio e o aviso de QA são definidos também no build, preservando a geração
  estática e a performance das páginas reais. A imagem `migrator` aprovada pode
  ser reutilizada. Ambas são referenciadas por ID imutável.
- O build de QA é sequencial em relação a qualquer build de produção, reutilizando
  cache quando disponível, com um processo por vez e teto de 2 GiB no builder.
  Os limites dos contêineres permanentes abaixo não limitam o processo de build.
- Limites permanentes: app 640 MiB e banco 384 MiB, total 1 GiB. Ferramenta
  temporária de migration/fixture tem teto de 512 MiB e termina após o preparo.
- Não há porta pública de PostgreSQL, workers, e-mails, Stripe ou cadastro aberto.
- HTTPS obrigatório; cookies têm nome separado. Banner de homologação, cabeçalhos
  `X-Robots-Tag: noindex, nofollow, noarchive` e `Cache-Control: private, no-store`.
- Dados sintéticos: 3 perfis, 2 cursos fictícios (Alfa e Beta), 8 exercícios
  claramente sem validade jurídica. Taxonomia é carregada dos metadados do próprio
  código; não roda `seed.ts` nem copia dados de produção.
- Master acessa Alfa e Beta. Individual acessa apenas Alfa. A vigência é de
  aproximadamente 30 dias e pode ser renovada explicitamente pelo bootstrap.
- Registros de compra/assinatura são fixtures marcadas `test`/`synthetic_test`,
  sem cliente, sessão, assinatura, fatura ou pagamento Stripe. Não são faturamento.

Em 05/09/2026, o registro A de `homolog.leiprova.2b.app.br` foi criado no
Cloudflare pelo acesso do perfil Daniel, com TTL automático e destino
`187.127.46.251`. A resolução IPv4 já foi confirmada. Isso **não significa que
o DNS sozinho publique a aplicação**: inicialmente o ambiente ainda estava
pendente. Na sequência, a imagem própria de QA foi aprovada, os contêineres
foram iniciados, o certificado foi emitido e os três logins foram validados,
concluindo a publicação descrita acima.

Na conferência inicial, a VPS tinha aproximadamente 12 GiB de RAM disponível e
33 GB de disco livre. Após os builds, havia aproximadamente 29 GB livres e o
consumo observado era de 90 MiB no app e 52 MiB no banco. Ambos os contêineres
estavam saudáveis, com reinício automático; o builder exclusivo foi parado ao
final. São medições pontuais, que precisam ser repetidas antes de nova publicação.

## Procedimento preservado para novas publicações autorizadas

A primeira publicação já foi concluída. Os passos abaixo são o procedimento
operacional para uma atualização futura, não pendências do acesso atual.

1. Confirmar o registro DNS já criado: **A `homolog.leiprova.2b.app.br` →
   `187.127.46.251`**, TTL automático, somente DNS. Não deixar AAAA apontando para
   outro servidor.
2. No Mac, gerar artefatos privados, sem conexão externa:

   ```sh
   pnpm exec tsx --env-file-if-exists=.env scripts/prepare-persistent-qa.ts
   ```

3. Compilar e aprovar a imagem própria de QA usando o `Dockerfile` do projeto,
   target `runner`, argumento `--build-arg LEIPROVA_BUILD_PROFILE=qa` e tag
   exclusiva `leiprova-qa-app`. Não substituir a tag/imagem do app de produção.
   Não executar em paralelo com produção; usar builder limitado a 2 GiB.
   A imagem resultante deve conter o label `io.leiprova.build-profile=qa`.
4. Revisar o arquivo privado `.local/commerce/qa-persistente/.env`. Fixar
   `LEIPROVA_QA_APP_IMAGE` e `LEIPROVA_QA_TOOLS_IMAGE` com os IDs completos
   `sha256:...` das imagens QA e migrator aprovadas na VPS. `qa-start.sh` recusa
   uma imagem de app sem o label QA antes de iniciar qualquer contêiner. O
   preparo de acessos não troca senhas ao ser reexecutado.
5. Enviar apenas `.env` e `accounts.json` por SCP para
   `/opt/leiprova/.local/commerce/qa-persistente/`, diretório 700 e arquivos 600.
   Não colar segredos em terminal, conversa, logs ou Git.
6. Com código aprovado já disponível na VPS e estando em `/opt/leiprova`, executar:

   ```sh
   LEIPROVA_QA_ACTIVATE=synthetic sh deploy/qa-start.sh
   ```

7. Confirmar certificado HTTPS válido, `/api/health`, banner de homologação,
   cabeçalhos noindex, três logins, acesso individual bloqueado para Beta e
   usuários cliente impedidos de acessar `/admin`.
8. Somente então atualizar o status e entregar o arquivo privado
   `.local/commerce/qa-persistente/ACESSOS-HOMOLOGACAO.md`.

Não executar `docker compose down -v`: o volume persistente guarda os testes.
Para interromper a homologação de forma recuperável, usar exclusivamente o
compose de QA e `stop app db`; jamais os serviços reais do projeto.

## Verificação local da infraestrutura

As migrations completas foram aplicadas em um banco **novo e local** `leiprova_qa`.
O bootstrap foi executado novamente para conferir idempotência. Testes de guarda
recusam produção, hosts remotos, banco local incorreto e perfis com papéis trocados.
`tests/persistent-qa-access-postgres.test.ts` usa o papel restrito `leiprova_qa_app`
para conferir acesso Master, isolamento individual, resposta forçada de outro
curso e expiração. A URL de conexão de teste nunca aceita produção.

```sh
LEIPROVA_QA_TEST_DATABASE_URL=postgres://leiprova_qa_app@127.0.0.1:55439/leiprova_qa \
  pnpm exec vitest run tests/qa-safety.test.ts tests/persistent-qa-access-postgres.test.ts
```
