<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Edital Lei Seca

SaaS de memorização da literalidade da lei para concursos e OAB.
Next.js 16, React 19, Tailwind 4, PostgreSQL 17 com Drizzle, Stripe, Docker + Traefik.

**Marca atual: Edital Lei Seca**, decidida pelo proprietário em 11/10/2026.
Domínio adquirido e autorizado: `editaleiseca.com.br`. Leia
`docs/MARCA-EDITALUME.md` para o histórico e a transição. `leiprova` permanece
nome técnico do repositório, banco e recursos; não os renomeie pela marca.
O proprietário autorizou migrar para a VPS do Everglades e configurar o domínio,
DNS e Stripe pelo perfil conectado. A mudança de DNS só ocorre após validar a
aplicação e o banco na VPS de destino, com backup e retorno definidos.
As URLs legadas `leiprova.2b.app.br` e `homolog.leiprova.2b.app.br` permanecem
registradas para transição e homologação; não apagar dados ou recursos de
outros projetos. Nova autonomia não equivale a revisão humana de conteúdo jurídico.

**Leia `docs/OPERACAO.md` antes de mexer em deploy, banco ou feature flags.**
Ele cobre onde o projeto está hospedado, como publicar, como subir o ambiente
local e as armadilhas já conhecidas.

**Abertura progressiva autorizada em 12/10/2026:** o proprietário escolheu
"abertura automatica de todas" com conteúdo inicial validado e ampliação contínua.
Avaliar automaticamente todos os produtos em rascunho e liberar cada um ao
cumprir os gates existentes, sem nova confirmação por preparação. O piso de
68 questões não significa cobertura integral. Essa decisão não altera o teto
de 48 reservas/24h, não autoriza APIs pagas e não elimina provas de fonte,
identidade, formato, vínculo ou direitos. Veja `docs/ABERTURA-PROGRESSIVA-2026-10-12.md`.

Regras que valem sempre:

- Nenhum segredo é versionado. O `.env` de produção vive só na VPS, com permissão `600`.
- Canais comerciais (cadastro, contato, checkout, Stripe Connect) ficam fechados
  por feature flag. Não abra nenhum sem decisão explícita do responsável.
- Conteúdo jurídico exige fonte oficial e revisão humana antes de publicar.
  Exceção decidida pelo proprietário em 11/10/2026: as inéditas da fábrica são
  aprovadas, vinculadas e liberadas pela linha automática
  `deploy/editorial-release-chain.sh`, sem conferência humana do item (auditoria
  `owner_standing_authorization`); o Maestro confere depois e suspende o que tiver erro.
  Em 12/10/2026, o proprietário estendeu explicitamente a revisão e liberação
  automatizadas às fontes, editais e programas oficiais. Esse caminho deve
  registrar `owner_standing_authorization` e `humanReview: false`, com fonte
  primária verificada, identidade exata da edição/cargo/banca, versão e evidências
  auditadas. Resultado `prepared` continua sendo apenas proposta. Acesso bloqueado,
  fonte/identidade incerta e ausência de direitos de uso impedem liberação; não
  contornar nem converter a autorização em declaração de revisão humana.
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

## Motores editoriais e Maestri

- Leia `docs/MAESTRI-MOTORES-AUTOMATICOS.md` antes de executar trabalhos da fila.
  Radar descobre fontes, Guardião propõe vínculos/analisa normas, Autor cria
  rascunhos. O Maestro coordena os nós existentes, sem duplicá-los.
- Use a ponte delimitada por SSH existente; nunca copie credenciais para agentes
  ou notas. `.local/maestri/queue` é privada e não entra em Git ou Docker.
- Resultado `prepared` não é aprovação: as inéditas passam pela linha de liberação;
  fontes/editais/programas passam pelo caminho auditado autorizado em 12/10/2026.
  Fora desses caminhos, continua exigida revisão humana efetiva. Stripe está em modo live só para a venda já aberta;
  não altere flags comerciais.
- **Maestro central** (nó "Maestro LeiProva", pode ser Claude ou Codex): siga
  `docs/MAESTRO-CENTRAL.md` — saúde, conferência das aprovadas, suspensão de erros e
  relatório ao proprietário em português.
- Documentação, nós conectados ou fila pendente não comprovam execução: registrar
  IDs reais de rotinas e recibos. Maestri fechado/host indisponível deixa a fila
  aguardando; não prometer autoria 24/7 nem recorrer a APIs pagas.

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
