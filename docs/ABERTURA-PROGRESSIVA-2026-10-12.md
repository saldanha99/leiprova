# Abertura automática e progressiva — 12/10/2026

Decisão direta do proprietário: "abertura automatica de todas!! com abertura
progressiva com conteúdo inicial validado e ampliação contínua". Aplica-se às
84 preparações do catálogo e dispensa nova confirmação por produto elegível.

## Comportamento

- A linha `deploy/editorial-release-chain.sh` continua aprovando as inéditas
  da fábrica sob autorização permanente, propondo/importando vínculos e
  executando as revisões autorizadas. Produtos liberados continuam nesse fluxo.
- Ao final, `commerce:product:release -- --apply --all-drafts` avalia todos os
  rascunhos, mesmo sem edição ou questões, e registra seus bloqueios. Cada
  produto usa transação própria e o gate de liberação existente. Uma falha
  operacional não impede avaliar os demais e faz o comando terminar com erro.
- Referência da abertura: `owner-standing-2026-10-12:abertura-progressiva-84`.
- O cron de abertura passa de seis horas para 30 minutos (minutos 10 e 40).
- `deploy/editorial-prepare-queue.sh` atualiza até seis páginas de 100 requisitos
  por rodada, a cada 20 minutos (05, 25 e 45). Para antes quando `hasMore=false`;
  trava contra sobreposição e timeout por página limitam o trabalho. Não gera
  questões nem reserva IA. O worker original de seis horas continua responsável
  pelas demais etapas editoriais.
- Recibos privados por rodada ficam em `.local/editorial/release-runs/` e
  `.local/editorial/preparation-runs/`. Erros de comandos não são mais ocultados
  como rodada silenciosa bem-sucedida. Imagens das ferramentas são construídas
  no deploy, não a cada execução do cron.

## Condições e dependências

Permanecem: pelo menos 68 vínculos válidos, edição/programa/fontes revisados,
modo de preparação elegível, cargo/banca/formato exatos, referência oficial de
prova anterior ou dispensa válida e configuração comercial já autorizada.
As páginas já informam que o acesso cobre o conteúdo efetivamente disponível.
68 questões não equivalem à cobertura integral do programa.

Antes desta publicação: três preparações disponíveis/285 questões válidas,
17 produtos com edição vinculada e 67 sem vínculo. O fluxo de abertura não
resolve sozinho fontes bloqueadas nem admite um edital sem suas evidências.
Os casos históricos e pré-edital precisam de modo/edição-base conferidos.

A autoria depende dos agentes do Maestri, da disponibilidade do host e da
assinatura. O teto permanece 48 reservas/24h compartilhadas. Atualização da fila
e avaliação da abertura são determinísticas; sua frequência não multiplica
a capacidade de autoria. Nenhuma API paga ou mudança de flags comerciais.

## Instalação e retorno

Na VPS `everglades-vps`, construir as imagens `opportunity-approver` e
`editorial-binding-importer` a partir da revisão validada antes de instalar os
crons. Copiar `deploy/editorial-release-chain.cron` para o arquivo existente
`/etc/cron.d/leiprova-release-chain`, e `deploy/editorial-prepare-queue.cron`
para `/etc/cron.d/leiprova-prepare-queue`, ambos root:root/644. Conferir duplicatas,
serviço cron e scripts executáveis. Executar uma rodada e conferir recibos.

Retorno: restaurar o cron anterior salvo no backup operacional e remover apenas
o cron novo de preparação, preservando recibos e dados. Restaurar as imagens
anteriores se necessário. Não reabrir conteúdo suspenso nem reverter aprovações
por atualização direta do banco.

## Execução conferida

- Código publicado: `eb22728`, após `a41a896` e `c73980a`. Imagens das duas
  ferramentas reconstruídas em `c73980a`; as mudanças seguintes são do wrapper.
  App e demais workers não foram recriados: nenhuma alteração de interface,
  migração, seed, flag comercial ou Stripe foi necessária.
- Cron ativo e ambos os arquivos instalados com root:root/644, sem duplicatas
  observadas. A rodada manual real de 16:12:13–16:12:44 UTC terminou com sucesso.
  Recibos em `.local/editorial/release-runs/20261012T161213Z.wnKjT1/`, na VPS.
- Foram avaliados 80 produtos draft, todos bloqueados e nenhum liberado nessa
  rodada. O catálogo tem outros quatro produtos com status técnico released:
  três disponíveis e PC-MA Delegado fechado pelo gate, devido à suspensão das
  questões. Não confundir status persistido com disponibilidade comercial.
- Nos 80 drafts: 67 sem edição revisada, 80 sem o piso de questões, 71 sem
  referência de prova anterior/dispensa e três com fase/data incompatível com o
  modo atual. Motivos se sobrepõem. Admitir fontes e produzir conteúdo continua
  necessário; frequência do cron não resolve esses bloqueios.
- ENAM tem 33 vínculos antigos pending_review cujo timestamp de questão diverge.
  Eles foram preservados, sem aprovação. O wrapper só chama a revisão quando
  há vínculos com a versão atual; as pendências antigas exigem nova conferência.
- A preparação inicial começou às 16:12:45 UTC na unidade transitória
  `leiprova-progressive-prepare-20261012.service`; recibos em
  `.local/editorial/preparation-runs/20261012T161245Z.qauULl/`. Início da unidade
  não comprova conclusão de todas as páginas nem geração de questões.
  O primeiro recibo posteriormente confirmou 100 requisitos examinados e 44
  pacotes de mapeamento atualizados, zero autorias e `hasMore:true`; a rodada
  continuou para a página seguinte. Não equivale a 44 mapas aprovados.
- Lint, tipagem e build passaram na VPS; 1.814 testes gerais passaram e 294
  opcionais foram pulados por ausência de ambiente específico. Sete cenários
  executados com comandos simulados verificaram fim da fila, limite de páginas,
  erro, JSON inválido, catálogo sem questões, preservação da leitura de múltiplos
  produtos e falha de liberação. Logs em `/opt/leiprova-qa-progressive-20261012/`;
  harness/recibos privados locais em `.local/editorial/progressive-20261012/`.
- Backup validado por `pg_restore --list`, preservado na VPS e copiado ao Mac:
  `/opt/leiprova/backups/progressive-20261012/database.dump`, SHA-256
  `1241ff0ed3dd750dec5e53ec32bb38fd4737fd2aed5a25ad4ac8a4a9d5bb6268`.
  Cron anterior salvo no mesmo diretório e imagens antigas com tag
  `before-progressive-20261012`. Saúde pública retornou `status:ok` após instalação.
