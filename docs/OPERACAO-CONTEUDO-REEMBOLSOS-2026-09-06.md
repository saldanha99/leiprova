# Conteúdo por produto e tratamento de reembolsos

Operação de 06/09/2026 UTC, exclusiva do LeiProva. Este registro não autoriza
publicação editorial nem abertura de vendas. Código `b55327a` implantado e
importações conferidas em 06/09/2026, 03h05 UTC (00h05 BRT).

## Entrega preparada

- 80 questões autorais assistidas por IA: 20 por perfil interno FGV, FCC,
  Vunesp e Cebraspe, cobrindo os incisos XLIV–LXIII do art. 5º da Constituição.
  Todas `draft`, revisão humana pendente. Perfil interno de estilo não significa
  questão oficial da banca, parceria nem fidelidade estatística comprovada.
- 60 propostas planejadas para o produto ENAM 2026.2: 40 questões FGV
  anteriormente revisadas e 20 novos rascunhos FGV. **46 foram importadas
  pendentes** (35 questões revisadas e 11 rascunhos); 14 ficaram bloqueadas.
  Não representam cobertura integral do edital; requisitos, mapeamentos e
  vínculos precisam de revisão. Não há distribuição indiscriminada do mesmo
  acervo pelos 75 produtos.
- Operador novo importa somente rascunhos, sem reutilizar a aprovação do lote
  anterior de 160. Prévia e aplicação vinculam conteúdo, operador e manifesto.
  Produção exige banco/papel restritos e volume privado fixo, sem fallback de URL.
- Curadoria comercial por `productSlug`, com evidência congelada, proposta
  pendente idempotente e nenhuma permissão de aprovação pelo aplicativo. O acesso
  exige correspondência atual do produto, requisito, fonte, texto, alternativas,
  revisão, artigo vigente e banca efetiva. Proposta não libera conteúdo.
- Reconciliador Master integrado ao webhook: confirma o ciclo pago atual na
  Stripe, suspende acesso do ciclo reembolsado/contestado e não desfaz uma
  renovação válida por evento de ciclo anterior. Direitos e conclusão do evento
  Master compartilham transação; reentrega recupera processamento interrompido.
  Não executa devoluções financeiras na Stripe nem afeta outro cliente/avulso.

## Fontes e revisão

