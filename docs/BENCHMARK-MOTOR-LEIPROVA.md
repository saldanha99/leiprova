# LeiProva / Editalume — benchmark e evolução do motor
Data: 04/09/2026 · Base auditada: `ec608475e8f9ce3e592ca69d4f82fbfcde00b2ec`
Branch: `codex/benchmark-motor-lei-prova`

## 1. Decisão executiva

O projeto está na direção certa em catálogo, rastreabilidade de fontes e separação editorial. Ainda não há evidência de uma preparação completa que nasça automaticamente de um novo edital e chegue ao aluno com questões realmente calibradas para a banca.

A evolução deve priorizar **qualidade das questões, conexão entre edital e treino e confiabilidade da automação**, preservando a identidade Editalume já aprovada. Mais páginas de concursos ou uma nova camada visual, isoladamente, não fecham essas lacunas.

Objetivo de produto: “Transformar uma oportunidade de concurso em um plano pessoal de leitura, prática e revisão de lei seca, com fontes verificáveis e questões originais adequadas à edição da prova.”

Automatizar descoberta, extração, organização, geração de rascunhos, verificações e distribuição de conteúdo aprovado. Manter revisão humana antes da publicação jurídica, conforme `AGENTS.md`. Aprovação por outra IA é uma verificação adicional, não substitui essa etapa. Não prometer aprovação em concurso nem chamar material sem validação de “mesmo padrão da banca”.

## 2. Escopo e limites da evidência

Foram navegadas páginas públicas do Decorando a Lei Seca: página inicial, assinaturas, assinatura Premium, banco de questões, índice de cursos e exemplos nas oito áreas. Também foram inspecionados o catálogo, o ENAM e a demonstração pública do Editalume; e as páginas oficiais da Enfam e da FGV para o ENAM 2026.2.

Este é um modelo abrangente da **oferta pública e dos fluxos anunciados**, não uma auditoria do produto fechado do concorrente. Não houve compra, login, acesso a administração, cópia de banco de questões, engenharia reversa de algoritmos ou verificação de seus resultados comerciais. Os números de acervo e aprovação divulgados por ele são alegações de marketing, não métricas auditadas aqui.

O código local foi lido estaticamente e a suíte de verificações foi executada. Não houve consulta ao banco de produção, alteração de dados, SSH, deploy ou execução dos importadores editoriais. Inventário de código, catálogo público e inventário real de questões são evidências diferentes. Contagens antigas do README/OPERACAO não representam o banco atual.

O preflight deste trabalho encontrou a main limpa e sincronizada com origin/main; a branch acima foi criada antes da documentação. Apenas documentos serão alterados nesta etapa.

## 3. O que modelar do concorrente

O núcleo observado combina leitura programada, questões ligadas a dispositivos, revisão visual, acompanhamento e empacotamento por objetivo. A oportunidade é integrar melhor esse ciclo à atualização dos editais e à dificuldade real de cada aluno.

| Camada | Evidência pública | Aplicação recomendada no Editalume |
|---|---|---|
| Entrada por objetivo | Carreira, concurso e etapa de preparação | Escolha de área → cargo/especialidade → edição; não apenas banca |
| Catálogo | A página inicial exibia 75 produtos de reta final distribuídos nas oito áreas | Catálogo vivo, com estado e disponibilidade real; quantidade não equivale a preparação pronta |
| Assinaturas | Acesso amplo, por carreira e a recursos específicos; páginas de aquisição distintas | Um modelo único de permissões por recurso, carreira e edição, sem preços divergentes entre telas |
| Preparação extensa | Trilhas de leitura e metas semanais | Base pré-edital com orçamento diário e revisão cumulativa |
| Pós-edital | Cronogramas associados ao programa e prazo da prova | Plano recalculado pela data, disponibilidade e cobertura editorial |
| Questões | A oferta mistura questões anteriores e itens originais, ligados à legislação | Separar claramente literalidade, inéditas autorais e anteriores licenciadas |
| Apoio | Materiais para leitura, mapas, jurisprudência e exportação | Materiais gerados de conteúdo aprovado/versionado; não arquivos avulsos desatualizados |
| Retenção | Histórico, erros, estatísticas e comparação entre participantes | Recuperação ativa, confiança, domínio por dispositivo e revisões úteis; ranking opcional |

