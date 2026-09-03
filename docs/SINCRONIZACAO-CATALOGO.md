# Sincronização de carreiras, edições, bancas e leis

## Dois domínios temporais separados

`exam_editions` continua registrando provas passadas que podem sustentar o catálogo do quiz e
uma análise histórica autorizada. `contest_opportunities` registra concursos atuais, desde a
autorização e o pré-edital até inscrições, prova, resultado e encerramento. Um registro passado
não vira oportunidade atual por inferência.

As oito categorias são apenas navegação editorial. Estado, órgão, cargo, ano, situação e
responsável pertencem a uma oportunidade concreta. Uma edição possui no máximo um responsável
primário vigente e revisado, que pode ser:

- uma organizadora externa, com perfil de banca quando aplicável;
- uma comissão institucional, sem banca fictícia;
- um arranjo híbrido, com elaboração e logística registradas em papéis separados.

Uma oportunidade só fica pública depois de possuir fonte oficial aprovada, revisão humana
independente e datas de publicação. A partir da etapa em que um responsável já deveria estar
definido, a publicação também exige a atribuição primária revisada. Triggers no banco impedem
rebaixar a última fonte aprovada, cruzar documentos entre oportunidades ou deixar uma edição
pública sem o responsável exigido.

As rotas públicas seguem `/concursos/[categoria]/[uf]/[edicao]`. O hub e o sitemap consultam
somente oportunidades `reviewed`; sinais `pending_review` ficam privados mesmo quando o robô
consegue acessar a URL oficial.

## Regra de domínio

Uma carreira não possui uma banca permanente e um ano, sozinho, não identifica uma prova.
O vínculo autoritativo é:

```text
carreira + especialização opcional + órgão/jurisdição + edição/data -> uma banca
```

Podem existir duas provas da mesma carreira no mesmo ano, inclusive com bancas diferentes.
Por isso, `exam_editions` é a autoridade da relação temporal. A interface apresenta o ano e,
quando necessário, mais de uma edição naquele ano. A banca é somente leitura e vem da edição.

No caminho “Por banca e matéria”, a escolha livre continua válida porque a banca é o próprio
ponto de partida. No caminho “Por cargo ou concurso”, o cliente não envia uma banca livre; a
API resolve novamente a edição elegível e deriva `bank_id` no servidor.

## Estados e publicação

- O sincronizador importa somente metadados de portais oficiais.
- Cada registro externo é idempotente pela chave `(bank_id, source_external_id)`.
- Uma importação nova permanece em `draft`; sincronizar não equivale a revisar ou publicar.
- `source_checked_at` funciona como marca d'água: uma observação atrasada não sobrescreve um
  rascunho mais recente.
- Mudanças descobertas depois que a edição sai de `draft` são bloqueadas para nova revisão;
  uma proteção no banco impede que o papel da aplicação contorne essa regra.
- Somente edições `held` ou `published`, não futuras, com URL oficial e taxonomia ativa entram
  no catálogo do quiz.
- O modo `previous_exam` continua exigindo, além da edição, questões licenciadas e revisadas.
- O modo `original_style` usa a banca derivada apenas como referência de estilo; o conteúdo é
  autoral.
- `dry_law` pode funcionar sem edição e não recebe uma banca fictícia.

## Catálogo jurídico LexML

Os endereços `projeto.lexml.gov.br/open-data` e
`projeto.lexml.gov.br/transparencia/dados-abertos` descrevem os dados do CMS institucional;
eles não são a busca do acervo jurídico.

O cliente jurídico usa, em lote:

1. SRU LexML: `https://www.lexml.gov.br/busca/SRU`;
2. contingência oficial do Senado:
   `https://legis.senado.leg.br/dadosabertos/legislacao`.

O SRU é aceito apenas com HTTP 200, `Content-Type` XML, raiz
`searchRetrieveResponse` e identidade exata. HTML de verificação é classificado como desafio
de segurança, não como XML válido. A contingência do Senado também valida tipo, número, ano e
URN antes de devolver metadados. A busca por tipo/número/ano fica restrita aos atos numerados
suportados. Atos não numerados, como a Constituição, são consultados pela URN e cruzados com os
campos independentes de tipo e ano do registro interno.

O LexML fornece descoberta, identidade persistente e metadados. O texto usado nas questões
continua vindo da publicação oficial registrada, gera uma fotografia com checksum e passa por
revisão humana. Uma indisponibilidade simultânea dos catálogos não apaga a última URN validada
nem transforma conteúdo pendente em aprovado.

