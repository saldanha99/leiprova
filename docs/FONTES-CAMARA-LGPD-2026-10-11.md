# LGPD da Câmara: captura pendente

Implementação para Edital Lei Seca em 11/10/2026 (BRT). Não autoriza aprovação de
fonte, versão vigente, autoria ou venda. A exceção de aprovação automática das
inéditas não se aplica às fotografias de legislação.

## Origem e identidade preservadas

O [Texto Atualizado da Câmara](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html)
é a alternativa regular à obtenção da LGPD. A ficha 787077 da Câmara o identifica
como atualizado; nesta pesquisa, continha notas da Lei 15.352, de 25/02/2026.
Robots e HTML responderam HTTP 200 com agente identificado e TLS normal.

O registro da lei mantém slug `lei-geral-protecao-dados-2018`, URN, `officialUrl`
do Planalto e monitor `https://legis.senado.leg.br/norma/27457334`. Nenhum ID ou
versão existente é modificado. A fotografia de texto registra sua origem real:
URL da Câmara e parser `camara-lgpd-consolidated-v1.0.0`. Migração `0050` acrescenta
somente essa URL exata à restrição de fotografias; não libera domínio inteiro,
PDF, publicação original, queries, fragmentos ou redirecionamentos.

## Seleção e revisão

O adaptador puro verifica identificação da Câmara/Centro de Documentação e da
Lei 13.709/2018. Rejeita erro de transporte entregue como HTTP 200, charset
inválido, ausência de referências esperadas, duplicatas ativas e artigos de outra
lei. Une quebras de linha dentro de cada parágrafo do HTML LibreOffice antes de
agrupar dispositivos, preservando as fronteiras entre parágrafos.

Remove marcas de texto tachado, inclusive CSS; notas editoriais; dispositivos
indicados somente como revogados/vetados; títulos de seção e assinaturas. Não
elimina norma válida que use a palavra “revogado”, como a revogação do
consentimento. O art. 60 e suas alterações do Marco Civil ficam excluídos; devem
ser consultados na compilação vigente da norma alterada. Essa é uma seleção
de dispositivos substantivos, não uma declaração de reprodução integral.

O hash da fotografia vincula URL, versão do parser e corpus canônico. O hash
bruto do HTML e o hash do corpus sem o contexto de origem são distintos. Isso
impede confundir uma captura da Câmara com outra origem que produza texto igual.
O revisor recebe exatamente o texto normalizado preservado na fotografia.

O resultado exige revisão humana efetiva da vigência e da extração. As checagens
de identidade/estrutura não certificam mérito ou atualização temporal de cada
dispositivo. O fluxo existente do painel continua exigindo primeiro aprovação
do monitoramento e depois revisão da fotografia textual antes de ativar artigos.

## Operação preparada

```sh
pnpm legal:laws:load --capture-only --provider=camara lei=lei-geral-protecao-dados-2018
# Após migração e validação operacional, --apply grava somente fotografias pendentes.
```

Mantém administrador, referência de execução `LEGAL_LOAD_REFERENCE` e transação
serializável existentes. Rede fora da transação. Sem `--apply`, prévia é revertida.
Sem `--capture-only`, a LGPD por compilação alternativa continua bloqueada no
loader. Nenhuma versão é ativada por esse caminho.

`--provider=planalto` preserva a opção já implementada; `--provider=senado` exige
a compilação monovigente do Senado. Sem provider explícito, somente a LGPD usa
a Câmara como origem preferencial; Lei 14.133 mantém seu caminho anterior.
Provider Câmara em outra identidade falha antes de buscar seu texto.
Todos conferem robots antes da página e interrompem acesso proibido ou falho,
sem agente falso, TLS relaxado ou contorno de bloqueio.

## Evidência privada e validação

O HTML oficial previamente capturado em acesso regular foi processado somente
na pasta privada `.local/editorial/fontes-alternativas-20261011/`. Resultado:
**72 artigos preparados**, nova leitura do texto normalizado idêntica e nenhuma
nota de redação/acréscimo/conversão remanescente na checagem dirigida.
Não houve escrita no banco, aprovação humana ou ativação.

- HTML bruto: `5ade20f12d206504f3beb13a0595d144efc891229ad0e6badcebfa97a8a83596`.
- Corpus canônico: `c715b0f5cd40a80ada5a6bc8b7d0dfd803fc092865f3f0f49e15a2f7068af196`.
- Fotografia vinculada à origem/parser: `71f77103cbbe70b19a0f05d0060f34fbe8f51eb3f6c3e109182a0ec8d219741c`.

Arquivos integrais permanecem privados, fora de Git/Docker/provedores pagos.
Testes versionados usam texto sintético e verificam políticas, estrutura,
dispositivos retirados, limites, proveniência e reversibilidade da prévia.
32 testes direcionados passaram em cinco arquivos com dois workers. Lint dos
arquivos alterados passou; validação integral/deploy ficam com o responsável
operacional. A importação da Lei 14.133 em PDF não faz parte desta implementação.
