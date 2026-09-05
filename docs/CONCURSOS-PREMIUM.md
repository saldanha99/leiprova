# Páginas premium de concursos — Editalume

Data: 05/09/2026. Branch: `codex/concursos-premium`.

> Este documento registra a primeira etapa visual. A continuação comercial está em [Catálogo e comércio por concurso](COMERCIO-CONCURSOS.md) e substitui as informações abaixo sobre listagem, planos, migração e contagem de testes. A continuação exige a migration 0031 e novos privilégios; não publicar usando apenas o checklist histórico desta página.

## Escopo e estado

Modelo reutilizável aplicado à rota `/concursos/[categoria]/[uf]/[slug]`, válido para as oito categorias atuais e com fallback para novas categorias. A página de listagem e as demais áreas do produto não foram redesenhadas.

Implementação local concluída. Publicação de produção depende de confirmação do proprietário. Nenhuma configuração comercial, questão, revisão editorial ou dado de produção foi alterado. Não houve uso do OpenRouter nem chamada de API paga de geração de questões.

## Experiência entregue

- Hero editorial com fotografia original de IA, nome do concurso, carreira e localidade.
- Direção de cor por carreira: esmeralda, dourado ou azul; identidade Editalume preservada.
- Navegação fixa entre método, tour, concurso, planos e dúvidas; acesso à área do aluno.
- Benefícios e ciclo de leitura, prática e revisão.
- Tour interativo de rotina, revisão e progresso, com visualização em computador e celular. É uma representação ilustrativa; não é captura da conta de um aluno. Os números são fictícios e estão identificados como tal.
- Situação oficial, datas, órgão, cargo, fonte e responsável preservados a partir da consulta existente. Banca e prestador da prova continuam separados. Datas ausentes não são inferidas.
- Dois planos gerais, com preços e recursos lidos de `src/lib/plans.ts`: R$ 297/mês e R$ 897/ano. A equivalência de R$ 74,75/mês não é apresentada como parcelamento.
- Sete perguntas frequentes em controles nativos acessíveis por teclado.
- CTA fixo no celular com espaço reservado no rodapé, incluindo safe area.
- Imagem responsiva via Next Image; animação curta de entrada desativada quando o visitante prefere movimento reduzido.

## Salvaguardas

O plano específico de cada edição continua em preparação editorial. Uma assinatura geral não libera automaticamente um curso nem significa cobertura integral do edital. O catálogo geral de questões não foi usado como contagem de conteúdo de uma edição.

Com o comércio fechado, os cards oferecem contato se esse canal estiver habilitado; caso contrário, levam ao tour da própria página. Não encaminham para cadastro ou checkout. Com o comércio aberto por uma decisão futura, o CTA identifica explicitamente a assinatura geral. Esta alteração não habilita flags.

Não foram copiados textos, imagens, depoimentos, números de alunos, estatísticas de aprovação ou questões do concorrente. A referência de estrutura foi a página pública [Delegado PC-BA do Decorando a Lei Seca](https://www.decorandoaleiseca.com.br/reta-final/delegado-pc-ba), acessada em 05/09/2026. Alegações dessa página não foram tratadas como informações oficiais do nosso concurso.

## Verificação

- Lint, TypeScript e build de produção aprovados.
- Suíte completa com PostgreSQL sintético e corpus privado: 443 testes em 60 arquivos, incluindo 19 novos testes de apresentação, preços, gates e rodapé.
- Navegação com agent-browser, conforme regra do projeto.
- Layout verificado em 320×812 (todas as oito categorias), 390×844, 768×1024 e 1440×1000. Nenhuma rolagem horizontal detectada nesses cenários.
- Imagem carregada, uma H1, todas as cinco âncoras existentes e nenhum link de compra com o comércio fechado nas oito categorias.
- Tour alternou para revisão e progresso; seletor de celular funcionou. FAQ abriu por clique e fechou por Enter. No agent-browser, usar scrollintoview antes de clicar em um controle fora da tela.
- Rodapé no celular: último link terminou em y≈714 e a barra fixa começou em y=776, sem sobreposição.
- Sem erros de navegador observados na prévia do build.
- Testes de viewport no Chromium, não testes em iPhone/iPad físico ou auditoria formal de acessibilidade.

## Prévia isolada

Foi encontrado um servidor do usuário já em execução na porta 3000. Ele não foi interrompido. Build e inspeção foram realizados em uma cópia temporária isolada, sem .env, dados editoriais privados ou credenciais de produção.

As fixtures visuais são criadas somente pelo script `scripts/setup-local-contest-preview.ts`, que exige loopback 127.0.0.1, porta 55439, banco `leiprova_automation_test` e usuário de QA. Os registros têm marcação explícita de teste e não possuem validade editorial. O servidor de prévia usa o papel restrito de execução, não o administrador do banco.

A prévia do build, enquanto o serviço local estiver ativo, fica em [PC-BA ilustrativa](http://127.0.0.1:3098/concursos/carreiras-policiais/brasil/qa-premium-carreiras-policiais). A URL de teste não é publicada em produção. Os dados de concurso dessa prévia são fictícios; na rota pública, o modelo usa os dados revisados existentes.

## Ativo visual e prompt final

Geração: ferramenta nativa Image Gen, não CLI/API. Ativo final: `public/assets/contests/study-ritual.webp`, 1536×1024, 94.788 bytes. Conversão WebP para entrega web, sem alteração criativa da imagem.

A imagem anterior `leiprova-ecosystem.png` não foi reutilizada nesta página: contém texto jurídico renderizado na composição que não seria apropriado apresentar como amostra validada.

Prompt final usado:

```text
Use case: photorealistic-natural
Asset type: original editorial hero photograph for a premium Brazilian law-study platform named Editalume; the website layout will place the headline to the left of this image, so this is a self-contained visual on the right, not a banner with text.
Primary request: a beautiful, aspirational but believable quiet study ritual for a public-service examination candidate.
Scene/backdrop: contemporary home study corner with a tall softly lit bookshelf, dark blue walls and warm timber desk, a window with late-afternoon sunlight.
Subject: one Brazilian woman in her early thirties, medium-brown skin, dark wavy hair loosely tied back, wearing a refined simple cream cotton shirt, viewed at a natural three-quarter angle from her side, attentively reading an open thick reference book while a plain tablet rests on the desk. Her posture is comfortable, thoughtful and determined, not posing for an ad or smiling at camera. Keep hands anatomically natural.
Style/medium: photorealistic premium editorial lifestyle photography, tangible paper grain and linen texture, realistic skin, understated cinematic quality, medium-format photographic look, no heavy airbrushing.
Composition/framing: landscape 3:2 composition, subject centered with breathing room, waist-up with desk and book clearly visible, suitable for a 4:5 crop too.
Lighting/mood: warm afternoon light on the face and paper, restrained deep navy shadows with a subtle muted emerald accent in the room. Serene, focused, sophisticated.
Constraints: no readable text anywhere, no logos, no seals, no uniform, no courtroom costume, no watermark, no charts, no fake app interface; this is illustrative brand photography, not a real customer testimonial.
```

## Publicação posterior

Rever diff, confirmar autorização e integridade do repositório remoto antes do deploy. Preservar flags e dados existentes. O deploy desta alteração não precisa de novos dados ou de migração própria. Caso seja usado o fluxo existente de deploy, manter `LEIPROVA_SKIP_SEED=1` para não reexecutar o seed legado sobre conteúdo jurídico revisado.
