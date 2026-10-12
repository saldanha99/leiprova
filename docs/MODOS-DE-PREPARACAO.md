# Modos de preparação da Edital Lei Seca

Decisão do proprietário em 11/10/2026: oferecer treino histórico e pré-edital
separados, com legislação vigente. A migração `0048_preparation_modes` cria o
contrato explícito; não converte nenhum produto nem aprova conteúdos.

## O que o aluno recebe

- `current_notice`: questões próprias vinculadas ao programa da edição oficial
  atual. Mantém as regras anteriores de fase e atualização do edital.
- `historical_training`: questões inéditas sobre o programa de uma edição passada,
  usando legislação vigente. Não reproduz o caderno aplicado e não simula a
  legislação vigente na data histórica da prova.
- `pre_notice`: questões inéditas com legislação vigente e programa de uma edição
  anterior identificada. Não confirma a banca, o programa ou a abertura de um
  novo concurso. A publicação de um novo edital exige nova validação.

O calendário continua registrando a fase real da edição oficial. Uma preparação
histórica disponível aparece na vitrine como treino histórico, junto à indicação
de prova realizada. Pré-edital de referência aparece com esse nome, sem selo de
nova publicação oficial nem inscrição aberta por inferência.

## Revisão, liberação e acesso

Os modos adicionais exigem produto em rascunho, associado à edição oficial
revisada com publicação do edital e data de prova passada. Pelo menos um requisito
revisado deve vir de documento oficial aprovado da mesma edição. O operador
confirma a conferência específica do programa; autonomia operacional não é
comprovação de revisão humana. Uma edição cancelada ou suspensa não serve de base.

A revisão registra modo, administrador, referência de aprovação e a versão exata
(`updated_at`) da oportunidade. Alterações nessa edição invalidam a revisão do
modo até nova conferência. Produtos já liberados não mudam de modo por esse
comando; isso evita alterar o que foi contratado.

Após a decisão, a liberação comercial permanece separada: são exigidas 68 questões
válidas por produto, vínculos aprovados ao programa exato, legislação vigente,
citações verificáveis e prova anterior oficial aprovada ou dispensa motivada.
Cadastro do produto na Stripe não satisfaz essas condições. O piso de 68 não é
promessa de cobertura integral do edital. Catálogo, reserva de checkout e concessão
de períodos pagos revalidam a revisão do programa.

A fábrica continua produzindo apenas rascunhos. A linha de liberação autorizada
aprova suas inéditas; nenhuma revisão de fonte, programa, prova anterior ou licença
é presumida por este novo comando. PDFs oficiais externos continuam sendo links;
reprodução de questões ou hospedagem exige o direito correspondente.

## Comando do operador

Use a conexão de manutenção e referência auditável, sem copiar segredos para
prompts ou Git. Primeiro execute a prévia:

```sh
PREPARATION_MODE_REVIEW_REFERENCE=owner-decision-2026-10-11:programa-conferido \
  pnpm commerce:preparation:review \
  --product=slug-do-produto \
  --mode=historical_training \
  --program-confirmation=reviewed-official-baseline
```

`--mode=pre_notice` usa o outro modo. `--apply` grava a decisão após a conferência
real do programa e da edição identificada. O comando usa uma transação
serializável com trava do produto, tempo máximo de 30 segundos e auditoria. Sem
`--apply`, desfaz a transação. Não altera Stripe, flags, publicação de questões,
PDFs nem status comercial. Em seguida, a liberação usual continua sendo
`pnpm commerce:product:release` (prévia; adicionar `--apply` para aplicar).

A migração tem default `current_notice`; os três produtos já disponíveis e seus
IDs, preços, compras e vínculos não são reclassificados. O papel web possui só
leitura do catálogo: a alteração de modo usa o operador de manutenção.

## Pendências do catálogo

Este suporte não resolve os produtos sem edição oficial revisada, programa,
questões ou provas anteriores. Esses produtos continuam em preparação. Treino
histórico exige prova anterior identificável; pré-edital exige uma edição-base
real do mesmo órgão/cargo/especialidade/jurisdição. Não atribuir o perfil de uma
banca a outro cargo nem usar listas de mercado como programa oficial.
