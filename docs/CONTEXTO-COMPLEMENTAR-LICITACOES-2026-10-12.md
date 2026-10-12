# Contrato preparado: valores anuais e transição da Lei 14.133

O módulo puro `src/lib/official-sources/procurement-context.ts` prepara fatos complementares para autoria delimitada, **sem aprovar fontes, artigos ou questões**. Retorna `publicationAllowed:false`, `humanReview:false`, estado `prepared_for_automated_review`, `requiresApprovedSourceIds:true` e lista vazia de IDs. Não modifica o operador 182/9 nem suas pendências.

## Identidade, período e separação de fontes

A entrada exige artigo literal, URLPDF e parser exatos e o hash do corpus 191 já confrontado. O módulo confere também o SHA individual do literal de cada um dos nove artigos pendentes. O literal de saída é idêntico byte a byte: a atualização anual não muda a redação da lei.

Valores são fatos separados, em centavos inteiros e representação BRL do anexo do Decreto 12.807/2025. O pacote cita decreto e anexo separadamente da lei, com SHA bruto, publicação em 30/12/2025 e vigência em 01/01/2026. A janela editorial é 2026; **não afirma que o decreto esteja automaticamente revogado em 31/12/2026**. Outros exercícios exigem novas fontes. Cobrança de transcrição nominal não aceita este contrato de limite aplicado.

| Dispositivo | Valor aplicado em 2026 (R$) |
|---|---:|
|6 XXII|261.968.421,04|
|37 §2|392.952,63|
|70 III|392.952,63|
|75 I|130.984,20|
|75 II|65.492,11|
|75 IV c|392.952,63|
|75 §7|10.478,74|
|95 §2|13.098,41|
|184-A caput|1.646.430,90|

Fontes primárias capturadas com acesso regular, robots permitido e tabela visualmente conferida: [decreto](https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-publicacaooriginal-177646-pe.html), [anexo, DOU p.17](https://www2.camara.leg.br/legin/fed/decret/2025/decreto-12807-29-dezembro-2025-798615-anexo-pe.pdf). Os valores base não resolvem todo caso concreto: agregação e condições como o art. 75 §3 devem ser conferidas. O contexto de recontratação emergencial/ADI 6890 é expressamente recusado. Não foi capturado/enviado acórdão bloqueado nem criada conclusão sobre sua revisão.

## Temporalidade do treino com legislação atual

O pacote distingue `referenceDate` (base atual de 2026) de `eventDate` (data do edital/evento histórico). Não afirma reconstruir o texto legal vigente numa edição passada. Isso corresponde à escolha do proprietário: treino histórico com legislação atualizada. Datas inválidas, evento futuro e casos históricos sem data são recusados.


- 175 §2: [promulgação oficial de 11/06/2021](https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-promulgacaodevetos-162977-pl.html); a obrigação complementar termina em 31/12/2023. Casos específicos desse parágrafo só são preparados entre essas datas. Prazo encerrado não afasta outras regras de publicidade.
- 191/193: [LC 198/2023 art.3](https://www2.camara.leg.br/legin/fed/leicom/2023/leicomplementar-198-28-junho-2023-794386-publicacaooriginal-168282-pl.html) fixa revogação em 30/12/2023. Não há escolha antiga nova em 2026. Regime de contrato antigo pode sobreviver durante a vigência, sem conversão automática ou mistura de regimes. Data e regime do caso precisam ser informados; estar numa janela não comprova legalidade do procedimento/contrato.
- Casos do próprio dia 30/12/2023 não são resolvidos automaticamente pelo contrato: exigem análise específica. O módulo limita a preparação de escolha histórica a evento anterior à revogação; isso é cobertura editorial conservadora, não nova regra legal para procedimentos daquele dia.

## Integração ainda necessária — não mascarar pendências

Antes de o Autor consumir os fatos, o operador deve produzir **IDs reais de revisão e fontes complementares**, com auditoria permanente do proprietário e `humanReview:false`. O contrato do Autor deve carregar: artigo e versão da lei, fonte do decreto+anexo ou alteração temporal, hashes/IDs aprovados, data de referência, data do caso, foco exato do dispositivo e tipo de cobrança. Questão monetária deve citar ambas as bases; nominal e aplicada não podem ser confundidas. A liberação não pode usar IDs vazios ou um marcador prepared como aprovação.

O módulo, sozinho, não integra esses IDs, não elimina o gate editorial dos nove artigos, não propõe lei14.133inteiramente revisada e não aprova questões. Art.75 deve continuar pendente no âmbito da ADI; qualquer futura liberação granular precisa preservar esse bloqueio real. Os cenários temporais não importam questões nem edições históricas de terceiros.

Evidência privada: `.local/editorial/licitacoes-reconciliacao-20261012/` contém raw fontes, hashes, datas e comparação 11/11 das partes promulgadas. Nenhum corpo integral do PDF é enviado no módulo. Mudança de corpus, literal ou anexo exige outra reconciliação; o pacote não atualiza provas por inferência.
