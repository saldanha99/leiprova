import type { PilotOriginalQuestion } from "@/lib/editorial/pilot-questions";

export const ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3 = "constitutional-original-pilot-v3";
export const ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4 = "constitutional-original-pilot-v4";

/**
 * Expansão clean-room construída exclusivamente sobre os mesmos dispositivos
 * oficiais revisados do lote inicial. Os perfis de banca são abstratos e
 * orientam formato e nível de raciocínio, nunca o conteúdo de provas alheias.
 */
export const EXPANSION_ORIGINAL_QUESTIONS = [
  {
    publicId: "7cc18dd4-656d-4ee7-8ea2-ced00932354c",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "cebraspe",
    articleRef: "Art. 5º, IV",
    type: "true_false",
    prompt:
      "Julgue o item: o fato de uma manifestação do pensamento tratar de assunto de interesse coletivo não afasta a vedação constitucional ao anonimato.",
    explanation:
      "O item está certo. O art. 5º, IV, assegura a livre manifestação do pensamento e veda o anonimato, sem criar exceção relacionada ao assunto manifestado.",
    learningObjective:
      "Reconhecer que o tema da manifestação não cria exceção à vedação constitucional ao anonimato.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: true, rationale: "A assertiva preserva a liberdade e a vedação expressas no inciso IV." },
      { key: "E", text: "Errado", isCorrect: false, rationale: "O dispositivo não excepciona manifestações de interesse coletivo." },
    ],
  },
  {
    publicId: "4e32f7eb-7ad0-4009-8d65-939a0fd8b339",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "fcc",
    articleRef: "Art. 5º, IV",
    type: "multiple_choice",
    prompt:
      "Considerando a relação estabelecida pelo art. 5º, IV, da Constituição Federal entre manifestação do pensamento e identificação de autoria, é correto afirmar que",
    explanation:
      "O inciso reúne dois comandos simultâneos: torna livre a manifestação do pensamento e veda o anonimato. A liberdade não elimina a possibilidade de identificação do autor.",
    learningObjective:
      "Relacionar corretamente a liberdade de manifestação com a vedação ao anonimato.",
    difficulty: 2,
    options: [
      { key: "A", text: "a manifestação é livre e o anonimato é igualmente assegurado.", isCorrect: false, rationale: "O anonimato é expressamente vedado." },
      { key: "B", text: "a manifestação depende de licença sempre que seu autor for identificado.", isCorrect: false, rationale: "O inciso não exige licença." },
      { key: "C", text: "a manifestação é livre, permanecendo vedado o anonimato.", isCorrect: true, rationale: "A alternativa combina os dois comandos literais do dispositivo." },
      { key: "D", text: "o anonimato é permitido apenas em manifestações sem finalidade econômica.", isCorrect: false, rationale: "Essa distinção não aparece no inciso." },
      { key: "E", text: "a vedação ao anonimato torna ilícita toda manifestação crítica.", isCorrect: false, rationale: "A crítica continua abrangida pela liberdade de manifestação." },
    ],
  },
  {
    publicId: "4809a23b-f6bf-4989-8451-166430993191",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "vunesp",
    articleRef: "Art. 5º, IX",
    type: "multiple_choice",
    prompt:
      "Um centro municipal condicionou à obtenção de licença a divulgação pública de pesquisas científicas produzidas por seus integrantes. À luz apenas do art. 5º, IX, da Constituição Federal, essa exigência é",
    explanation:
      "A expressão da atividade científica é livre independentemente de censura ou licença. A exigência descrita incide justamente sobre uma atividade protegida pelo inciso IX.",
    learningObjective:
      "Aplicar a independência de licença à expressão da atividade científica.",
    difficulty: 3,
    options: [
      { key: "A", text: "compatível, porque a proteção alcança somente atividades artísticas.", isCorrect: false, rationale: "A atividade científica também está expressamente protegida." },
      { key: "B", text: "compatível, desde que a licença não examine o mérito da pesquisa.", isCorrect: false, rationale: "O texto afasta a própria licença, não apenas a censura de mérito." },
      { key: "C", text: "incompatível, porque a expressão científica independe de censura ou licença.", isCorrect: true, rationale: "É a consequência direta do inciso IX." },
      { key: "D", text: "incompatível somente quando a pesquisa também possuir conteúdo artístico.", isCorrect: false, rationale: "As atividades protegidas não são requisitos cumulativos." },
      { key: "E", text: "compatível sempre que o centro responsável for mantido pelo Município.", isCorrect: false, rationale: "O dispositivo não cria essa ressalva institucional." },
    ],
  },
  {
    publicId: "bb132b03-b945-4c2e-84dc-c52c1aeda2cd",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "fgv",
    articleRef: "Art. 5º, IX",
    type: "multiple_choice",
    prompt:
      "Uma autoridade estadual proibiu a circulação de um programa digital que reúne apresentação artística e comunicação científica, alegando ausência de autorização administrativa prévia. Considerando somente o art. 5º, IX, da Constituição Federal, a proibição é",
    explanation:
      "As atividades artística, científica e de comunicação estão expressamente abrangidas pela liberdade do inciso IX, que independe de censura ou licença.",
    learningObjective:
      "Identificar a incidência simultânea da liberdade de expressão sobre diferentes atividades protegidas.",
    difficulty: 4,
    options: [
      { key: "A", text: "válida, porque a reunião de atividades protegidas exige autorização específica.", isCorrect: false, rationale: "A cumulação não cria requisito de autorização." },
      { key: "B", text: "válida apenas quanto à comunicação científica, que depende de licença.", isCorrect: false, rationale: "A atividade científica e a comunicação também independem de licença." },
      { key: "C", text: "inválida somente quanto ao segmento artístico do programa.", isCorrect: false, rationale: "A proteção alcança todos os segmentos descritos." },
      { key: "D", text: "inválida, pois as atividades indicadas são livres independentemente de censura ou licença.", isCorrect: true, rationale: "A alternativa aplica integralmente o comando constitucional." },
      { key: "E", text: "válida se a proibição for administrativa e não judicial.", isCorrect: false, rationale: "O inciso não estabelece essa distinção." },
    ],
  },
  {
    publicId: "5e81fbc5-1f09-41db-88b0-7572a97127db",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "fcc",
    articleRef: "Art. 5º, XXXV",
    type: "multiple_choice",
    prompt:
      "Um projeto de lei admite o controle judicial de lesões já consumadas, mas impede a apreciação de ameaças a direito. Em face do art. 5º, XXXV, da Constituição Federal, o projeto",
    explanation:
      "A inafastabilidade da jurisdição protege tanto a lesão quanto a ameaça a direito. A exclusão da apreciação judicial preventiva contraria o inciso XXXV.",
    learningObjective:
      "Distinguir e reunir as dimensões repressiva e preventiva do acesso ao Poder Judiciário.",
    difficulty: 3,
    options: [
      { key: "A", text: "é compatível, pois apenas a lesão consumada recebe proteção constitucional.", isCorrect: false, rationale: "A ameaça a direito também está expressamente protegida." },
      { key: "B", text: "é incompatível, porque a lei não pode excluir lesão ou ameaça a direito da apreciação judicial.", isCorrect: true, rationale: "A alternativa contém os dois objetos protegidos pelo inciso." },
      { key: "C", text: "é compatível quando a ameaça ainda não produzir dano econômico.", isCorrect: false, rationale: "A fonte não impõe requisito econômico." },
      { key: "D", text: "é incompatível somente se retirar a apreciação do Poder Legislativo.", isCorrect: false, rationale: "O Poder referido é o Judiciário." },
      { key: "E", text: "é compatível se houver recurso administrativo anterior.", isCorrect: false, rationale: "Essa condição não consta do comando analisado." },
    ],
  },
  {
    publicId: "b32241f7-2ff2-42e0-a8a4-dd474b288a0b",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "cebraspe",
    articleRef: "Art. 5º, XXXV",
    type: "true_false",
    prompt:
      "Julgue o item: a decisão administrativa qualificada como definitiva pode impedir que uma ameaça a direito seja submetida à apreciação do Poder Judiciário.",
    explanation:
      "O item está errado. O art. 5º, XXXV, impede a lei de excluir da apreciação do Poder Judiciário lesão ou ameaça a direito.",
    learningObjective:
      "Reconhecer a impossibilidade de afastar a jurisdição diante de ameaça a direito.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A definitividade administrativa não aparece como exceção no inciso." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "A ameaça a direito permanece sujeita à apreciação judicial." },
    ],
  },
  {
    publicId: "c1888bc7-83ab-42d5-a6c5-49a6297ec464",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "fgv",
    articleRef: "Art. 37, caput",
    type: "multiple_choice",
    prompt:
      "Uma autarquia distrital vinculada à estrutura administrativa do Poder Legislativo sustentou não estar sujeita aos princípios enumerados no art. 37, caput, da Constituição Federal. A alegação é",
    explanation:
      "O caput alcança a administração direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios. A autarquia distrital descrita integra esse alcance.",
    learningObjective:
      "Aplicar o alcance institucional e federativo dos princípios da administração pública.",
    difficulty: 4,
    options: [
      { key: "A", text: "correta, porque o dispositivo alcança apenas o Poder Executivo.", isCorrect: false, rationale: "A norma se aplica a qualquer dos Poderes." },
      { key: "B", text: "correta, porque autarquias não integram a administração direta.", isCorrect: false, rationale: "O caput também alcança a administração indireta." },
      { key: "C", text: "incorreta, pois a administração indireta distrital de qualquer Poder deve observar os princípios enumerados.", isCorrect: true, rationale: "A alternativa combina corretamente natureza, ente e Poder." },
      { key: "D", text: "incorreta apenas quanto aos princípios da publicidade e eficiência.", isCorrect: false, rationale: "Todos os princípios enumerados incidem." },
      { key: "E", text: "correta se a autarquia exercer atividade predominantemente técnica.", isCorrect: false, rationale: "A atividade técnica não cria exceção no caput." },
    ],
  },
  {
    publicId: "1afdb8b2-882c-4872-a16d-8f71e1a4798d",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "vunesp",
    articleRef: "Art. 37, caput",
    type: "multiple_choice",
    prompt:
      "Assinale a alternativa que identifica corretamente o alcance do art. 37, caput, da Constituição Federal.",
    explanation:
      "O dispositivo alcança administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios.",
    learningObjective:
      "Reconhecer os Poderes, entes e segmentos administrativos submetidos ao caput do art. 37.",
    difficulty: 2,
    options: [
      { key: "A", text: "Somente a administração direta do Poder Executivo federal.", isCorrect: false, rationale: "A alternativa restringe segmentos, Poderes e entes." },
      { key: "B", text: "A administração direta e indireta de qualquer Poder de todos os entes indicados no dispositivo.", isCorrect: true, rationale: "A formulação preserva integralmente o alcance do caput." },
      { key: "C", text: "Somente a administração indireta da União e dos Estados.", isCorrect: false, rationale: "A administração direta, o Distrito Federal e os Municípios também estão abrangidos." },
      { key: "D", text: "Apenas os órgãos administrativos dos Poderes Executivo e Judiciário.", isCorrect: false, rationale: "A expressão constitucional é qualquer dos Poderes." },
      { key: "E", text: "Exclusivamente as entidades que prestam serviço público econômico.", isCorrect: false, rationale: "O caput não contém essa limitação material." },
    ],
  },
  {
    publicId: "848ea37b-3a84-4198-8a8a-e15dfe34f18a",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "cebraspe",
    articleRef: "Art. 37, II",
    type: "true_false",
    prompt:
      "Julgue o item: por mencionar cargo e emprego público, o art. 37, II, permite que o emprego público seja preenchido antes da aprovação do candidato em concurso.",
    explanation:
      "O item está errado. A investidura em cargo ou emprego público depende de aprovação prévia em concurso público, ressalvada a hipótese constitucional relativa ao cargo em comissão.",
    learningObjective:
      "Aplicar a exigência de aprovação prévia tanto ao cargo quanto ao emprego público.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "O qualificativo prévia alcança cargo e emprego público." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "O emprego público também depende de aprovação anterior à investidura." },
    ],
  },
  {
    publicId: "5a50c4a5-cca0-4918-b757-9c4c1dbddc12",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "fcc",
    articleRef: "Art. 37, II",
    type: "multiple_choice",
    prompt:
      "A regra e a ressalva previstas no art. 37, II, da Constituição Federal estão corretamente combinadas em:",
    explanation:
      "A regra exige aprovação prévia em concurso de provas ou de provas e títulos para cargo ou emprego público. A ressalva alcança nomeação para cargo em comissão declarado em lei de livre nomeação e exoneração.",
    learningObjective:
      "Sistematizar o objeto, a modalidade do concurso e a ressalva relativa ao cargo em comissão.",
    difficulty: 4,
    options: [
      { key: "A", text: "Concurso exclusivamente de títulos para cargo efetivo; ressalva para qualquer função temporária.", isCorrect: false, rationale: "A modalidade e a ressalva não correspondem ao inciso." },
      { key: "B", text: "Aprovação posterior em concurso para emprego público; ressalva criada por regulamento.", isCorrect: false, rationale: "A aprovação é prévia e o cargo em comissão deve ser declarado em lei." },
      { key: "C", text: "Aprovação prévia em concurso de provas ou de provas e títulos para cargo ou emprego; ressalva para cargo em comissão declarado em lei de livre nomeação e exoneração.", isCorrect: true, rationale: "A alternativa preserva todos os elementos do inciso II." },
      { key: "D", text: "Concurso apenas para cargos federais; ressalva para cargos efetivos estaduais.", isCorrect: false, rationale: "Essas limitações não constam da fonte." },
      { key: "E", text: "Aprovação prévia somente para emprego público; ressalva para todo cargo criado por lei.", isCorrect: false, rationale: "A regra também alcança cargos e a ressalva é específica." },
    ],
  },
  {
    publicId: "9be7bf80-0e3d-4845-9a31-70f0196e474f",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "vunesp",
    articleRef: "Art. 37, III",
    type: "multiple_choice",
    prompt:
      "Um edital fixou a validade do concurso em oito meses e admitiu uma única prorrogação por mais oito meses. Segundo o art. 37, III, da Constituição Federal, a previsão é",
    explanation:
      "O prazo inicial é inferior ao limite de dois anos, e a única prorrogação repete o período inicial. Os dois requisitos do inciso III estão atendidos.",
    learningObjective:
      "Reconhecer que o prazo de dois anos é máximo e que a prorrogação única deve ter igual período.",
    difficulty: 3,
    options: [
      { key: "A", text: "válida, pois o prazo inicial respeita o máximo e a prorrogação única tem igual período.", isCorrect: true, rationale: "A previsão atende aos três elementos temporais do inciso." },
      { key: "B", text: "inválida, porque o prazo inicial deve ser obrigatoriamente de dois anos.", isCorrect: false, rationale: "Dois anos é limite máximo, não prazo mínimo ou fixo." },
      { key: "C", text: "inválida, porque concurso com validade inferior a um ano não admite prorrogação.", isCorrect: false, rationale: "Essa limitação não consta do dispositivo." },
      { key: "D", text: "válida somente se forem permitidas duas prorrogações de quatro meses.", isCorrect: false, rationale: "A Constituição admite uma prorrogação por igual período." },
      { key: "E", text: "inválida, pois toda prorrogação deve durar exatamente dois anos.", isCorrect: false, rationale: "A prorrogação deve repetir o prazo inicial." },
    ],
  },
  {
    publicId: "f83ebdb0-9a2b-4654-83f2-1cf8058e3725",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "fgv",
    articleRef: "Art. 37, III",
    type: "multiple_choice",
    prompt:
      "O edital de determinado certame prevê validade inicial de nove meses e uma prorrogação, se necessária, por outros nove meses. Um candidato sustenta que a cláusula é inconstitucional porque o prazo inicial não alcança dois anos. À luz apenas do art. 37, III, a alegação é",
    explanation:
      "A alegação é incorreta. O dispositivo estabelece validade de até dois anos e permite uma prorrogação por igual período; nove meses mais uma única prorrogação de nove meses respeita a norma.",
    learningObjective:
      "Aplicar o caráter máximo, e não obrigatório, do prazo constitucional de dois anos.",
    difficulty: 3,
    options: [
      { key: "A", text: "correta, porque todo concurso deve vigorar inicialmente por dois anos.", isCorrect: false, rationale: "A expressão até indica limite máximo." },
      { key: "B", text: "correta, porque a prorrogação somente pode ocorrer quando o prazo inicial superar um ano.", isCorrect: false, rationale: "Essa condição não existe no inciso." },
      { key: "C", text: "incorreta, pois o prazo inicial está dentro do máximo e a prorrogação única repete o mesmo período.", isCorrect: true, rationale: "A cláusula respeita limite, frequência e igualdade temporal." },
      { key: "D", text: "incorreta apenas porque seriam admitidas prorrogações ilimitadas.", isCorrect: false, rationale: "O edital descrito prevê uma única prorrogação." },
      { key: "E", text: "correta, porque a soma dos dois períodos deve resultar exatamente em quatro anos.", isCorrect: false, rationale: "A Constituição não exige duração total fixa." },
    ],
  },
  {
    publicId: "3b009d10-c0bf-48da-89bd-ffae871deea0",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "fcc",
    articleRef: "Art. 41, caput",
    type: "multiple_choice",
    prompt:
      "O art. 41, caput, da Constituição Federal vincula a estabilidade nele prevista ao servidor que, entre outros requisitos, tenha sido",
    explanation:
      "O caput refere-se ao servidor nomeado para cargo de provimento efetivo em virtude de concurso público, após três anos de efetivo exercício.",
    learningObjective:
      "Distinguir cargo de provimento efetivo de emprego público e cargo em comissão para fins do art. 41.",
    difficulty: 3,
    options: [
      { key: "A", text: "contratado para emprego público por processo seletivo simplificado.", isCorrect: false, rationale: "A fonte menciona nomeação para cargo efetivo e concurso público." },
      { key: "B", text: "nomeado para cargo de provimento efetivo em virtude de concurso público.", isCorrect: true, rationale: "Esse é o vínculo expressamente previsto no caput." },
      { key: "C", text: "designado para função de confiança por escolha da autoridade.", isCorrect: false, rationale: "Função de confiança não corresponde ao requisito indicado." },
      { key: "D", text: "nomeado para cargo em comissão, ainda que sem concurso.", isCorrect: false, rationale: "O dispositivo exige cargo efetivo e concurso." },
      { key: "E", text: "admitido temporariamente para atender necessidade excepcional.", isCorrect: false, rationale: "A contratação temporária não integra a hipótese do caput." },
    ],
  },
  {
    publicId: "a6c3f405-0214-4d20-a6d5-60b7e9244671",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "cebraspe",
    articleRef: "Art. 41, caput",
    type: "true_false",
    prompt:
      "Julgue o item: o exercício de cargo em comissão durante três anos é suficiente para a aquisição da estabilidade prevista no art. 41, caput, ainda que a nomeação não decorra de concurso público.",
    explanation:
      "O item está errado. A estabilidade do caput pressupõe nomeação para cargo de provimento efetivo em virtude de concurso público e três anos de efetivo exercício.",
    learningObjective:
      "Reconhecer a natureza do cargo e a forma de ingresso exigidas para a estabilidade constitucional.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "Tempo de exercício isolado não substitui cargo efetivo e concurso." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "A assertiva elimina dois requisitos expressos do caput." },
    ],
  },
  {
    publicId: "de22ecea-c384-4798-95e1-54eaddbabbc2",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "fgv",
    articleRef: "Art. 41, § 1º, III",
    type: "multiple_choice",
    prompt:
      "Uma lei complementar instituiu avaliação periódica de desempenho e assegurou ampla defesa ao servidor estável submetido ao procedimento. De acordo apenas com o art. 41, § 1º, III, eventual perda do cargo com fundamento nesse procedimento é",
    explanation:
      "A hipótese corresponde ao inciso III: procedimento de avaliação periódica de desempenho, na forma de lei complementar, com ampla defesa assegurada.",
    learningObjective:
      "Aplicar cumulativamente os requisitos da perda do cargo por avaliação periódica de desempenho.",
    difficulty: 4,
    options: [
      { key: "A", text: "incompatível, porque avaliação de desempenho nunca pode fundamentar perda do cargo.", isCorrect: false, rationale: "A hipótese está expressamente prevista no inciso III." },
      { key: "B", text: "compatível, desde que observados o procedimento periódico, a lei complementar e a ampla defesa.", isCorrect: true, rationale: "A alternativa reúne todos os requisitos da fonte." },
      { key: "C", text: "compatível mesmo que a ampla defesa seja afastada pela lei complementar.", isCorrect: false, rationale: "A ampla defesa é requisito expresso." },
      { key: "D", text: "incompatível, porque a disciplina deveria constar de decreto autônomo.", isCorrect: false, rationale: "A espécie normativa exigida é lei complementar." },
      { key: "E", text: "compatível somente se a avaliação deixar de ser periódica.", isCorrect: false, rationale: "A periodicidade integra a hipótese constitucional." },
    ],
  },
  {
    publicId: "a68d3679-4f4b-4e57-98e5-997d83e260fa",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "vunesp",
    articleRef: "Art. 41, § 1º, III",
    type: "multiple_choice",
    prompt:
      "A perda do cargo de servidor estável por avaliação periódica de desempenho foi disciplinada em lei ordinária, com ampla defesa assegurada. Conforme o art. 41, § 1º, III, a disciplina é",
    explanation:
      "Apesar da ampla defesa, o inciso III exige lei complementar para disciplinar o procedimento de avaliação periódica de desempenho.",
    learningObjective:
      "Identificar a espécie normativa indispensável à avaliação periódica de desempenho.",
    difficulty: 3,
    options: [
      { key: "A", text: "adequada, porque a ampla defesa dispensa lei complementar.", isCorrect: false, rationale: "Os requisitos são cumulativos." },
      { key: "B", text: "adequada, porque toda avaliação administrativa é regulada por lei ordinária.", isCorrect: false, rationale: "O inciso exige expressamente lei complementar." },
      { key: "C", text: "inadequada, porque o procedimento deve ser previsto na forma de lei complementar.", isCorrect: true, rationale: "A espécie normativa adotada diverge da fonte." },
      { key: "D", text: "inadequada somente porque a ampla defesa deveria ser excluída.", isCorrect: false, rationale: "A ampla defesa deve ser assegurada." },
      { key: "E", text: "adequada se a avaliação ocorrer uma única vez.", isCorrect: false, rationale: "A norma trata de avaliação periódica e mantém a exigência de lei complementar." },
    ],
  },
  {
    publicId: "2709f932-7d73-4731-8d6c-bcce46721948",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "cebraspe",
    articleRef: "Art. 84, II",
    type: "true_false",
    prompt:
      "Julgue o item: o Presidente da República exerce, com o auxílio dos Ministros de Estado, a direção superior da administração federal.",
    explanation:
      "O item está certo e reproduz os elementos centrais do art. 84, II: titular, auxílio ministerial e âmbito federal.",
    learningObjective:
      "Reconhecer a estrutura constitucional da direção superior da administração federal.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: true, rationale: "A assertiva corresponde ao inciso II." },
      { key: "E", text: "Errado", isCorrect: false, rationale: "Titular, auxiliares e âmbito estão corretos." },
    ],
  },
  {
    publicId: "e9185a05-02e6-4efb-ba92-cb401376603f",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "fcc",
    articleRef: "Art. 84, II",
    type: "multiple_choice",
    prompt:
      "Na atribuição descrita pelo art. 84, II, da Constituição Federal, estão corretamente identificados titular, auxiliares e âmbito em:",
    explanation:
      "O Presidente da República exerce, com o auxílio dos Ministros de Estado, a direção superior da administração federal.",
    learningObjective:
      "Associar corretamente os elementos subjetivos e materiais da atribuição presidencial.",
    difficulty: 2,
    options: [
      { key: "A", text: "Congresso Nacional; governadores; administração estadual.", isCorrect: false, rationale: "Nenhum dos três elementos corresponde ao inciso." },
      { key: "B", text: "Presidente da República; Ministros de Estado; administração federal.", isCorrect: true, rationale: "A alternativa preserva titular, auxílio e âmbito." },
      { key: "C", text: "Supremo Tribunal Federal; secretários estaduais; administração municipal.", isCorrect: false, rationale: "Os elementos divergem integralmente da fonte." },
      { key: "D", text: "Ministros de Estado; Congresso Nacional; administração indireta estadual.", isCorrect: false, rationale: "A direção é presidencial e federal." },
      { key: "E", text: "Presidente da República; tribunais superiores; administração distrital.", isCorrect: false, rationale: "O auxílio e o âmbito indicados estão incorretos." },
    ],
  },
  {
    publicId: "4d5b6173-3187-42d8-ab0b-40c24c9cef24",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "vunesp",
    articleRef: "Art. 84, IV",
    type: "multiple_choice",
    prompt:
      "Após a publicação de uma lei, qual providência presidencial está expressamente ligada à sua fiel execução pelo art. 84, IV, da Constituição Federal?",
    explanation:
      "O inciso IV atribui ao Presidente da República a expedição de decretos e regulamentos para a fiel execução das leis.",
    learningObjective:
      "Identificar os atos presidenciais destinados à fiel execução da lei.",
    difficulty: 2,
    options: [
      { key: "A", text: "Expedir decretos e regulamentos.", isCorrect: true, rationale: "São os atos expressamente associados à fiel execução." },
      { key: "B", text: "Editar sentenças e acórdãos.", isCorrect: false, rationale: "Esses não são atos presidenciais previstos no inciso." },
      { key: "C", text: "Aprovar emendas constitucionais sem participação legislativa.", isCorrect: false, rationale: "A providência não integra o dispositivo." },
      { key: "D", text: "Substituir a lei por resolução administrativa.", isCorrect: false, rationale: "O inciso trata de execução fiel, não substituição." },
      { key: "E", text: "Suspender a vigência da lei até autorização judicial.", isCorrect: false, rationale: "Essa condição não consta da fonte." },
    ],
  },
  {
    publicId: "8908ac10-9c7d-4eec-b363-c850133bd46c",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "fgv",
    articleRef: "Art. 84, IV",
    type: "multiple_choice",
    prompt:
      "O Presidente da República expediu regulamento com a finalidade declarada de afastar a aplicação de uma lei que considerava inconveniente. Considerando somente o art. 84, IV, da Constituição Federal, essa finalidade é",
    explanation:
      "O inciso relaciona decretos e regulamentos à fiel execução das leis. Um ato destinado a afastar a lei, em vez de executá-la fielmente, não corresponde à finalidade constitucional indicada.",
    learningObjective:
      "Distinguir regulamentação para fiel execução de ato destinado a afastar a lei.",
    difficulty: 4,
    options: [
      { key: "A", text: "compatível, porque todo regulamento pode substituir a lei regulamentada.", isCorrect: false, rationale: "A fonte prevê fiel execução, não substituição." },
      { key: "B", text: "compatível quando o Presidente considerar a lei inconveniente.", isCorrect: false, rationale: "O inciso não cria essa autorização." },
      { key: "C", text: "incompatível, pois decretos e regulamentos previstos no inciso destinam-se à fiel execução da lei.", isCorrect: true, rationale: "A finalidade declarada é oposta à prevista no art. 84, IV." },
      { key: "D", text: "incompatível somente se o regulamento também fizer publicar a lei.", isCorrect: false, rationale: "A publicação não corrige a finalidade contrária à execução fiel." },
      { key: "E", text: "compatível se o regulamento for expedido depois da promulgação.", isCorrect: false, rationale: "O momento não autoriza afastar a aplicação da lei." },
    ],
  },
  {
    publicId: "a7c6a08b-e491-4231-ba6d-c496671a291c",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "fcc",
    articleRef: "Art. 144, caput",
    type: "multiple_choice",
    prompt:
      "A formulação constitucional da segurança pública no art. 144, caput, reúne corretamente natureza e finalidade em:",
    explanation:
      "A segurança pública é dever do Estado, direito e responsabilidade de todos, e é exercida para preservar a ordem pública e a incolumidade das pessoas e do patrimônio.",
    learningObjective:
      "Sistematizar as qualificações e finalidades constitucionais da segurança pública.",
    difficulty: 3,
    options: [
      { key: "A", text: "dever exclusivo dos cidadãos, exercido apenas para proteger o patrimônio público.", isCorrect: false, rationale: "Sujeito, direito e finalidade foram indevidamente restringidos." },
      { key: "B", text: "dever do Estado, direito e responsabilidade de todos, voltado à ordem pública e à incolumidade de pessoas e patrimônio.", isCorrect: true, rationale: "A alternativa reúne os elementos centrais do caput." },
      { key: "C", text: "direito exclusivo do Estado, sem responsabilidade social.", isCorrect: false, rationale: "O direito e a responsabilidade são de todos." },
      { key: "D", text: "responsabilidade municipal, limitada à preservação da ordem administrativa.", isCorrect: false, rationale: "O caput não contém essas limitações." },
      { key: "E", text: "dever compartilhado que exclui a proteção das pessoas.", isCorrect: false, rationale: "A incolumidade das pessoas está expressamente abrangida." },
    ],
  },
  {
    publicId: "d2ca9342-8800-41f9-b71d-55b410533a17",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "cebraspe",
    articleRef: "Art. 144, caput",
    type: "true_false",
    prompt:
      "Julgue o item: por ser direito e responsabilidade de todos, a segurança pública deixa de constituir dever do Estado.",
    explanation:
      "O item está errado. As qualificações são cumulativas: segurança pública é dever do Estado e também direito e responsabilidade de todos.",
    learningObjective:
      "Evitar a falsa oposição entre o dever estatal e a responsabilidade de todos.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A responsabilidade coletiva não elimina o dever estatal." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "O caput reúne simultaneamente as três qualificações." },
    ],
  },
  {
    publicId: "945ba6fa-ed3a-4f09-9d86-a6f7ee4ac2f0",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
    bankSlug: "fgv",
    articleRef: "Art. 144, § 5º",
    type: "multiple_choice",
    prompt:
      "Um Estado atribuiu às polícias militares somente a proteção patrimonial e retirou dos corpos de bombeiros militares todas as atribuições legais que não fossem de defesa civil. À luz apenas do art. 144, § 5º, a medida é",
    explanation:
      "O § 5º reserva às polícias militares a polícia ostensiva e a preservação da ordem pública. Aos corpos de bombeiros militares incumbem a defesa civil e as demais atribuições definidas em lei.",
    learningObjective:
      "Aplicar conjuntamente as atribuições constitucionais dos dois órgãos militares estaduais.",
    difficulty: 4,
    options: [
      { key: "A", text: "compatível, porque a proteção patrimonial substitui a preservação da ordem pública.", isCorrect: false, rationale: "A substituição não corresponde ao texto constitucional." },
      { key: "B", text: "compatível apenas quanto à exclusão das demais atribuições legais dos bombeiros.", isCorrect: false, rationale: "O dispositivo preserva essas atribuições." },
      { key: "C", text: "incompatível nos dois pontos, pois altera as funções das polícias militares e elimina atribuições legais dos bombeiros.", isCorrect: true, rationale: "A alternativa identifica os dois desvios." },
      { key: "D", text: "incompatível somente porque a defesa civil cabe às polícias militares.", isCorrect: false, rationale: "A defesa civil é incumbência dos corpos de bombeiros militares." },
      { key: "E", text: "compatível se as mudanças forem feitas por decreto estadual.", isCorrect: false, rationale: "A forma do ato não afasta os comandos do § 5º." },
    ],
  },
  {
    publicId: "2e528c01-db7b-4531-824d-56d75803b895",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
    bankSlug: "vunesp",
    articleRef: "Art. 144, § 5º",
    type: "multiple_choice",
    prompt:
      "Segundo o art. 144, § 5º, da Constituição Federal, assinale a alternativa correta sobre polícias e corpos de bombeiros militares.",
    explanation:
      "O dispositivo atribui às polícias militares a polícia ostensiva e a preservação da ordem pública e, aos corpos de bombeiros militares, além das atribuições legais, a defesa civil.",
    learningObjective:
      "Associar cada órgão militar estadual às atribuições previstas no § 5º.",
    difficulty: 2,
    options: [
      { key: "A", text: "Às polícias militares cabe a polícia judiciária, e aos bombeiros cabe exclusivamente a defesa civil.", isCorrect: false, rationale: "As duas atribuições foram descritas incorretamente." },
      { key: "B", text: "Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos bombeiros, a defesa civil e as atribuições definidas em lei.", isCorrect: true, rationale: "A alternativa corresponde aos dois núcleos do dispositivo." },
      { key: "C", text: "Às polícias militares cabe somente a defesa civil, e aos bombeiros cabe a preservação da ordem pública.", isCorrect: false, rationale: "As funções foram invertidas." },
      { key: "D", text: "A ambos os órgãos cabe exclusivamente a polícia ostensiva.", isCorrect: false, rationale: "O texto diferencia as atribuições." },
      { key: "E", text: "As atribuições de ambos dependem integralmente de regulamento federal.", isCorrect: false, rationale: "O § 5º traz atribuições expressas e menciona lei para outras funções dos bombeiros." },
    ],
  },
] as const satisfies readonly PilotOriginalQuestion[];
