# Fábrica editorial — configuração do time Editalume

Pedido do Vinícius de 05/09/2026. Este plano configura responsabilidades; não
atesta que o pipeline já está continuamente integrado ou que cursos estão prontos.

## Atualização efetiva do canvas — 06/09/2026

O nó existente Maestro LeiProva recebeu, dentro do aplicativo Maestri, a passagem
delimitada de `ESTADO-OPERACIONAL-2026-09-06.md`. As cinco notas existentes foram
atualizadas pelo CLI do próprio terminal e os novos textos foram conferidos na
interface: marca Editalume, Stripe pausada, publicação já realizada, cobertura e
falhas dos workers, fila vazia e localização segura das credenciais (sem valores).
Oito terminais preservados; sem novos agentes, mudança de permissões ou criação
de rotina. ACCESS-ROUTING permanece somente com o Maestro. Isso atualiza a memória
operacional, mas não corrige o coletor nem ativa geração contínua.

Os estados antigos abaixo são históricos. A referência vigente de produção é
`ESTADO-OPERACIONAL-2026-09-06.md`: nove fontes cadastradas, último ciclo de coleta
com sete falhas, 134 requisitos sem artigos associados e zero rascunhos novos no
ciclo. O monitor legislativo consulta dez normas e quatro portais, não toda a
legislação brasileira. Vendas continuam fechadas e Stripe fica para outra etapa.

## Marca atual do time — 06/09/2026

O projeto se apresenta como **Editalume**. Maestro e auxiliares devem ler
`AGENTS.md` e `docs/MARCA-EDITALUME.md` ao iniciar tarefas e usar esse nome nas
novas entregas. Os nomes de nós e workspace descritos nas observações de
05/09/2026 abaixo são evidências históricas, não uma orientação para manter a
marca antiga nas interfaces.

O rótulo lógico desejado do coordenador é **Maestro Editalume**. Antes de uma
alteração futura de rótulo no canvas, identificar e reutilizar o nó existente;
não criar outro Maestro, substituir sessões ou mudar conexões por causa do nome.
Esta revisão dos documentos não acessou nem alterou o canvas.

Preservar a raiz `leiprova`, os recursos técnicos e os domínios atuais. O domínio
definitivo da Editalume ainda não foi comprado e não há novo endereço definido
para o time utilizar. Mudança de marca não autoriza migração de dados, DNS,
checkout ou webhooks, nem acesso a outros projetos.

## Configuração observada no canvas em 05/09/2026

O workspace exclusivo foi criado pelo CLI do Maestro e preservou `My Workspace`.
Na montagem inicial foram observados sete nós: Maestro LeiProva, Forge, Prism, Radar, Guardião, Autor e
Relay, com seis papéis especializados. Presets aplicados: Claude Code para Maestro
e Radar; Codex para Forge, Prism, Guardião e Autor; OpenCode para Relay.

As cinco notas abaixo foram criadas. ACCESS-ROUTING registra Cloudflare no Chrome
Daniel e Stripe no Chrome Vini; não é compartilhada com Relay. O Maestro registrou
seis ligações com auxiliares e a cadeia Radar → Guardião → Autor → Prism.

**Pendente de verificação final:** inicialização de cada CLI, seleção efetiva dos
modelos pedidos e arranjo visual final. Ao menos um terminal Codex mostrou uma
oferta de atualização durante a inspeção. O Mac foi bloqueado antes de finalizar
os ajustes de interface. Não tratar nós desenhados como agentes em execução, nem
esta montagem como ativação de geração contínua. Não houve instalação/compra de
modelo ou geração de novo lote nesta inspeção. Na retomada, o terminal do Maestro
registrou autoatualização dos quatro Codex; esse relato não comprova que todos os
modelos, MCPs ou sessões estejam configurados e saudáveis.

## Adição solicitada — Antigravity / Gemini 3.8 Flash

O usuário pediu manter OpenCode/Relay e incluir Antigravity no mesmo time.
Verificação local somente de leitura: Antigravity 2.11.0 instalado; CLI
`/Users/viniciussaldanharosario/.local/bin/agy` funcional. `agy models` lista
`gemini-3.8-flash-high`, `gemini-3.8-flash-medium` e `gemini-3.8-flash-low`.
O comando suportado para o nó solicitado é
`/Users/viniciussaldanharosario/.local/bin/agy --model gemini-3.8-flash-high`.
O nome do preset é **Antigravity**; o modelo é um argumento do CLI, não um preset
Maestri separado. Isso corrige a limitação presumida anteriormente sobre Flash.

