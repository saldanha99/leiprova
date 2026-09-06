# Editalume — operação e passagem ao Maestro

Auditoria em 06/09/2026, aproximadamente 16h10 BRT. Pedido vigente: publicar o
trabalho concluído, atualizar o time e informar a prontidão editorial. **Stripe
pausada por decisão do proprietário**: não reenviar verificações, criar chaves,
alterar catálogo, cobrar ou abrir vendas nesta etapa.

## Publicação verificada

- Mac, GitHub (`origin/main` e branch `codex/checkout-entrega-producao`) e fonte
  da VPS estavam no commit `d230eaa`, sem alterações pendentes.
- Verificação repetida nesta passagem: lint, typecheck e build aprovados;
  1.174 testes passaram e 221 integrações opcionais foram ignoradas. Não houve
  alteração no código da aplicação nem execução de cobrança ou geração em produção.
- Aplicação construída de `dff881c`, saudável; checkout integrado, retomada,
  proteção de concorrência, reembolso por conciliação, fila durável de e-mail e
  revisão administrativa de vínculos já publicados. Ver
  `CHECKOUT-ENTREGA-2026-09-06.md` para testes e imagens.
- Homologação permanece separada. Não recompilar nem reiniciar serviços só
  para publicar esta documentação; sincronizar o Git por fast-forward.
- 75 produtos de concurso e Master já foram criados no catálogo LIVE Stripe:
  76 produtos e 152 preços Editalume na última conferência. Isso não significa
  checkout/entrega operacional. Chave runtime continua test; chave LIVE de
  pagamentos não foi emitida. Vendas e worker de entrega permanecem fechados.

## O que está operando de verdade

| Etapa | Evidência observada | Limitação |
| --- | --- | --- |
| Monitor de leis | Serviço ativo. Ciclo de 06/09 09h06 BRT: 10 normas e 4 portais consultados, zero falhas de consulta | 8 compilações inalteradas, 1 pendente, 1 aviso: Lei 14.133 sem compilação monovigente disponível pelo adaptador. Não cobre todas as leis |
| Coleta de editais | Serviço ativo. Ciclo de 06/09 15h05 BRT: 6 fontes consultadas com sucesso, 8 candidatos, 7 tentativas, 3 arquivos inalterados | 7 falhas entre fontes/documentos, zero novas capturas; ciclo retornou erro. Processo vivo não é coleta saudável |
| Extração de programa | 4 PDFs armazenados: 1 aprovado e 3 pendentes | Programa aprovado já extraído; 134 requisitos continuam em rascunho |
| Geração baseada na lei | Gerador determinístico e fila implementados; revisão de requisito e vínculo legal são pré-condições reais | Fila vazia, zero requisitos ligados a artigos, zero novos rascunhos no último ciclo. Não há geração contínua de inéditas por LLM/Maestri comprovada |
| Conteúdo por curso | 346 questões gerais: 312 revisadas, 12 pendentes, 22 rascunhos | 75 produtos sem oportunidade associada; nenhum dos 75 satisfaz o piso válido de 68 questões por produto |

Intervalos reais no compose: editais esperam 21.600 segundos após cada execução;
leis esperam 86.400 segundos. Reinício do serviço inicia novo ciclo. As falhas
são toleradas pelo laço (`|| true`) para continuar tentando; não considerar o
status Docker "Up" como teste de sucesso.

### Cobertura de novos editais

O coletor atual consulta **9 fontes previamente cadastradas e aprovadas**,
associadas a oportunidades revisadas. Não é um buscador nacional que descobre e
cadastra sozinho qualquer concurso novo. As fontes atuais incluem ENAM, ENAC,
PC-BA, PC-MA, PC-PR e PGM Manaus; anúncios/pré-editais não são editais completos.
As falhas do último ciclo aparecem em ENFAM, CNJ, SSP-BA, Manaus e FCC. Os logs
editoriais ocultam a mensagem e registram somente `Error`; a causa individual
ainda precisa de diagnóstico, sem concluir que seja HTTP, parser ou permissão.

