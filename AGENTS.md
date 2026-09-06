<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Editalume

SaaS de memorização da literalidade da lei para concursos e OAB.
Next.js 16, React 19, Tailwind 4, PostgreSQL 17 com Drizzle, Stripe, Docker + Traefik.

**Marca atual: Editalume.** Use esse nome na comunicação, nos novos materiais e
nas tarefas do time. Leia `docs/MARCA-EDITALUME.md` para distinguir a marca dos
identificadores técnicos legados. `leiprova` continua sendo o nome do repositório,
da pasta, do banco e dos recursos técnicos existentes; não os renomeie por uma
troca de marca. Os domínios atuais continuam `leiprova.2b.app.br` e
`homolog.leiprova.2b.app.br`. O domínio definitivo da Editalume ainda não foi
comprado e sua extensão não está definida nesta orientação; não invente endereço
nem altere DNS, redirecionamentos, e-mails ou webhooks para um domínio futuro.

**Leia `docs/OPERACAO.md` antes de mexer em deploy, banco ou feature flags.**
Ele cobre onde o projeto está hospedado, como publicar, como subir o ambiente
local e as armadilhas já conhecidas.

Regras que valem sempre:

- Nenhum segredo é versionado. O `.env` de produção vive só na VPS, com permissão `600`.
- Canais comerciais (cadastro, contato, checkout, Stripe Connect) ficam fechados
  por feature flag. Não abra nenhum sem decisão explícita do responsável.
- Conteúdo jurídico exige fonte oficial e revisão humana antes de publicar.
  Não faça scraping nem reutilize questões de terceiros sem licença escrita.
- Scripts novos que rodem por `tsx` precisam de `--env-file-if-exists=.env`;
  o projeto não tem `dotenv`.
- Antes de entregar, rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Maestro e auxiliares devem carregar a marca atual a partir deste arquivo e de
  `docs/MARCA-EDITALUME.md`. Nomes antigos em notas, nós, registros ou relatórios
  são históricos; não comprovam que o canvas tenha sido atualizado. Preserve IDs,
  conexões e o isolamento do projeto ao planejar qualquer atualização de rótulos.

## Referências editoriais por banca e cargo

- Antes de usar material de referência para inéditas, leia
  `docs/REFERENCIAS-POR-BANCA-E-CARGO.md`.
- Perfis devem distinguir banca, cargo/especialidade, edição, programa e demanda
  cognitiva. Não transferir automaticamente o perfil de Analista Jurídico do MP
  para Escrevente do TJ, Promotor ou outro cargo da mesma banca.
- Simulados fornecidos para análise são referência secundária, não fonte oficial
  da lei, da resposta ou da autoria da banca. Não incorporar suas questões ao acervo.
- A análise privada recebida em 06/09/2026 fica em
  `.local/editorial/vunesp-referencias-20260906/`. Não enviar PDFs, textos extraídos
  ou dossiês privados ao Git, à imagem da aplicação ou a provedores pagos.
- Autores de inéditas recebem somente o perfil abstrato e fontes oficiais
  independentes. O material original fica separado para análise editorial e
  comparação de originalidade; nenhuma revisão humana é presumida.
- Novas rodadas privadas por cargo devem usar o contrato e as verificações de
  `docs/AUTORIA-ISOLADA-POR-CARGO.md`. Quantidade em rascunho não é quantidade
  publicada por produto; não converter treino atual em simulado histórico.

## Acessos operacionais do time (confirmados em 05/09/2026)

- **Cloudflare / DNS de `2b.app.br`: Google Chrome, perfil Daniel.** Use a aba
  autenticada desse perfil, não tente o perfil Vini. Zona autorizada para este
  projeto: `2b.app.br`; limite mudanças aos registros existentes deste projeto
  (`leiprova` / `homolog.leiprova`).
- **Stripe / conta 2timeWeb: Google Chrome, perfil Vini.** Não confundir os perfis.
- Estes nomes indicam onde acessar, não concedem autorização permanente para
  mudar permissões, criar credenciais, cobrar ou alterar outros projetos.
- Nunca salve cookies, senhas ou chaves em notas do Maestri, prompts ou Git.
  Se a sessão expirar, solicite que o usuário faça o login no perfil correto.
- Consulte `docs/ACESSOS-OPERACIONAIS.md` para os endereços e escopo.