Fontes: [página inicial](https://www.decorandoaleiseca.com.br/), [assinaturas](https://www.decorandoaleiseca.com.br/assinaturas), [Premium](https://www.decorandoaleiseca.com.br/assinaturas/membro-premium), [banco de questões](https://www.decorandoaleiseca.com.br/vade-mecum-de-questoes).

Não copiar textos comerciais, questões, identidade ou mapas do concorrente. Usar o benchmark para compreender necessidades e construir solução autoral. A semelhança buscada é de finalidade educacional, não de acervo protegido.

### Cobertura das oito áreas

Amostra qualitativa: um produto público por área, suficiente para identificar diferenças de modelagem, não para validar todos os cursos ou seus editais.

| Área | Exemplo público inspecionado | Requisito para nosso motor |
|---|---|---|
| Carreiras jurídicas | [ENAM](https://www.decorandoaleiseca.com.br/retafinal/exame-nacional-da-magistratura) | Distinguir exame habilitador de concurso para cargo; separar legislação, jurisprudência e demais conhecimentos |
| Cartórios | [ENAC](https://www.decorandoaleiseca.com.br/retafinal/exame-nacional-dos-cartorios) | Normas notariais/registrárias e atos do CNJ, com versão e jurisdição |
| Policiais | [Delegado PC-BA](https://www.decorandoaleiseca.com.br/reta-final/delegado-pc-ba) | Cargo, estado, legislação especial e atribuição de banca confirmada por fonte oficial |
| Tribunais | [TJ-CE](https://www.decorandoaleiseca.com.br/concurso-tj-ce) | Diferenciar técnico, analista e especialidades; legislação local e regimentos quando exigidos |
| Procuradorias | [Manaus](https://www.decorandoaleiseca.com.br/reta-final-procurador-manaus) | Legislação municipal/estadual vinculada ao ente e ao programa |
| Fiscal e controle | [SEFAZ-AL](https://www.decorandoaleiseca.com.br/reta-final-sefaz-al) | Legislação tributária local e federal; não confundir cobertura jurídica com contabilidade ou outras matérias |
| Legislativa | [Câmara dos Deputados](https://www.decorandoaleiseca.com.br/reta-final/camara-dos-deputados-2026) | Cargo, regimento e processo legislativo; cronograma específico por edital |
| Trabalhista | [Juiz do Trabalho](https://www.decorandoaleiseca.com.br/reta-final/juiz-do-trabalho-tst) | Pré-edital explicitamente identificado, direito material/processual e fontes complementares separadas |

Observações de consistência: a home e o [índice de retas finais](https://www.decorandoaleiseca.com.br/reta-final) exibiram recortes temporais diferentes; um link da home para [SEFAZ-SC](https://www.decorandoaleiseca.com.br/reta-final-sefaz-sc) retornou 404. Isso reforça a necessidade de um catálogo central e monitoramento de links, não autoriza concluir que todo o concorrente está desatualizado.

A página da PC-BA no concorrente atribui banca, enquanto o catálogo atual do Editalume informa que ela ainda não está confirmada oficialmente. **Divergência pendente**, não prova de erro de qualquer lado. Resolver por documento oficial, data e edição exata antes de alterar o cadastro.

## 4. Onde o LeiProva está hoje

### Fundação existente

- Oito categorias em `src/lib/opportunities/categories.ts`.
- Catálogo público com seis edições na consulta: PC-BA, PC-MA, PC-PR, PGM Manaus, ENAM e ENAC. É a superfície publicada, não todo o banco.
- Separação de instituição responsável e prestador da prova em vínculos de organizadores; políticas de reconciliação já existem.
- Modelos de fontes oficiais, snapshots de documentos, requisitos, versões legais, vínculos de questões com oportunidades e trilha de auditoria.
- Captura HTML/PDF em origens permitidas, limites de tamanho e redirecionamentos; extração de texto via `unpdf`.
- Fila editorial, checagens de procedência e direitos, rascunhos e revisão.
- Formatos de múltipla escolha e certo/errado; quatro perfis iniciais: VUNESP, FGV, FCC e CEBRASPE.
- Agendamento básico de revisões por acerto e confiança.
- Processos periódicos configurados para fontes e preparação editorial.

O [ENAM publicado no Editalume](https://leiprova.2b.app.br/concursos/carreiras-juridicas/brasil/enam-2026-2) ainda informa preparação editorial e encaminha à demonstração. A [demonstração](https://leiprova.2b.app.br/demo) declara que a revisão humana independente ainda não foi registrada. Não apresentar essa superfície como um curso completo validado.

### Lacunas prioritárias comprováveis no código

| Prioridade | Achado | Evidência na base auditada | Consequência |
|---|---|---|---|
| P0 | Demonstração pública entrega conteúdo estático com revisão humana não registrada | `src/lib/demo-content.ts:8`; `src/app/demo/page.tsx:74`; inspeção pública de /demo | Exceção ao requisito editorial do projeto; aviso de beta não substitui revisão. Regularizar antes de ampliar divulgação |
| P0 | Questões autorais não exigem versão legal vigente na seleção, ao contrário do treino literal | `src/app/api/quiz/session/route.ts:297` | Um item revisado anteriormente pode continuar elegível após a fonte ficar obsoleta; risco confirmado no critério de seleção, sem afirmar ocorrência real no banco |
| P0 | Geração baseada em substituições textuais e comandos fixos, não em raciocínio calibrado por banca | `src/lib/editorial/notice-question-generator.ts:119` | O rótulo de banca não comprova fidelidade de estilo, dificuldade ou qualidade jurídica |
| P0 | Alternativas falsas podem ser obtidas trocando conectivos, modalidades ou adicionando qualificadores; diferença textual não prova falsidade jurídica | Mesmo arquivo, criação de mutações e caminho C/E | É necessário validar semanticamente cada alternativa e sua justificativa; não foi auditada uma questão publicada para afirmar erro concreto |
| P0 | O serviço passa identificador e formato, mas não as orientações completas do perfil | `src/lib/editorial/notice-draft-service.ts:154`; `style-profiles.ts:25` | Os perfis ricos não dirigem efetivamente a construção dos itens |
| P0 | A seleção autoral usa banca/matéria/tópico, sem exigir vínculo ao requisito/oportunidade daquela edição | `src/app/api/quiz/session/route.ts:306`; `notice-draft-service.ts:234` | Selecionar concurso não garante questões dentro daquele programa |
| P0 | A similaridade é checada antes da identidade determinística; o acervo consultado inclui o próprio item de uma rodada anterior | `notice-draft-service.ts:39`, `:169`, `:176` | Reexecução pode tratar a própria questão como duplicação, em vez de resultado já concluído |
| P0 | Geração percorre requisitos por ID desde o início e conta adiamentos no limite de 50 tentativas | `scripts/run-editorial-automation.ts:328` | Se os primeiros itens permanecem adiados/concluídos, os seguintes podem nunca ser alcançados |
| P1 | Fontes de oportunidades são uma lista limitada de nove políticas, não descoberta nacional generalista | `src/lib/opportunities/source-monitor-policy.ts:1` | Não há cobertura demonstrada de todas as bancas e instituições brasileiras |
| P1 | Coleta atual usa fetch/HTML/PDF; não existe nesse percurso um coletor de navegação agent-browser nem OCR comprovado | `src/lib/opportunities/official-document-fetch.ts` | Páginas dinâmicas e documentos escaneados requerem conectores/triagem adicionais |
| P1 | Extração de programa usa regras de títulos e linhas | `src/lib/editorial/official-syllabus-extractor.ts` | Tabelas, anexos e ambiguidades exigem testes de fidelidade e revisão; texto extraído não equivale a currículo estruturado |
| P1 | Loops temporizados continuam após erro, sem fila durável demonstrada | `docker-compose.yml:206`, `:224` | Repetição não equivale a recuperação, progresso garantido ou alerta operacional |
| P1 | Revisão utiliza intervalos fixos de 1, 3, 7, 15, 30, 60 e 90 dias | `src/lib/study/review.ts:1` | Bom início, mas não otimiza carga pelo tempo disponível, prazo da prova e retenção observada |

A geração exige norma marcada como vigente (`notice-draft-service.ts:119`), mas isso não implementa, por si só, o recorte temporal específico de cada edital. A elegibilidade autoral do quiz também precisa verificar a validade da fonte e a edição, além do estado editorial.

Não há integração de LLM no percurso de geração auditado; os conjuntos de continuação/expansão são conteúdo pré-definido. Os agentes disponíveis no Maestri não se tornam automaticamente serviços de IA da aplicação em produção.

### Reconciliação da revisão independente

Claude produziu auditoria estática e Prism revisou seus achados. Esta síntese prevalece sobre as anotações temporárias: **há agendamento em docker-compose**, embora não exista fila durável demonstrada; os lotes estáticos integram testes via coleção agregada; hash determinístico não é defeito por si; nove fontes representam limite de cobertura, não falha automática. Não foi adotada a conclusão de que o sistema depende apenas de execução manual.

Prism também apontou diferenças entre aprovação individual e em lote (`src/app/admin/fabrica-autoral/actions.ts:610` e `:745`) e insuficiência do vínculo para registrar requisito/perfil (`src/lib/db/schema.ts:1549`). Antes de implementação, incluir esses caminhos nos testes comportamentais e adotar um único validador de publicação. A aprovação em lote deve se referir a uma lista imutável de itens/versões efetivamente revisados, nunca a um conjunto de pendentes que possa mudar entre leitura e confirmação.

## 5. Arquitetura-alvo: um fluxo com controles explícitos

```text
Fontes oficiais → oportunidade/edição → edital versionado → programa estruturado
                                                                ↓
Normas oficiais versionadas → dispositivos aplicáveis → questões originais em rascunho
                                                                ↓
                           validação automática + revisão editorial humana
                                                                ↓
                         curso publicado → plano pessoal → prática → revisão
                                                                ↑
              mudança de edital/lei/banca → impacto → revalidação ┘
```

### 5.1 Descoberta de concursos e pré-edital

1. Registro de fontes por instituição, organizadora, diário oficial e jurisdição, com responsável e política de consulta.
2. Navegação e raspagem com `agent-browser`, em sessão isolada por tarefa/fonte. Após cada interação, novo snapshot. URLs descobertas só entram após validação de origem.
3. Capturar evidência mínima: URL original/final, título, horário, hash, tipo do documento, edição presumida e trecho/página de suporte. Downloads oficiais mantêm limites e validação de MIME.
4. Eventos distintos: autorização, comissão, contratação de organizadora, publicação, retificação, suspensão, reabertura e encerramento. Não usar uma notícia ou curso do concorrente como confirmação.
5. Agrupar por órgão + cargo/especialidade + jurisdição + edição. Evitar fundir concursos diferentes da mesma instituição.
6. Usar intervalo por prioridade, cache condicional, limites por domínio, backoff e fila de falhas. Respeitar restrições da origem; CAPTCHA/bloqueio exige triagem, não contorno.
7. Conteúdo coletado é dado não confiável: nenhuma instrução em página/PDF pode acionar comandos, ler segredos ou mudar o projeto.

“Pré-edital” é um produto de preparação baseado em hipótese declarada, não um edital inventado. Registrar quais documentos anteriores sustentam a base, de quando são e o que ainda é desconhecido. Se a banca não estiver confirmada, oferecer núcleo de lei seca e trilhas hipotéticas rotuladas; jamais vender previsão como fato.

Quando o edital real sair, produzir comparação entre base anterior e exigências confirmadas, registrar acréscimos/remoções e recalcular o plano. A mudança de banca precisa de revisão de estilo e formato sem apagar o histórico do aluno.

### 5.2 Edital e currículo verificáveis

Preservar texto e versão originais. Representar cargo, prova/fase, disciplina, tópico, requisito, peso quando oficial, localizador e grau de confiança da extração.

PDF escaneado deve seguir para OCR com validação visual das páginas relevantes. Trechos ilegíveis, tabelas ambíguas ou baixa confiança não podem ser completados silenciosamente pela IA. Revisão humana resolve o item e guarda a decisão.

Mapear cada requisito a zero ou mais dispositivos/normas. Admitir “sem correspondência”, “jurisprudência”, “doutrina” ou “matéria não jurídica”. O painel precisa mostrar:
- proporção do programa classificada;
- proporção da parte de lei seca com fonte válida;
- proporção com treino revisado disponível;
- domínio estimado do aluno.

Esses indicadores têm denominadores diferentes. Não anunciar “100% do edital” quando só a parte normativa foi coberta. Para magistratura, treinar lei seca não substitui toda a preparação exigida.

### 5.3 Fontes legais e impacto de alterações

Documento legal, sua versão, vigência e data de verificação são entidades distintas. Aplicar o recorte previsto no edital, inclusive regras específicas de atualização, sem presumir que o texto mais novo seja sempre o cobrado.

Uma alteração produz análise de impacto: dispositivos → questões → materiais → cursos → planos. Suspender/revalidar os itens afetados; manter o histórico de qual versão o aluno respondeu. Conteúdo local deve guardar ente e território, evitando aplicar lei de um município a outro.

### 5.4 Motor de questões originais por banca

Separar três experiências:
- **Literalidade:** leitura atenta e memorização de texto normativo.
- **Inéditas por perfil:** raciocínio original adequado à edição, com cenários quando pertinentes.
- **Anteriores licenciadas:** somente com direitos e origem registrados; não entram automaticamente no corpus autoral.

Contrato de geração: requisito e localizador do edital + dispositivos e versões oficiais + perfil editorial versionado + formato/correção da edição + objetivo e dificuldade pretendida + restrições de originalidade.

O perfil deve governar extensão, tipo de comando, presença de caso concreto, grau de inferência, alternativas, distratores e rubrica de revisão. Não reduzir uma banca a um adjetivo. CEBRASPE não deve implicar sempre certo/errado: formato e regras vêm da edição.

Saída estruturada: enunciado, opções, gabarito, explicação por opção, dispositivo que sustenta cada justificativa, objetivo, dificuldade pretendida, classificação de conhecimento, proveniência e versão do gerador/perfil/modelo.

Verificações antes da fila humana:
1. Estrutura e formato; opções distintas; número correto de respostas válidas.
2. Coerência normativa, exceções e contexto; um distrator não é falso só porque mudou uma palavra.
3. Ausência de ambiguidade e de alternativa parcialmente verdadeira que invalide o gabarito.
4. Cobertura do requisito, adequação ao nível/cargo e à rubrica da banca.
5. Similaridade interna com exclusão da própria identidade, distinguindo citações legais inevitáveis de cópia de enunciado.
6. Crítica independente com acesso às mesmas fontes; discordância devolve à fila.
7. Revisão humana com autoria da decisão e evidências. Sem aprovação automática/publicação direta.

Dificuldade inicialmente é hipótese editorial; calibrar com dados suficientes de desempenho e qualidade, sem inventar precisão estatística. “Originalidade” não é garantida por uma pontuação de similaridade isolada.

### 5.5 Execução confiável e integração de IA

Maestri coordena o trabalho dos desenvolvedores. O serviço do aluno precisa de workers, persistência e contratos próprios; não pode depender de um terminal aberto no Mac.

Evoluir o processo atual para tarefas duráveis e estados explícitos: pendente, em execução, aguardando revisão, concluída, nova tentativa e falha definitiva. Cada execução tem chave de idempotência, limite de tentativas, cursor/fila justa, prazo, responsável e motivo de falha. Repetir a tarefa não duplica questões, cobrança ou publicação.

Provedor/modelo da geração devem ser configuráveis, com esquema validado, limites por curso/lote, registro de consumo e timeout. O modelo do terminal não comprova disponibilidade na API de produção. Antes de contratar/ativar, validar API, preço, retenção de dados e capacidade; não enviar código, segredos ou dados de alunos a provedores gratuitos sem política aprovada.

## 6. Memorização e experiência premium

Preservar a marca Editalume e seus componentes. Não refazer a identidade apenas para parecer com o concorrente.

Fluxo prioritário no celular:
1. Escolher concurso e tempo disponível.
2. Abrir “O que estudar hoje”, com carga factível e motivo.
3. Ler dispositivo com destaque moderado.
4. Recuperar a informação: lacuna, lembrança ativa ou questão, declarando confiança.
5. Ver correção com a parte exata da lei e entender o erro.
6. Receber próxima revisão e retomar no ponto certo.

Separar estudo novo de revisão vencida. Replanejar faltas e mudanças de prazo; não acumular uma agenda impossível. Misturar assuntos quando apropriado, priorizar fragilidades e permitir revisão focada em erros recorrentes. Medir retenção posterior, não apenas acerto imediato após mostrar a resposta.

Materiais:
- caderno de erros associado a dispositivos e versões;
- mapas/quadros gerados de conteúdo editorial aprovado, com texto verificável;
- exportação com data/versão e aviso de atualização;
- histórico de alterações e transparência de fontes;
- “raio-X” apenas com corpus autorizado, janela, amostra e método explícitos. Frequência de itens gerados não representa incidência histórica de banca.

ImageGen pode apoiar ilustrações autorais e peças visuais. Texto jurídico, fluxogramas normativos e mapas de estudo devem ser estruturados/revisáveis; não depender de letras ou relações inventadas em uma imagem.

Aceitação visual: celular e tablet, retrato/paisagem, teclado virtual, orientação, foco acessível, leitura de tela, contraste, zoom e retomada após interrupção. Emulação responsiva não substitui teste físico em iPhone/Android. As capturas públicas desta etapa não aprovam esses fluxos.

## 7. Plano de entrega e critérios de saída

### P0 — Confiabilidade antes de escala

- Regularizar a demonstração pública: obter revisão editorial registrada ou substituir por demonstração de interface sem conteúdo jurídico não aprovado; não ocultar a ausência de revisão.
- Corrigir a sequência identidade → similaridade e testar reexecução.
- Garantir avanço justo da fila antes de ampliar a periodicidade ou o volume.
- Impedir que seleção autoral ignore a edição/programa escolhido.
- Amarrar elegibilidade da questão à fonte/versão aplicável.
- Revisar geração por mutações; manter apenas o que for apropriado ao treino literal e validado.
- Fazer perfil completo e formato por edição participarem do contrato.
- Criar rubrica editorial e conjunto de avaliação com fontes oficiais.

Saída: testes que reproduzem os riscos acima falham antes das correções e passam depois; itens ambíguos/sem fonte ou fora do programa são bloqueados. Nenhuma promessa de calibração por banca sem avaliação editorial.

### P1 — Piloto ponta a ponta

Piloto recomendado: **ENAM 2026.2 / FGV**, com recorte inicial explícito de uma disciplina e seus dispositivos, em múltipla escolha, depois expansão do conteúdo. Esta escolha considera o exemplo de magistratura trazido pelo usuário e as fontes oficiais verificadas; não pressupõe que cartórios ou outras áreas tenham banca inferível pela categoria.

A [Enfam publicou o aviso da sexta edição](https://www.enfam.jus.br/publicado-o-edital-da-sexta-edicao-do-exame-nacional-da-magistratura/); a [FGV mantém a página oficial com edital e cronograma](https://conhecimento.fgv.br/exames/enam/6exame). Essas fontes sustentam a escolha. O exame habilita para participação em concursos da magistratura; não é, ele mesmo, nomeação para juiz. A página do edital completo ainda deve ser processada e revisada pelo pipeline; consultar a página oficial não equivale a validar todo o programa.

Primeiro, comparar pequenos lotes sobre os mesmos dispositivos em revisão cega: correção, ambiguidade, aderência à rubrica, aproveitamento sem edição e minutos de revisão por questão. Hipótese: o novo motor aumenta qualidade por minuto de revisão. Essa avaliação inicial gera somente rascunhos.

Depois, construir uma fatia verificável: descoberta oficial → snapshot → requisitos → fontes legais → lote autoral → revisão → publicação controlada em homologação → seleção pelo aluno → resposta → revisão agendada. Usar ambiente isolado, dados fictícios e conta de teste; nenhuma escrita em produção. A publicação de material jurídico em qualquer ambiente acessível a alunos depende da revisão exigida.

Saída: demonstração reproduzível, com trilha de fontes e evidência de navegador, de que o aluno recebe somente itens elegíveis para o recorte escolhido e retoma o estudo corretamente.

### P2 — Operação automática e expansão por área

- Fila durável, retomada, cursor justo, observabilidade e orçamento.
- Coletores oficiais dinâmicos, retificações e triagem de OCR.
- Plano pessoal adaptado a carga, prazo e retenção.
- Expandir para ENAC e exemplos representativos das demais áreas conforme fontes e capacidade editorial, não só criar cartões.
- Centralizar catálogo, permissões e disponibilidade real do curso.

Saída: cada área tem pelo menos uma edição com percurso completo validado. Expansão adicional exige cobertura editorial e operação demonstradas.

### Cenários obrigatórios de aceitação

| Cenário | Resultado esperado |
|---|---|
| Mesma fonte e hash consultados novamente | Sem duplicação; execução registrada como inalterada |
| PDF trocado na mesma URL | Novo snapshot, comparação e análise de impacto |
| Banca desconhecida | Produto pré-edital rotulado; nenhuma banca confirmada inventada |
| Mudança de banca/formato | Nova versão do vínculo; revisão dos itens e do plano afetados |
| OCR ilegível | Bloqueio/triagem com página identificada, não preenchimento imaginado |
| Texto diferente mas juridicamente equivalente | Não usar a mera diferença para marcar a alternativa como falsa |
| Reexecução do mesmo requisito | Resultado idempotente, sem autorrejeição por similaridade |
| Primeiros 50 requisitos adiados | A fila permite progresso nos demais; sem bloqueio permanente |
| Questão de outra oportunidade, mesma banca/matéria | Não entra no treino específico sem vínculo curricular elegível |
| Norma alterada ou fora do recorte temporal | Questão suspensa/reavaliada, com histórico preservado |
| Falha de provedor/rede | Retentativa limitada e observável, sem duplicar custo ou dados |
| Aluno sem direito ao curso | Acesso bloqueado no servidor; catálogo não implica acesso |
| Sessões de alunos diferentes | Nenhum vazamento de respostas, plano ou informações pessoais |
| Celular/tablet | Treino, correção, revisão e retomada verificados; teste físico separado |

## 8. Orquestração e isolamento

Projeto ativo exclusivo: `/Users/viniciussaldanharosario/DOCUMENTOS/PROJETOS/leiprova`.

- Maestro/Claude: delimita fase, critérios, dependências e integração; preserva decisões.
- Forge/Codex: implementação em branch de trabalho, testes e evidências do fluxo.
- Prism: arquitetura, revisão independente de correção/risco e UX; não aprova conteúdo jurídico como substituto humano.
- Radar: fontes oficiais, QA de navegador via agent-browser e monitoramento de mudanças dentro de uma tarefa explícita.
- Relay/OpenCode: apenas tarefas realmente sanitizadas; sem código proprietário, SSH, segredos ou dados de alunos.
- Revisor editorial humano: decisão de publicação jurídica.

Antes de cada nova fase: ler PROJECT-CONTEXT/GIT-OPERATIONS, confirmar raiz, branch, alterações locais, upstream e eventual ambiente remoto autorizado. Nunca sobrescrever trabalho local ou reconciliar drift de VPS automaticamente. Não usar nenhuma pasta irmã como referência sem autorização específica. Bypass de permissões não amplia escopo.

Responsabilidade atual de escrita: Codex apenas nesta documentação; Claude e Prism fizeram auditoria estática. A próxima fase exige novo pacote de trabalho com arquivos sob responsabilidade de cada agente para evitar edição concorrente. Nenhum serviço periódico novo foi instalado e nenhuma fase foi declarada implementada por este documento.

## 9. Verificação desta etapa

Executado na base auditada em 04/09/2026:
- `pnpm lint`: passou.
- `pnpm typecheck`: passou.
- `pnpm test`: **48 arquivos / 290 testes passaram**.
- `pnpm build`: passou, Next.js 16.3.1.

Esses resultados comprovam a suíte atual e a compilação, não a qualidade jurídica, a disponibilidade de um acervo completo, a operação em produção nem o fluxo edital → aluno. Alguns testes editoriais inspecionam estrutura/código; é necessário ampliar testes comportamentais e ponta a ponta.

Navegação pública sem login e capturas responsivas foram feitas com agent-browser. Não houve compra, disparo de formulário ou teste autenticado completo. Alguns cliques da demonstração não produziram mudança verificável durante a inspeção: fluxo interativo **pendente de reprodução controlada**, não classificado aqui como defeito confirmado.

Conclusão: **fundação útil; motor ainda parcial para a ambição proposta**. O primeiro marco de valor é um curso-piloto rastreável que funcione de ponta a ponta, não multiplicar automaticamente cursos ainda sem treino pronto.