Quando surgir um novo edital fora dessas fontes, Radar deve localizar a fonte
oficial, identificar cargo/edição/banca e apresentar dossiê para revisão. Após
aprovação, associar oportunidade, PDF, requisitos, artigos vigentes e perfil da
banca/cargo. Só então a fila pode gerar rascunhos. Publicação exige revisão humana
efetiva e vínculo aprovado ao produto exato; não aproveitar aprovações de outros
lotes nem transferir conteúdo entre cargos por compartilhar a mesma banca.

## Acessos e segredos

- Projeto único: `/Users/viniciussaldanharosario/DOCUMENTOS/PROJETOS/leiprova`.
- VPS: alias SSH existente `wisewolf-vps`, diretório `/opt/leiprova`.
- Produção: https://leiprova.2b.app.br ; homologação:
  https://homolog.leiprova.2b.app.br/entrar . Domínio Editalume ainda não comprado.
- Credenciais runtime permanecem em `/opt/leiprova/.env`, permissão 0600.
  Não imprimir, copiar para canvas/prompts ou usar configuração de outro projeto.
- Senhas dos três perfis sintéticos estão somente no arquivo privado
  `.local/commerce/qa-persistente/ACESSOS-HOMOLOGACAO.md`. Não são contas de produção.
- Stripe: Chrome Vini, conta 2timeWeb. Manutenção LIVE separada, localização e
  permissões em `ACESSOS-OPERACIONAIS.md`. **Integração de pagamentos pausada**.
- Cloudflare: Chrome Daniel, somente registros leiprova/homolog.leiprova.
- Relay/OpenCode e Vetor/Antigravity não recebem segredos nem acesso a contas.
  Não criar tokens, ampliar permissões ou enfraquecer proteções para esta passagem.

## Modos operantes e fila do Maestro

Usar as skills `maestri` e `maestri-manager`; primeiro `maestri list`, depois ler
as notas existentes. O CLI foi encontrado em
`/Applications/Maestri.app/Contents/Resources/maestri`; funciona apenas no terminal
inicializado pelo Maestri. Não forjar `MAESTRI_SOCKET`/identidade a partir do Codex.
O canvas observado contém oito terminais e cinco notas. Nomes históricos servem
para localização; a marca atual é Editalume. Preservar IDs, conexões e sessões.

- Maestro: manter fila e reservar uma tarefa por responsável; ler AGENTS.md,
  este relatório e OPERACAO.md antes de operar. Stripe em pausa, sem gastos em APIs.
- Radar: inventariar cobertura e diagnosticar as sete falhas; fontes oficiais,
  versões/hash e banca confirmada. Não aprovar por conta própria.
- Guardião: controlar vigência e preparar proposta de mapeamento dos 134
  requisitos a artigos. Não alterar status de revisão humana.
- Autor: permanecer aguardando insumos elegíveis. Elaborar inéditas por banca E
  cargo, fontes oficiais e originalidade; resultado sempre rascunho até revisão.
- Forge: engenharia, Git/SSH isolados e evidência de testes. Próxima necessidade
  proposta: diagnóstico seguro por fonte e ponte durável fila–Maestri, ainda não
  implementada nem autorizada como correção por este relatório.
- Prism: revisão técnica e experiência do usuário, sem se declarar revisor humano.
- Relay: somente apoio público sanitizado, modelo gratuito previamente confirmado.
- Vetor: prototipação visual, Antigravity/Flash já instalado, sem segredos.

Esta passagem autoriza atualizar notas/contexto e diagnosticar por leitura. Não
iniciar nova rotina periódica, geração em massa, publicação editorial ou correção
de código sem nova tarefa delimitada. Workers existentes continuam na VPS. Nós
ociosos no canvas não equivalem a agentes trabalhando continuamente.

## Critério para chamar a operação de automatizada

Demonstrar um edital novo de fonte oficial passando por captura versionada,
extração, mapeamento revisado, geração original por cargo, revisão humana,
vínculo ao produto e acesso isolado do aluno. Também testar retificação/alteração
legal e falha/retry sem duplicação. **Esse fluxo completo ainda não foi validado.**
