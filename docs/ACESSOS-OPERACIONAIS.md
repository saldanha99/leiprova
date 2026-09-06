# Acessos operacionais — LeiProva / Editalume

Orientação do Vinícius confirmada em 05/09/2026. Documento sem segredos, destinado
ao Maestro e aos agentes deste projeto.

| Serviço | Navegador / perfil | Destino |
| --- | --- | --- |
| Cloudflare, DNS de 2b.app.br | Google Chrome — **Daniel** | https://dash.cloudflare.com/d5c9228c69707c2a00b5a0f9fbaac942/2b.app.br/dns/records |
| Stripe, conta 2timeWeb | Google Chrome — **Vini** | https://dashboard.stripe.com/acct_1TCQvlBkl6797u2u |
| Aplicação em produção | Qualquer navegador | https://leiprova.2b.app.br |
| Homologação dedicada | Em preparação; só declarar disponível após teste HTTPS e dos 3 perfis | https://homolog.leiprova.2b.app.br |

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
