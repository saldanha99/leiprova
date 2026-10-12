# Compilações oficiais do Planalto

Preparação técnica em 11/10/2026 (BRT), para Edital Lei Seca. Não comprova carga,
revisão humana, vigência conferida item a item nem liberação comercial.

## Fontes e identidade

- LGPD: [registro Senado](https://legis.senado.leg.br/norma/27457334) e
  [compilação Planalto](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).
  A página `l13709.htm` reúne redações históricas, inclusive versões repetidas sem
  tachado; não é aceita. Norma 13.709, de 14/08/2018, URN
  `urn:lex:br:federal:lei:2018-08-14;13709`.
- Licitações: [registro Senado](https://legis.senado.leg.br/norma/33382036) e
  [texto atualizado Planalto](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm).
  A página oficial reúne o texto vigente com redações anteriores tachadas.
- [Lei 12.737/2012](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12737.htm)
  é alteradora. Seus arts. 2 e 3 reproduzem mudanças do Código Penal de 2012;
  não são o texto penal vigente. Para requisitos sobre delitos informáticos,
  Guardião deve propor os artigos atuais do CP consolidado (154-A, 154-B, 266 e
  298, conforme o programa). Não registrar a lei alteradora como compilação atual
  desses crimes nem transferir automaticamente seu perfil a outro cargo.

## Captura e limites

Migração `0049` permite exclusivamente as duas URLs do Planalto acima na tabela
de fotografias do texto jurídico. Mantém todas as verificações de revisão.
Não autoriza um domínio inteiro, queries, páginas históricas ou redirecionamentos.

O capturador usa agente identificado e consulta `robots.txt` antes da página.
Falha de rede, robots proibitivo ou resposta HTTP negativa impedem a captura;
não há agente de navegador falso, contorno de bloqueio ou API paga.

O parser `planalto-consolidated-v1.0.0` decodifica Windows-1252/UTF-8 declarado,
remove `strike/s/del`, estilo inline e classes CSS com `line-through`, rejeita
caracteres inválidos, identidade trocada, artigos estrangeiros, duplicatas ativas
e corpus sem artigos inicial/final esperados. Mantém revisão posterior sobre a
vigência temporal; remover tachado não substitui revisão jurídica.

Alterações de outras leis não viram artigos próprios: blocos citados são
excluídos, assim como LGPD art. 60 e Lei 14.133 arts. 177–179. Esses trechos
devem ser consultados na compilação vigente da norma alterada. Dispositivos
marcados apenas como vetados/revogados não entram como conteúdo de estudo.
O corpus é uma seleção explícita desses dispositivos; não anuncia integridade
de dispositivos revogados, vetados ou de alterações de outros códigos.

Operação preparada, a executar pelo responsável operacional após migração:

```sh
pnpm legal:laws:load --capture-only lei=lei-geral-protecao-dados-2018 lei=lei-licitacoes-contratos-2021
# --apply persiste somente fotografias pendentes; sem --apply, transação desfeita.
```

Exige administrador e `LEGAL_LOAD_REFERENCE`, como o operador existente. As
novas compilações do Planalto são bloqueadas sem `--capture-only`. Não cria versão
vigente, artigos revisados, questões ou vínculos. Fotografias pendentes devem
passar pelo fluxo auditado de `/admin/fontes-oficiais`, primeiro monitoramento,
depois texto. Não presume que a autorização automática das inéditas aprove fontes.

Hash SHA-256, data da captura, URL e versão do parser são registrados no resultado
e na fotografia; o hash identifica o corpus exato apresentado para revisão.

## Evidência e impedimento na preparação

As páginas oficiais foram lidas no navegador de pesquisa em 11/10/2026. Nas
tentativas de obter `https://www.planalto.gov.br/robots.txt` com agente identificado,
Mac e VPS de origem responderam `Connection reset by peer`. Portanto **nenhum
hash de corpus real, captura no banco ou aprovação foi produzido nesta tarefa**.
O último teste na VPS de destino (`everglades-vps`) também recebeu o mesmo erro,
inclusive com conexão IPv4 normal. A abertura pública no Chrome respondeu
`net::ERR_BLOCKED_BY_CLIENT`; não se tentou contornar esse bloqueio.
Não inventar contagens a partir dos testes sintéticos nem registrar uma revisão
que não aconteceu. Quando o acesso regular estiver disponível, o capturador
produzirá os hashes/data e as fotografias pendentes para conferência.

Validação direcionada: 24 testes passaram em quatro arquivos com um worker;
lint dos arquivos alterados passou. Root executa a validação integral da entrega.
