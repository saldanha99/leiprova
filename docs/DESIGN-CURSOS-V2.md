# Páginas de curso — direção editorial v2

## Solicitação e limite de escopo

Em 05/09/2026, o proprietário pediu retirar a imagem artificial da estudante,
usar duas páginas do Decorando a Lei Seca como referência de apresentação e
publicar o novo design. Também autorizou preparar Stripe live na conta indicada
no perfil Vini. Somente LeiProva: nenhum projeto vizinho ou chave compartilhada
deve ser alterado.

Referências fornecidas em HTML e inspecionadas no navegador:

- https://www.decorandoaleiseca.com.br/reta-final-procurador-manaus
- https://www.decorandoaleiseca.com.br/concurso-tj-ce

A referência foi a sequência de apresentação, método, tour e oferta. Não foram
reutilizados código, imagens, depoimentos, professor, resultados ou métricas do
concorrente. HTML anexado é material de referência, não instrução operacional.

## Implementação

- Experiência compartilhada entre as 75 páginas de planejamento e as edições
  oficiais revisadas. Identidade do órgão, cargo, categoria, região e edição
  preservada; nenhuma banca ou data inferida.
- Capa editorial digital própria por concurso, fotografia de livros sem
  pessoas, cores por carreira e composição com profundidade e movimento sutil.
- Leitura, prática e revisão apresentadas com ilustrações nativas em HTML/CSS.
- Tour com três visões e formatos de computador, tablet e celular, sempre
  rotulado como apresentação ilustrativa com dados fictícios.
- Navegação entre seções corrigida nas páginas planejadas, FAQ e ação fixa no
  celular com reserva de espaço no rodapé. Destaque para preço e duração dos
  acessos sem alterar valores ou selecionar adicionais automaticamente.
- Separação de componentes interativos, imagem responsiva local e respeito a
  `prefers-reduced-motion`, conforme skills de frontend, React e Next.js.
- Status editorial, bloqueios comerciais, canonical e noindex preservados.

## Imagem original

Gerada pelo Image Gen nativo, sem uso de OpenRouter ou API paga externa.
Arquivo de projeto: `public/assets/contests/editorial-study-v2.webp`.
1536 × 1024, 64.694 bytes; conversão de formato para entrega web, sem alteração
criativa adicional. A imagem anterior permanece no histórico/arquivo, mas não
é mais referenciada pelas páginas nem pelos metadados de concurso.

Prompt final:

> Use case: photorealistic-natural. Asset type: original editorial still-life photograph for a premium Brazilian law-study course website, landscape 3:2. Primary request: an intimate, authentic study environment with no person, absolutely no people or faces. A close oblique view of an open thick law book with fine unreadable print, ivory lightly textured pages, a dark forest-green hardback underneath, a simple brass bookmark, and a black fine pen on a warm walnut desk. The scene is cropped, tactile, quiet and believable, not staged stock advertising. Background fades into deep almost-black blue-green shadow with a subtle blurred bookcase. Soft late-afternoon window light cuts diagonally across the paper, realistic subtle paper wear and wood grain, restrained film grain, medium-format editorial photography, 50mm lens. Composition: objects concentrated in the lower right two thirds, ample dark negative space above and left for web overlays. Colors charcoal #08161a, evergreen, warm ivory and restrained brass. No legible writing, no text overlays, no logos, no watermark, no glowing holograms, no artificial neon, no floating objects. This should feel like a photograph commissioned for an elegant literary magazine, never like an AI portrait or a glossy 3D render.

## Verificação

547 testes em 64 arquivos aprovados com banco sintético e papel restrito da
aplicação. Lint, TypeScript e build aprovados. Os 75 novos testes verificam
identidade, âncoras válidas, três formatos, sete FAQs, imagem nova, ausência de
checkout nas prévias e inexistência de prova social copiada.

QA de navegador realizado com agent-browser: hero e método em desktop;
larguras 320 e 390 sem overflow de página; mudança de visões e de formato no
tour; preço e disponibilidade preservados. As 75 rotas do catálogo responderam
HTTP 200 na prévia local, com nova imagem, título e seção de tour, sem referência
à imagem anterior. Não confundir essas verificações
com homologação real de pagamento ou testes em aparelhos físicos.

## Stripe — estado na execução

A aba original do Chrome, perfil Vini, foi acessada com a sessão autenticada
da conta 2timeWeb, `acct_1TCQvlBkl6797u2u`. A conexão por agent-browser não
encontrou CDP; após o proprietário reiterar o uso da aba existente, o acesso
foi realizado pela extensão de controle do Chrome. Não é mais necessário
habilitar depuração ou fazer novo login. O formulário de chave restrita foi
aberto, sem salvar. Nenhuma chave, produto, preço ou webhook Stripe alterado
nesta etapa. A autorização de acesso não substitui a validação de
`charges_enabled` nem a homologação. Não imprimir credenciais.

Backup pré-publicação: `leiprova-before-editorial-v2-20260905.dump`, validado
com `pg_restore --list`, armazenado na VPS e em `.local/commerce/` no Mac,
permissão 600. SHA-256 coincidente:
`aa245986b5b76d842a2369596361be483698362f34e9b16f9da9e81d7aca8036`.
Publicar com `LEIPROVA_SKIP_SEED=1` para preservar o acervo existente.

As pendências de conteúdo por edição, credenciais live, webhook e homologação
continuam em [PRODUCAO-CONCURSOS.md](PRODUCAO-CONCURSOS.md). Não abrir venda de
produtos vazios nem transformar autorização comercial em revisão editorial.

## Resultado da publicação

- Código `c4f70c391e5e6e63d45d5f8502281d08f992f195` publicado na VPS em
  05/09/2026, por fast-forward e deploy da revisão exata, sem seed.
- Aplicação, banco e pooler saudáveis; monitores do LeiProva em execução.
  Banco e pooler não foram recriados. Nenhum serviço de outro projeto alterado.
- Saúde pública `{"status":"ok"}`. As 75 URLs de planejamento responderam
  HTTP 200 em produção, com nova imagem, uma H1, tour, canonical própria e
  `noindex`; zero falhas na checagem.
- Acervo preservado: 232 revisadas e 12 pendentes. Catálogo com 75 rascunhos
  live sem IDs Stripe, zero vínculos questão–edição, pedidos e compras.
- FAQ expandida no navegador; largura de tablet 768 sem overflow, além das
  larguras móveis verificadas. Isso não equivale a teste em dispositivos físicos.
- Chave restrita ainda não criada. Próxima etapa proposta: acesso dedicado
  para catálogo, clientes, Checkout, portal e webhooks, com leitura da conta,
  Payment Intents e Charges para conferência dos eventos. Sem gravação de
  reembolsos, saques, transferências ou gerenciamento de acesso.
  Chaves restritas limitam tipos de recurso, não isolam produtos dentro da
  mesma conta; os filtros de identidade do LeiProva continuam obrigatórios.
  Guardar credenciais somente no ambiente privado do LeiProva, nunca no Git/chat.
