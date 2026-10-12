# Identidade e descoberta — Edital Lei Seca

Decisão do proprietário em 11/10/2026: marca pública **Edital Lei Seca**, domínio
adquirido `editaleiseca.com.br` e migração para a VPS do projeto Everglades.
Identificadores internos, slugs, contas e dados continuam `leiprova`.

## Linha de base

Auditoria pública anterior à mudança: `https://leiprova.2b.app.br`, 24 URLs do
sitemap, todas com HTTP 200, nenhuma falha crítica ou aviso no auditor técnico.
Googlebot e OAI-SearchBot receberam a mesma home em HTML (1.458 palavras) que o
agente padrão. Isso verifica acesso e renderização; não mede indexação ou ranking.
Recibo privado: `.local/seo-brand-20261011/baseline.json`.

O `llms.txt` antigo continha marca e dados do beta de setembro que contradiziam
o acervo comercial. A página de fontes também declarava nenhuma inédita publicada.
Essas declarações foram corrigidas sem congelar contagens sujeitas a mudanças.

## Fundação implementada

- Marca, títulos, metadados, textos de interface, remetente de exibição e PWA.
- Logo vetorial própria: documento aberto com marcador, branco, verde e ouro;
  ícones PNG para navegador, e-mail e instalação; imagem social 1.200 × 630.
- Grafo `Organization` + `WebSite` com identidade e logo consistentes, sem perfis,
  avaliações ou credenciais não confirmados.
- URLs canônicas, grafo, sitemap, robots e guia `llms.txt` usam a origem configurada
  em `NEXT_PUBLIC_APP_URL`. A alteração de domínio ocorre junto ao corte operacional.
- Sitemap preserva slugs, usa datas de alteração reais e elimina URLs repetidas.
  Páginas de concurso dependem dos controles de publicação e indexação existentes.
- `robots.txt` permite busca pública e cobre os endpoints privados, inclusive
  suas raízes. A política anterior de bloquear treinamento por GPTBot e
  Google-Extended foi preservada; busca e treinamento são controles distintos.
- `llms.txt` virou uma rota pública de texto, com ligações canônicas e explicação
  factual de disponibilidade, programas, referências oficiais e aprovação automática.
- Fontes e metodologia distinguem o beta inicial, referências de provas anteriores
  e a fábrica de inéditas aprovada por autorização do proprietário, sem afirmar
  revisão humana independente de cada questão.
- Pedidos de licença enviados mantêm texto, escopo e hash históricos. A troca de
  marca isolada não reabre pedidos. Novos pedidos usam a marca atual.
- Operadores de produção aceitam apenas as origens exatas antiga e nova. O alias
  `www` é tratado como público para recusar Stripe de teste, mas não amplia a
  autorização de operações editoriais. Banco, pooler, usuário, flags de aprovação,
  lote e fingerprints continuam exigidos. Apresentação do catálogo Stripe usa a
  origem autorizada configurada, sem renomear produtos ou preços existentes.

O guia de assistentes é auxiliar e experimental; HTML público legível, canonicals
e sitemap permanecem os meios principais de descoberta. Não há promessa de ranking,
resposta de IA, aprovação ou afiliação a bancas.

## Corte e verificação externa

Antes de mudar DNS, o operador deve testar TLS, rotas, autenticação, callback de
pagamento e webhook na VPS de destino. O redirecionamento definitivo deve preservar
caminho e parâmetros, ter um salto e só ser ativado após confirmar o novo domínio.
O retorno exige preservar origem, backup recuperável e configuração anterior.

Depois do corte, repetir a auditoria no domínio novo e conferir amostras distribuídas,
robots, sitemap, schemas, imagens sociais, rota inexistente e redirecionamentos.
Registrar release e resultados efetivos no relatório operacional da migração.

**Não houve envio a Google Search Console, Bing Webmaster Tools ou IndexNow nesta
etapa.** Acesso às propriedades, verificação de titularidade e medição precisam de
execução e recibos próprios. Não se presume indexação a partir de um sitemap válido.

Primeira medição proposta: sete dias após o corte confirmado. Guardar conjunto fixo
de consultas de marca, lei seca e preparações; observar cobertura, impressões, cliques,
referências de assistentes e conversões. Comparar tendências ao longo de semanas.

## Referências primárias consultadas

- [Google: mudança de site com URLs diferentes](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).
- [Google: criar e enviar sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- [OpenAI: controles independentes de busca e treinamento](https://developers.openai.com/api/docs/bots).
- Guias locais da versão instalada de Next.js: `robots`, `sitemap`, `app-icons` e
  metadados em `node_modules/next/dist/docs/`.

Não se iniciou automação periódica nem se alterou a política de treinamento.
