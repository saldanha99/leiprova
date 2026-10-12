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