**Estado observado:** o canvas passou de sete para **oito terminais** e mostrou
**Vetor**, ícone Antigravity e papel **Vetor — Prototipação visual**. O Maestro
confirmou o ID no catálogo e registrou recrutamento com o comando explícito acima.
OpenCode/Relay permaneceu no canvas. Após a autorização explícita do usuário,
a confiança da pasta foi confirmada. O terminal iniciou autenticado, mostrou
**Gemini 3.8 Flash (High)** e respondeu ao teste de inicialização. Também leu o
`AGENTS.md` da raiz e executou `maestri list` com sucesso. Foram conferidas na
interface e na resposta as conexões Maestro LeiProva, Prism, Forge,
PROJECT-CONTEXT e TEAM-CHARTER; ACCESS-ROUTING não aparece entre elas.
A nota TEAM-CHARTER foi atualizada pelo próprio Vetor e conferida na interface:
oito nós, sete auxiliares, papel/modelo do Vetor e suas cinco conexões. O aviso
antigo de indisponibilidade do Gemini Flash foi corrigido, preservando Relay e
os limites de custo e de escopo.
O agente ficou ocioso após o teste, sem alterar a aplicação ou iniciar conteúdo.
A inicialização foi validada; não constitui prova de execução contínua, de cota
ilimitada ou de prontidão da operação comercial.
Não criar nova assinatura/API, comprar créditos ou trocar modelo ao atingir limite.

Papel complementar: **Vetor — Prototipação visual**. Explorar referências públicas
e produzir protótipos a partir de tarefas delimitadas do Maestro; Prism mantém a
direção de produto/revisão, Forge a integração de engenharia. Vetor não acessa
segredos, contas operacionais, dados privados ou outros projetos; não publica nem
decide vigência jurídica. As conexões verificadas são Maestro, Prism e Forge, com
PROJECT-CONTEXT e TEAM-CHARTER; sem ACCESS-ROUTING. Na montagem, apenas confirmar
papel e modelo e ficar ocioso. Reutilizar um nó compatível antes de criar duplicata.

## Espaço e memória

- Workspace exclusivo observado em 05/09/2026: **LeiProva — Fábrica Editorial**.
  Nome histórico preservado para localizar o workspace, sem comprovação de
  renomeação posterior. Marca atual do projeto: **Editalume**.
- Raiz: `/Users/viniciussaldanharosario/DOCUMENTOS/PROJETOS/leiprova`.
- Preservar integralmente o workspace antigo `My Workspace`.
- Todos leem `AGENTS.md`, `docs/MARCA-EDITALUME.md`, `docs/OPERACAO.md` e
  `docs/ACESSOS-OPERACIONAIS.md`.
- Memória operacional: **Cloudflare no Chrome Daniel; Stripe no Chrome Vini**.
  Nunca compartilhar segredos no canvas, prompts, relatórios ou com o Relay.
- Nenhum agente toca outro projeto, configuração global de conta, DNS de outro
  site ou volumes/serviços de outra aplicação. Compartilhar referências entre
  projetos apenas quando o usuário pedir, por leitura limitada.
- Uma raiz de workspace e instruções não equivalem a sandbox de segurança.
  Não declarar isolamento técnico total sem restrições verificadas de ferramentas.

## Equipe persistente desejada

| Nó | Responsabilidade | Preferência de ferramenta |
| --- | --- | --- |
| Maestro Editalume (nó histórico Maestro LeiProva) | Priorizar, reservar tarefas sem duplicação, consolidar evidências e autorizar passagem entre etapas | Claude Code, Opus 5 já configurado |
| Forge — Engenharia | Aplicação, banco, pagamentos, testes e correções; branches e arquivos próprios por tarefa | Codex Sol 5.6, se disponível no CLI conectado |
| Prism — Produto e QA | Design premium original, acessibilidade e validação desktop/tablet/mobile | Codex Astra, se disponível no CLI conectado |
| Radar — Editais | Obter editais e retificações de fontes oficiais, com URL, data, versão/hash e organizadora confirmada | Preset local de pesquisa já instalado; sem nova API paga |
| Guardião — Legislação | Vigência, redações, revogações e impactos nas questões; manter trilha de fonte oficial | Codex conectado; confirmar modelo disponível |
| Autor — Inéditas | Questões novas a partir do edital mapeado e do perfil versionado da banca | Codex conectado; confirmar modelo disponível |
| Relay — Apoio Sanitizado | Classificar e resumir apenas recortes públicos aprovados | OpenCode, somente modelo gratuito confirmado |
| Vetor — Prototipação visual | Exploração multimodal e protótipos visuais delimitados; entregar ao Prism para revisão e Forge para integração | Antigravity, `gemini-3.8-flash-high`, inicialização e resposta verificadas |