Depois que a fotografia de monitoramento é aprovada, o painel editorial pode localizar a
`Compilação Monovigente` da mesma norma no sistema oficial do Senado. O coletor exige que o
identificador da norma permaneça idêntico, limita a resposta, remove redações riscadas e notas
editoriais de alteração e separa os artigos de forma determinística. Texto integral, checksum,
contagem e versão do parser ficam em `legal_text_snapshots`. A conta proprietária configurada
pode capturar e revisar a compilação inteira com uma nota humana obrigatória; outras contas
continuam exigindo um revisor diferente. Somente a aprovação cria a `legal_version` vigente e
ativa seus artigos oficiais. Se a fonte não oferece compilação monovigente, o motor falha fechado
e não usa a publicação original como se fosse texto consolidado.

## Separação das sincronizações

```text
Portais oficiais das bancas -> metadados da edição -> carreira/edição/banca
LexML + Dados Abertos Senado -> URN e identidade do ato -> monitor jurídico
Publicação consolidada oficial -> fotografia/checksum -> revisão humana independente -> artigos vigentes
```

O LexML não determina qual banca organizou um concurso. Essa informação deve vir do portal da
banca ou do órgão responsável, com um identificador externo estável.

## Trava para provas e captura autorizada de editais

A autorização do responsável registrada como `owner-approval-2026-09-01` permite capturar
somente editais e anexos oficiais de conteúdo programático. A origem metadata-only precisa ser
aprovada primeiro; o coletor então redescobre o link no portal permitido, valida cada
redirecionamento, limita o arquivo a 15 MB e 250 páginas, confirma a assinatura PDF e guarda a
versão integral, o texto por página e o checksum em `opportunity_document_snapshots`.

Provas, cadernos, questões, alternativas, respostas e gabaritos continuam bloqueados antes do
download. Para habilitar qualquer coletor desse material, permanece obrigatório registrar e
revisar:

- a norma específica alegada como autorização, com link oficial e URN LexML;
- seu alcance material e temporal;
- eventuais direitos de terceiros e termos do portal de origem;
- a base de licença/procedência exigida pelo fluxo editorial.

Sem essa decisão jurídica explícita, o material de prova permanece fora do motor. A captura de
edital usa a política `official_document`, exige uma decisão humana registrada sobre a versão e
produz apenas itens literais em `draft`. O padrão é revisão independente. A conta editorial do
proprietário, designada na configuração do servidor, pode registrar uma exceção explícita,
vinculando autorizador e aprovador na trilha de auditoria sem transformar a decisão em revisão
independente. Matéria, assunto, artigo legal e
aprovação dos requisitos continuam sendo decisões humanas separadas; somente depois o gerador
autoral pode criar um rascunho de questão.

## Operação

O verificador manual `pnpm legal:sources:check` confere a página oficial da norma e sua identidade
LexML/Senado. O agendamento contínuo ainda não está ativo. Scripts `tsx` devem continuar usando
`--env-file-if-exists=.env`, conforme `docs/OPERACAO.md`.

O verificador `pnpm opportunities:sources:check` executa apenas `HEAD` nas URLs oficiais
permitidas, valida redirecionamento, host e caminho e devolve metadados de observação. Ele não
baixa nem guarda HTML ou PDF. A captura integral é uma operação editorial separada na rota
`/admin/motor-editais`, aplicada somente a uma fonte já aprovada. Respostas que bloqueiam `HEAD` viram alerta;
URLs ausentes, redirecionamentos fora da allowlist e falhas de origem exigem investigação.

Qualquer análise de até dez anos deve registrar janela, amostra, denominadores, metodologia,
limitações e direitos do corpus. Frequência histórica é um sinal de prioridade, não uma
probabilidade garantida de cobrança. Questões de incidência só podem usar corpus licenciado ou
outro uso autorizado e revisado; simulados novos permanecem autorais.

O modelo inicial `priority-v1.0.0` calcula incidência por prova e intervalo de Wilson de 95% e
combina incidência (35%), recência (20%), persistência (15%), aderência ao edital (25%) e
relevância de alteração legislativa (5%). Os pesos são editoriais, versionados e sujeitos a
validação retrospectiva; o campo `isForecastProbability` permanece falso por desenho.
