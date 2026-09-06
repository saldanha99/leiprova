# Acessos operacionais — LeiProva / Editalume

Orientação do Vinícius confirmada em 05/09/2026. Documento sem segredos, destinado
ao Maestro e aos agentes deste projeto.

| Serviço | Navegador / perfil | Destino |
| --- | --- | --- |
| Cloudflare, DNS de 2b.app.br | Google Chrome — **Daniel** | https://dash.cloudflare.com/d5c9228c69707c2a00b5a0f9fbaac942/2b.app.br/dns/records |
| Stripe, conta 2timeWeb | Google Chrome — **Vini** | https://dashboard.stripe.com/acct_1TCQvlBkl6797u2u |
| Aplicação em produção | Qualquer navegador | https://leiprova.2b.app.br |
| Homologação dedicada | **PUBLICADA E VALIDADA em 05/09/2026**; qualquer navegador | https://homolog.leiprova.2b.app.br/entrar |

## Perfis de teste — homologação persistente

Os três logins abaixo foram validados por HTTPS. O ambiente é persistente na
VPS, independente do Mac, e separado do site de produção.

| Perfil | Login | Permissão verificada |
| --- | --- | --- |
| Administrador QA | `qa-admin@example.invalid` | Painel `/admin` |
| Cliente Master QA | `qa-master@example.invalid` | Área `/app`, cursos fictícios Alfa e Beta; sem acesso a `/admin` |
| Cliente individual QA | `qa-avulso@example.invalid` | Área `/app`, somente Alfa; Beta e `/admin` bloqueados |

**Senhas somente no arquivo privado**
`.local/commerce/qa-persistente/ACESSOS-HOMOLOGACAO.md` (permissão 600, fora de
Git e Docker). Não usar as senhas dos antigos testes em `127.0.0.1:3098`: os
nomes de login coincidem, mas os bancos e as credenciais são distintos. Essas
contas não são contas de produção. A vigência sintética de Master e individual
vai até 05/10/2026, no horário de São Paulo.

O ambiente tem banco, volume, cookies e segredos exclusivos, sem cópia de dados
reais: 3 perfis, 2 cursos e 8 exercícios sem validade jurídica. Foram conferidos
HTTPS válido, saúde 200, banner de QA e cabeçalhos de não indexação/sem cache.
O Master recebe Alfa e Beta; o individual recebe apenas Alfa, inclusive com
bloqueio de resposta forçada a Beta na API. Ambos os checkouts retornam 503:
não há cobrança real nem referências Stripe. Cadastro, contato, e-mails e
Connect permanecem fechados, sem workers de publicação neste ambiente.

Histórico: inicialmente a homologação estava apenas preparada; DNS, publicação,
certificado e validação dos três perfis foram concluídos em 05/09/2026.
Detalhes e procedimento de atualização em `HOMOLOGACAO-ISOLADA.md`; evidências
técnicas no arquivo privado
`.local/commerce/qa-persistente/VERIFICACAO-PUBLICACAO.md`.

## Procedimento do Maestro

1. Ler este documento e `OPERACAO.md` antes de operar infraestrutura.
2. Identificar o perfil pelo nome e confirmar a conta e o domínio na página.
   Reutilizar a aba autenticada indicada pelo usuário. A Cloudflare está no
   **Daniel**, mesmo que o Stripe esteja no **Vini**.
3. Limitar qualquer alteração a LeiProva: repositório `leiprova`, recursos
   próprios na VPS e registros DNS `leiprova` / `homolog.leiprova`.
4. Não modificar os demais sites de `2b.app.br`, nem as configurações globais
   de cobrança, acesso, DNS ou segurança da conta por conveniência.
5. Se não houver sessão válida, pedir login humano no perfil correto. Não
   copiar perfis/cookies, extrair tokens nem contornar desafios de acesso.
6. Guardar credenciais apenas no armazenamento privado adequado. Não colocar
   senhas, chaves Stripe, tokens ou cookies neste documento ou no canvas.

O registro dos perfis não substitui as confirmações exigidas para ações
sensíveis. Catálogo Stripe criado não significa checkout liberado: autenticação,
pagamentos, webhooks e entrega do conteúdo precisam de validação própria.
