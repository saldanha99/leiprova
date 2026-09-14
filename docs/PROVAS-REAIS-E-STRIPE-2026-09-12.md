# Editalume — provas reais e liberação comercial

Data da verificação: 12/09/2026 (America/Sao_Paulo).

O processo de obtenção de autorização, o texto pronto para contato com as
organizadoras e o primeiro lote de PDFs oficiais identificados estão em
[`LICENCIAMENTO-PROVAS-ANTERIORES.md`](./LICENCIAMENTO-PROVAS-ANTERIORES.md).

## Resultado objetivo

A infraestrutura foi fechada para que uma prova real só possa ser vendida ou
entregue quando a cadeia inteira estiver comprovada. Isso não cria licença,
revisão humana nem conteúdo por presunção.

Na leitura de produção anterior a esta publicação havia:

- 403 questões, sendo zero em modo `previous_exam` e zero com licença registrada;
- zero edições de prova, cadernos, gabaritos ou vínculos de última prova;
- 75 produtos, todos em rascunho e nenhum liberado;
- zero pedidos, compras ou assinaturas.

Portanto, não existe hoje conteúdo real apto para venda. Ativar o Stripe nesse
estado permitiria cobrar por uma promessa ainda não entregue; as travas
comerciais permanecem fechadas.

## O que passa a ser exigido por produto

O vínculo temporal autoritativo é:

```text
cargo + especialidade + órgão + UF/jurisdição + edição/data -> banca
```

Uma prova anterior só fica elegível quando:

1. pertence exatamente à mesma carreira, especialidade, instituição e
   jurisdição do concurso atual;
2. foi aplicada antes do concurso atual e antes do dia da validação;
3. é a edição mais nova conhecida naquele escopo; se existir edição posterior
   ainda não conferida, o produto falha fechado;
4. edição e PDF foram reconferidos em fonte oficial permitida nos últimos 30
   dias;
5. o caderno e o gabarito exato são PDFs oficiais distintos, aprovados e
   revisados por pessoa diferente de quem os propôs;
6. a evidência de cada licença possui URL, hash SHA-256 imutável e data de
   conferência, todos incluídos no dossiê apresentado ao segundo administrador;
7. cada posição de `1` a `N` possui uma única questão, opções válidas, uma única
   resposta conferida contra o gabarito oficial, explicação, matéria compatível,
   procedência e revisão independente;
8. cada questão aponta por chave estrangeira para as versões exatas do caderno
   e do gabarito; as duas licenças precisam cobrir todo o período de acesso que
   será vendido;
9. o produto também possui o mínimo editorial de questões autorais e foi
   liberado por decisão humana auditada.

Não basta ter uma questão real, um link público ou um PDF oficial: a contagem de
questões qualificadas deve ser exatamente igual à quantidade declarada no
caderno.

## Entrega e revogação

O mesmo predicado é reexecutado:

- ao listar o produto;
- antes de criar ou retomar o checkout;
- ao processar cada período pago no webhook;
- ao iniciar uma sessão;
- antes de revelar correção, explicação ou gabarito;
- ao conceder acesso individual ou Master.

Se um caderno, gabarito, vínculo ou questão for retirado, a entrega é interrompida mesmo
em sessões já abertas. O painel administrativo possui retirada emergencial com
motivo obrigatório e trilha de auditoria. Registros aprovados são preservados no
histórico; uma correção posterior exige nova versão e nova revisão.

O PDF público é apresentado como link externo para a origem oficial. Uma cópia
hospedada só pode existir sob `licensed_content`, com evidência e armazenamento
controlados; esta entrega não copiou PDFs de bancas.

## LexML e direitos de uso

O LexML é usado para descobrir e identificar atos jurídicos, por URN e
metadados. Os endereços de dados abertos do projeto não constituem uma licença
para reproduzir comercialmente provas de bancas.

Não foi localizada, nos links fornecidos, uma norma específica que autorize a
Editalume a reproduzir comercialmente enunciados, alternativas, gabaritos e PDFs
de todas as bancas. A Lei 14.965/2024 estabelece normas gerais para concursos,
mas não concede essa licença de reprodução. A análise também precisa respeitar
a Lei 9.610/1998 e direitos eventualmente pertencentes à banca, ao órgão ou a
terceiros.

Antes de importar qualquer material real, o responsável precisa registrar:

- o ato exato alegado como autorização, com URL oficial e URN LexML;
- o titular dos direitos e o alcance material, comercial e temporal;
- a referência documental da autorização/licença;
- os termos do portal de origem;
- a data de concessão e eventual vencimento.

Fontes oficiais de referência:

- Lei 14.965/2024: <https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14965.htm>
- Lei 9.610/1998: <https://www.planalto.gov.br/ccivil_03/leis/l9610.htm>
- Dados abertos LexML: <https://projeto.lexml.gov.br/open-data>

## Estado do Stripe

Verificação sem revelar credenciais:

- checkout Master: fechado;
- checkout por concurso: não habilitado;
- credenciais Stripe: modo de teste, com chave restrita;
- Stripe Connect: modo de teste e aprovação brasileira final fechada;
- identidade do fornecedor: dois campos obrigatórios ainda ausentes;
- e-mail transacional: configurado;
- catálogo: nenhum produto liberado e nenhuma prova real completa.

Mesmo após a publicação do código, a venda continua indisponível por múltiplas
travas independentes. Nenhum segredo foi alterado ou versionado.

## Ordem segura para abrir vendas

1. obter e revisar a licença escrita ou a norma específica aplicável;
2. cadastrar cada edição e os links oficiais do caderno e do gabarito exato;
3. registrar o hash SHA-256 e a data de conferência das evidências de licença;
4. fazer revisão independente dos dois documentos e do vínculo com o produto;
5. importar o caderno completo como rascunho, vinculado ao gabarito, sem
   scraping automático;
6. revisar independentemente todas as questões, opções e respostas contra o
   gabarito oficial;
7. conferir no painel `N / N`, mínimo autoral, produto e preço exatos;
8. executar compra, webhook, renovação, cancelamento, reembolso e revogação em
   modo de teste;
9. completar a identidade do fornecedor e a configuração operacional;
10. no momento da virada, substituir as credenciais pelo conjunto live válido e
   só então habilitar os flags de checkout;
11. fazer uma compra real de valor controlado, conferir a entrega e registrar o
    recibo operacional.

O Maestri pode continuar a descobrir fontes e preparar trabalho, mas não pode
aprovar licença, revisão jurídica ou conteúdo. Nesta sessão, o CLI do Maestri
não estava disponível no host; nenhuma fila foi forjada ou marcada como
executada.
