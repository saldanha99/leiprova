# Piloto editorial com API — autorização de 13/10/2026

O proprietário respondeu “teto total de 30” à proposta de teste de100questões.
Moeda: BRL, conforme a pergunta de orçamento. Autorização limitada ao piloto,
sem renovação diária, recarga automática ou ampliação da produção paga contínua.

## Estado confirmado — 13/10/2026, após14h22 BRT

- Chave exclusiva criada com aprovação pontual e verificação de e-mail do
  proprietário: “Edital Lei Seca — piloto R$30”, validade até14/10 às14h BRT,
  limite total US$3, sem reset. Credencial guardada com permissão600 somente no
  diretório privado do piloto no Mac e na VPS; nenhuma chave de outro projeto usada.
- **100 rascunhos gerados**,15por Gemini3.8Flash e85por Gemini3.1FlashLite.
  **55 recusados em11lotes** pelo contrato; **45 em9lotes** passaram nas checagens
  mecânicas e receberam supported na revisão assistida. **Zero publicados**.
  Uma questão inválida retém o lote completo, preservando o comportamento atual.
- Diagnóstico mecânico:16citações não literais distribuídas pelos11lotes; nenhum
  articleId fora dos insumos. Três controles sintéticos foram corretamente
  classificados: uma regra correta, um prazo incorreto e um comentário incorreto.
  Esse controle delimitado não certifica qualidade jurídica dos45 candidatos.
- Consumo confirmado pelo provedor: **US$0,22199975**. Ledger arredonda cada
  chamada para cima e registraUS$0,222011. Não houve recarga/compra de créditos,
  mudança de pagamentos ou gastos emoutros projetos.
- Teto autorizado continua **R$30 total**, incluindo provedores/tentativas/taxas.
  O executor usa conversão conservadora de orçamento BRL10/USD e teto USD3,
  não uma cotação cambial. Equivalente conservador reservadoR$2,22011; **custo
  exato emBRL não verificado**. Nenhuma reserva de chamada ficou pendente.
- Jev não foi conectado ou financiado; conta observada tinha saldozero. Nenhuma
  nova credencial/recarga desse provedor foi criada.

## Executor e evidências

`scripts/run-api-editorial-pilot.ts` é um benchmark isolado: não possui acesso
à fila/banco, SSH, importação ou liberação. Prévia é o padrão; aplicação exige
chave exclusiva conferida por fingerprint, limite/expiração reais, catálogo
compatível, ledger durável e lock exclusivo. Sem retry automático de custo
incerto ou reset diário. A contagem máxima é20chamadas geradoras/até100questões,
mesmo com novos snapshots/modelos/reinícios; orçamento inclui verificações.

Dados extraídos por consulta read-only de tarefas pending/prepared, excluindo
ocupadas, com contrato atual pelo predicado existente, versão/artigo literal
atual/revisado/official_text e pai prepared comhash correspondente. Nenhuma
reserva foi duplicada/alterada ou declarada completa. Conteúdo privado de
terceiros/corpus existente não foi enviado ao provedor; o corpus é usado somente
localmente para comparação de originalidade.

A primeira execução recusou citação comreticências; o lote ficou retido, sem
corrigir artificialmente para publicação. Inspeção assistida também observou
necessidade de contexto constitucional para candidatura de membro do MP e
qualificadores emCF84VI. Outra tentativa sem custo encontrou requisito válido
com menos de20caracteres; corrigida essa restrição local indevida, preservando
conteúdo/requisito originais.

**Correção posterior à amostra:** emnova geração, o modelo seleciona quoteId
entre trechos contínuos do corpus e o código copia articleId/quote exatos.
Não afrouxa a validação existente nem altera artigo/checksum/contrato. Não
repara os100rascunhos nem certifica suporte semântico. Quatro testes verificam
cópia literal, identidade, ausência de fallback e recusa de seleção inválida.
Essa versão **ainda não foi retestada emchamadas geradoras pagas**, pois o teto
amostral de100já foi atingido. Não atribuir à correção ganhos medidos nesta amostra.

Médias exploratórias de geração por lote: Flash3.8 **48,05s** e FlashLite **9,03s**.
As entradas/temas/contextos diferiram; não é comparação controlada ou previsão
de questões válidas publicadas/hora. Geração de JSON não substitui conferência
jurídica, domínio de fontes, direitos ou vínculo atualizado.

QA final: lint/typecheck/build e **1.859testes passaram**;293condicionais ignorados.
Três timeouts de wrappers antigos na primeira execução resolveram ao reduzir
paralelismo e permitir30s, sem mudar esses testes. Onze testes novos do orçamento
+seleção de citações passaram. Não houve deploy deapp, worker, schema ouflags.

Recibos privados: `.local/editorial/api-pilot-20261013/RESULTADO.json`,
`budget.json`, `provider-final-usage.json`, generation/verification/outcome,
controles e logs deQA. Segredo permanece fora deGit/Docker/relatórios.

## Sequência de execução

1. Conectar conta e chave do provedor pelo ambiente privado autorizado.
   Não enviar chave pelo chat/Git/notas. Criação de credencial pela interface
   depende da confirmação exigida pela ferramenta no momento da ação.
2. Priorizar OpenRouter para autoria; Jev é avaliação opcional do suporte
   e pertinência das justificativas, sem escrever questões. Não financiar
   dois provedores se isso consumir/exceder o mesmo teto deR$30.
3. Registrar o custo efetivo em BRL dos créditos, incluindo taxas/câmbio do
   pagamento. Antes de pagar, conferir que o total cabe no teto. Sem essa
   conversão confirmada, não presumir equivalência entre R$30 e US$30.
4. Preparar executor isolado: reservar custo máximo antes de cada chamada,
   considerar gastos pendentes, impor limite de saída/preço/modelo e bloquear
   nova chamada quando o saldo conservador não a comportar. Falha com custo
   incerto bloqueia repetição até reconciliação; não zerar orçamento ao reiniciar.
5. Fazer comparação inicial com o Autor existente usando fontes oficiais,
   cargo/edição/formato exatos e contratos atuais. Não duplicar reservas nem
   editar pacotes ocupados. Não alterar corpus jurídico para atingir quantidade.
6. Validar formato, única resposta, citações, vínculo, versão e originalidade;
   conferir todas as alternativas/justificativas com contexto oficial atual.
   Probabilidade do Jev não comprova vigência, jurisprudência ou mérito.
7. Publicação continua pelos operadores auditados existentes. Arquivo privado,
   resultado preparado ou JSON válido não entra na contagem publicada.

## Decisão após o piloto

Comparar custo por questão distinta válida efetivamente publicada, vazão de
ponta a ponta e erros retidos. Qualquer orçamento diário ou escala paga exige
nova decisão expressa. A equipe Maestri continua pelo fluxo atual enquanto a
integração aguarda acesso. Não prometer ganho,100itens ou1.000válidas/dia sem
medição real. Proposta técnica privada em
`.local/editorial/continuation-20261012/piloto-aceleracao-openrouter-jev-20261013.md`.