Primeiro listar agentes, papéis e presets pelo CLI suportado do Maestri. Reusar
papéis/presets compatíveis; não inventar IDs de modelos. Se Gemini Flash solicitado
não estiver disponível no preset, registrar a limitação sem instalar ou comprar.
Não substituir sessões ativas nem reiniciá-las para trocar papéis sem preservar
progresso. Neste workspace novo, criar somente nós ausentes. Na inicialização cada
auxiliar apenas confirma seu papel e fica ocioso: não gerar, editar, publicar ou
consumir APIs automaticamente.

## Fluxo editorial e conexões

Maestro ligado a cada especialista; Radar ligado ao Guardião; Guardião ligado
ao Autor; Autor ligado ao Prism para QA. Relay recebe só tarefas sanitizadas do
Maestro, sem conexão com notas operacionais privadas. Evitar malha completa.

1. Radar entrega dossiê oficial versionado. Não confundir pré-edital com edital
   publicado, nem presumir banca quando não confirmada. Sem burlar bloqueios,
   CAPTCHA, limites, login ou licença. Navegação conforme regra agent-browser.
2. Guardião relaciona requisitos do edital aos artigos e versões aplicáveis,
   registra data de verificação, incertezas e impacto de mudanças. Uma lista
   monitorada não significa cobertura de todas as leis brasileiras.
3. Autor recebe requisito mapeado + fonte aprovada + banca confirmada + perfil
   editorial versionado. Produz rascunhos com enunciado, alternativas, gabarito,
   justificativa de cada opção, dificuldade, norma/artigo/versão e referência.
   Não copia nem parafraseia questões de terceiros. Não promete fidelidade
   estatística à banca sem estudo que a sustente.
4. Prism e Guardião verificam ambiguidade, alternativas, fonte, vigência,
   duplicação e experiência do aluno. IA não se declara revisão humana.
5. Somente após revisão humana efetiva e atribuição editorial, o Maestro pode
   encaminhar importação/publicação dentro de autorização vigente. Aprovação
   de um lote não é aprovação de todos os lotes futuros.
6. Validar matrícula por curso, vínculo questão-edital, pagamento e suporte
   antes de habilitar venda de cada curso. Um produto Stripe não é curso pronto.

Tarefas precisam de ID estável, responsável único, status, tentativas limitadas
e evidência de conclusão. Ao detectar limite de assinatura, parar e registrar;
sem fallback automático para OpenRouter ou outra API paga.

## Estado auditado em 05/09/2026

- Workers existentes: editais a cada 6h após execução; leis a cada 24h.
- Último ciclo auditado de editais: 7 fontes consultadas, 8 candidatos,
  0 novas capturas e 6 falhas. Exigem diagnóstico; não ocultar as falhas.
- Monitor legislativo cobre 10 normas selecionadas e 4 portais, não todas as leis.
- 232 questões gerais revisadas e 12 pendentes; 0 questões vinculadas aos
  concursos. 134 requisitos ainda em rascunho e sem mapeamento a artigos.
- Lote anterior de 160 questões via Maestri foi execução finita, não serviço
  contínuo. A ponte durável entre fila e sessões Maestri ainda precisa de trabalho.
- Geração determinística atual não deve ser divulgada como imitação fiel de FGV,
  FCC, Vunesp ou Cebraspe. Os perfis são critérios editoriais internos.
- Os 75 cursos comerciais não estão todos prontos para entrega/venda.

## Notas do canvas

Criar, se ausentes: PROJECT-CONTEXT, TEAM-CHARTER, EDITORIAL-QUEUE,
QUALITY-GATES e ACCESS-ROUTING. Resumir este documento e apontar para os arquivos
como fonte atual. Não colar credenciais. Não atualizar estado para "concluído"
sem observar o resultado real. Posicionar Maestro no topo, pesquisa/autoria na
faixa central, engenharia/QA na inferior, notas laterais.

Na próxima atualização autorizada dessas notas, PROJECT-CONTEXT e TEAM-CHARTER
devem registrar “Marca atual: Editalume; identificadores técnicos: leiprova;
domínio definitivo ainda não comprado” e apontar para `MARCA-EDITALUME.md`.
Não registrar como concluída uma atualização que ocorreu somente nos documentos.

## Limites desta tarefa de configuração

Não alterar código, Git, banco, VPS, Stripe ou DNS por esta instrução. O Codex
está trabalhando nesses itens separadamente. Não iniciar lotes ou novas rotinas
periódicas durante a montagem. Usar apenas comandos oficiais do Maestri dentro
do terminal que o próprio aplicativo inicializou; não forjar identidade/socket,
editar o JSON vivo do aplicativo ou reiniciar agentes de outros workspaces.
