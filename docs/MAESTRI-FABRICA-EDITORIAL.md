# Fábrica editorial — configuração do time LeiProva

Pedido do Vinícius de 05/09/2026. Este plano configura responsabilidades; não
atesta que o pipeline já está continuamente integrado ou que cursos estão prontos.

## Configuração observada no canvas em 05/09/2026

O workspace exclusivo foi criado pelo CLI do Maestro e preservou `My Workspace`.
Foram observados sete nós: Maestro LeiProva, Forge, Prism, Radar, Guardião, Autor e
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
modelo, atualização de CLI ou geração de novo lote nesta configuração.

## Espaço e memória

- Workspace exclusivo: **LeiProva — Fábrica Editorial**.
- Raiz: `/Users/viniciussaldanharosario/DOCUMENTOS/PROJETOS/leiprova`.
- Preservar integralmente o workspace antigo `My Workspace`.
- Todos leem `AGENTS.md`, `docs/OPERACAO.md` e `docs/ACESSOS-OPERACIONAIS.md`.
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
| Maestro LeiProva | Priorizar, reservar tarefas sem duplicação, consolidar evidências e autorizar passagem entre etapas | Claude Code, Opus 5 já configurado |
| Forge — Engenharia | Aplicação, banco, pagamentos, testes e correções; branches e arquivos próprios por tarefa | Codex Sol 5.6, se disponível no CLI conectado |
| Prism — Produto e QA | Design premium original, acessibilidade e validação desktop/tablet/mobile | Codex Astra, se disponível no CLI conectado |
| Radar — Editais | Obter editais e retificações de fontes oficiais, com URL, data, versão/hash e organizadora confirmada | Preset local de pesquisa já instalado; sem nova API paga |
| Guardião — Legislação | Vigência, redações, revogações e impactos nas questões; manter trilha de fonte oficial | Codex conectado; confirmar modelo disponível |
| Autor — Inéditas | Questões novas a partir do edital mapeado e do perfil versionado da banca | Codex conectado; confirmar modelo disponível |
| Relay — Apoio Sanitizado | Classificar e resumir apenas recortes públicos aprovados | OpenCode, somente modelo gratuito confirmado |

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

## Limites desta tarefa de configuração

Não alterar código, Git, banco, VPS, Stripe ou DNS por esta instrução. O Codex
está trabalhando nesses itens separadamente. Não iniciar lotes ou novas rotinas
periódicas durante a montagem. Usar apenas comandos oficiais do Maestri dentro
do terminal que o próprio aplicativo inicializou; não forjar identidade/socket,
editar o JSON vivo do aplicativo ou reiniciar agentes de outros workspaces.
