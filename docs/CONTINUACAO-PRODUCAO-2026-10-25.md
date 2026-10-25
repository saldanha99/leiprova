# Retomada da produção em 25/10/2026

Relatório de04h12 UTC (01h12 de São Paulo):11/84 elegíveis,1.816 válidas
somadas nas ofertas,0 novas distintas hoje. Soma por produto não é contagem de
questões únicas. Sem homologação de checkout e sem nova preparação aberta.

## Reparos e conferência

- Runtime preservado em `cb200d6`; app, banco e pooler saudáveis, health público OK.
- A linha de liberação registrava ferramenta ausente às03h40,03h50 e04h00 UTC.
  Ausente a imagem do importador de vínculos; reconstruída com
  `docker compose --profile tools build editorial-binding-importer`, sem seed.
  Linha reexecutada até o fim às04h13m39 UTC, exit0, recibo
  `20261025T041221Z.qeEEcT`; nenhum novo produto elegível. Preparação da fila
  retornou zero trabalhos novos porque os candidatos já têm trabalhos existentes.
- MPRJ: evidência anterior expirada em18/10. Preview e apply com `--refresh`,
  fingerprint fresco e fonte oficial acessível; audit25510. Mesmos hashes do
  caderno, robots e página1, contrato48765afb… preservado. Gate app conferido
  verdadeiro; próxima expiração27/10 às00hUTC. Renovar antes de24h restantes,
  sem contornar suspensão ou mudança material. Nenhuma questão de prova copiada.
- Dez questões aprovadas em16/10 após a última conferência foram examinadas.
  Nove mantidas. `a337d1aa-fcd3-534d-b545-fcfbb937de22` suspensa por preview/apply,
  audit25512: justificativa C atribui à Súmula37/STJ cumulação de dano moral e
  imagem; o enunciado trata de dano material e moral. Conferir também autonomia
  do dano antes de sustentar cumulação, evitando bis in idem.
  Fonte primária: [Súmula37/STJ](https://scon.stj.jus.br/SCON/sumstj/toc.jsp?sumula=37.num.).
  Watermark privado avançado só até18h30m08.916324 UTC de16/10, último lote conferido.
- Maestri acessível, oito nós existentes preservados. Novas reservas locais de
  Autor/Guardião observadas; reserva não comprova entrega ou publicação. Maestro
  e Forge exibiam aviso de atualização da CLI. Nenhum agente interrompido,
  nenhum nó novo e nenhuma redução de permissões realizada.

## Pendências

MPRJ ainda depende de mapeamento/autoria validada e dos demais gates do produto.
PCAL permanece agregado de dois cargos, TCE-MA de onze trilhas; não reduzir escopo
nem transferir questões entre cargos para atingir piso. CP112/recibo1 continuam
retidos. WhatsApp aguarda identificação e validação da integração. Meta/Google
Ads aguardam contas conectadas e orçamento explícito; nenhum gasto ativado.

Recibos privados nesta retomada: `.local/maestri/heartbeat-20261025-0405-*`.
Operação não alterou código nem schema; os testes completos do último deploy
continuam históricos, não foram reexecutados para esta manutenção operacional.