Fontes primárias: [Constituição no Planalto](https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm)
e [compilação do Senado](https://legis.senado.leg.br/norma/579494/publicacao/16434817).
18 incisos coincidem literalmente após normalização de espaços; dois têm
variantes editoriais explícitas: XLIV `Democrático/democrático` e LV
`e ampla/e a ampla`. Somente essas duas variantes foram adicionadas à estratégia
v2; o contrato v1 do lote antigo permanece inalterado.

Pacote privado: `.local/editorial/cf-garantias-processuais-2026-09-06/`.
Não publicar manifesto operacional, aprovações antigas ou cópias de banco no Git.
O caderno `REVISAO-HUMANA.md` desse pacote reúne o material para conferência.
A aprovação de uma questão não aprova automaticamente sua aderência a um curso.

## Pendências comerciais preservadas

**Não: os 75 concursos e o Master não têm todos os produtos/preços/checkouts
Stripe ativos e integrados.** A auditoria inicial encontrou 75 registros locais,
zero identificadores de produto/preço Stripe por concurso e zero cursos liberados.
As duas flags de checkout permanecem fechadas. Nenhuma credencial foi alterada.

A política de reembolso parcial ainda depende de decisão do responsável; enquanto
isso, o comportamento existente de suspensão foi preservado. Nenhum reembolso
real foi executado. Homologação ponta a ponta em modo teste permanece necessária,
assim como a recuperação do claim legado dos avulsos. E-mail ainda tem uma janela
entre confirmação e envio sem outbox durável; WhatsApp não foi validado/implantado
nesta entrega. Não anunciar entrega automatizada completa ou cobrança LIVE pronta.

## Proteção operacional

Backup anterior à implantação: `leiprova-before-content-refunds-20260906.dump`,
validado por leitura integral do arquivo custom PostgreSQL e copiado para o Mac.
SHA-256: `37693d569102441332cbc4f03c045e95b71b15b2de9dc843651c7ec926ae4bf0`.
Imagem anterior preservada como `leiprova-app:pre-content-refunds-20260906`.

O deploy exige `LEIPROVA_SKIP_SEED=1`. Homologação conserva banco e imagens
separados; não atualizar nem executar seu bootstrap durante esta operação.
Comparar após importação o hash dos 244 registros anteriores de questões e
1.034 alternativas para detectar alterações indevidas.

Houve também uma migração indevida no banco **local**, não na VPS: foram aplicadas
22 migrações pendentes e 12 questões/12 artigos locais ficaram pendentes de revisão.
O desvio, impactos conhecidos e contenção estão registrados no
[relato integral](RELATO-MIGRACAO-LOCAL-2026-09-06.md). Não houve reversão às cegas.

## Resultado da operação

- Código `b55327a`, migration 0033 e grants publicados sem seed. Imagem:
  `sha256:81d14ab54083ab4904047fa2d30ce151f06bcd09b3e5991a939742e3e871af55`.
  App saudável; `/api/health` respondeu `ok` no navegador. Homologação continuou
  saudável, sem recriação ou alteração de seu banco/imagens.
- 80 questões importadas como `draft`: 20 por banca. Nenhum revisor, submissão
  ou atestado de autoria humana foi preenchido. Reexecução criou zero e reutilizou
  80; existem exatamente 80 novos registros de auditoria de importação.
- 46 vínculos `pending_review` e 46 auditorias, nenhum aprovado. Reexecução
  criou zero e reutilizou 46. O papel do app foi conferido: SELECT permitido,
  UPDATE/DELETE e INSERT na coluna de status proibidos.
- As 14 propostas do requisito 115 foram recusadas na prévia: o requisito está
  em Direito Penal (disciplina 5), mas as questões estão em Constitucional
  (disciplina 1). Não se remapeou o acervo nem o edital para contornar essa regra.
  Pacote original de 60 preservado; somente a seleção explícita de requisitos
  6 (33 propostas) e 7 (13 propostas) foi enviada ao importador.
- Acervo final: **324 questões = 232 revisadas + 12 pendentes + 80 rascunhos**.
  As 244 anteriores e suas 1.034 alternativas mantiveram hashes idênticos aos
  capturados antes da implantação. `question_opportunities` permanece vazio.
- Fingerprint operacional dos rascunhos:
  `3432742ff99e85d36b0d297dd1baa31043bd707dc3d3f2248409c5e53aabd23e`.
  Fingerprint das 46 propostas:
  `62466f775686816a1b15b62f8b505665426dcf193977a35b95b075947853ff73`.
- Uma prévia inicial parou por permissão de leitura, sem escrita no banco:
  transferência do Mac preservara UID 501 dos arquivos. Corrigido somente o
  proprietário dos oito arquivos privados para root no servidor; modos 600,
  volumes somente leitura e `cap_drop: ALL` foram preservados.
- Conferência final comercial: 75 produtos locais, zero produtos/preços Stripe
  vinculados por concurso, zero liberados, zero pedidos/compras/assinaturas/eventos.
  Três registros de planos, nenhum preço Stripe no banco. Flags de checkout e
  cadastro `false`. Modo solicitado `live`, mas credencial ainda de teste; não
  houve ativação de cobrança. Checkout ENAM conferido com compra desabilitada.
- Validação geral: lint, typecheck, build e 723 testes aprovados; 147 testes
  opcionais ignorados nessa execução. Bateria adicional explícita: **150 testes
  aprovados**, incluindo 54 integrações PostgreSQL Master e 25 de curadoria.
  Essa bateria sobrepõe testes unitários da geral; não somar como casos distintos.
  PostgreSQL usa dados sintéticos e Stripe simulada/HMAC offline, não prova LIVE.

Recibos privados: `drafts-preview.json`, `drafts-applied.json`, `drafts-replay.json`,
`bindings-preview.json`, `bindings-applied.json` e `bindings-replay.json` no pacote.
Falta revisão humana do conteúdo, requisitos e aderência, além de fluxo de aprovação
da curadoria e liberação comercial; nenhuma questão nova está liberada ao aluno.

Detalhes: [curadoria por produto](CURADORIA-POR-PRODUTO.md),
[reconciliador Master e limites](MASTER-RECONCILIACAO-PENDENTE.md),
[bloqueios Stripe](STRIPE-PENDENCIAS-HOMOLOGACAO.md).
