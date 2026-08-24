import type { PilotOriginalQuestion } from "@/lib/editorial/pilot-questions";

export const ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5 = "constitutional-original-pilot-v5";
export const ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6 = "constitutional-original-pilot-v6";

/**
 * Terceira leva clean-room. Cada item parte apenas do dispositivo oficial já
 * revisado e de um perfil editorial abstrato; nenhum enunciado de prova de
 * terceiros foi consultado, armazenado ou transformado durante a autoria.
 */
export const CONTINUATION_ORIGINAL_QUESTIONS = [
  {
    publicId: "279ce9fa-156e-4765-81c3-7c7361aa4ce5",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "fgv",
    articleRef: "Art. 5º, IV",
    type: "multiple_choice",
    prompt:
      "Uma pessoa pretende distribuir críticas sobre a gestão pública sem fornecer qualquer elemento que permita identificar sua autoria. Considerando exclusivamente o art. 5º, IV, da Constituição Federal, essa pretensão",
    explanation:
      "A livre manifestação do pensamento é assegurada, mas o anonimato é vedado. A natureza crítica ou política do conteúdo não elimina a vedação expressa.",
    learningObjective:
      "Aplicar simultaneamente a liberdade de manifestação e a exigência constitucional de autoria identificável.",
    difficulty: 3,
    options: [
      { key: "A", text: "é integralmente protegida, pois críticas à gestão sempre podem ser anônimas.", isCorrect: false, rationale: "O dispositivo não cria exceção para críticas políticas." },
      { key: "B", text: "não pode ser manifestada, porque críticas à gestão são constitucionalmente proibidas.", isCorrect: false, rationale: "A manifestação do pensamento é livre." },
      { key: "C", text: "é protegida quanto à manifestação, mas não quanto à ocultação absoluta da autoria.", isCorrect: true, rationale: "A alternativa concilia os dois comandos do inciso IV." },
      { key: "D", text: "depende de censura prévia, ainda que o autor se identifique.", isCorrect: false, rationale: "A fonte não estabelece censura prévia." },
      { key: "E", text: "é válida somente quando divulgada por órgão estatal.", isCorrect: false, rationale: "Essa condição institucional não consta do inciso." },
    ],
  },
  {
    publicId: "a70972cf-7d9b-437a-968a-57b6d22af068",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "vunesp",
    articleRef: "Art. 5º, IV",
    type: "multiple_choice",
    prompt:
      "Assinale a alternativa que apresenta corretamente os dois comandos reunidos no art. 5º, IV, da Constituição Federal.",
    explanation:
      "O dispositivo assegura que é livre a manifestação do pensamento e, ao mesmo tempo, estabelece ser vedado o anonimato.",
    learningObjective:
      "Identificar sem inversões os comandos centrais do inciso IV.",
    difficulty: 2,
    options: [
      { key: "A", text: "Manifestação condicionada e anonimato obrigatório.", isCorrect: false, rationale: "Ambos os elementos contrariam a fonte." },
      { key: "B", text: "Manifestação livre e anonimato vedado.", isCorrect: true, rationale: "É a combinação expressamente prevista." },
      { key: "C", text: "Manifestação proibida e anonimato permitido.", isCorrect: false, rationale: "A alternativa inverte os dois comandos." },
      { key: "D", text: "Manifestação licenciada e anonimato facultativo.", isCorrect: false, rationale: "Licença e faculdade de anonimato não estão previstas." },
      { key: "E", text: "Manifestação restrita a autores anônimos.", isCorrect: false, rationale: "A Constituição veda o anonimato." },
    ],
  },
  {
    publicId: "171ff0ef-fceb-4621-be77-d268b604ead3",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "cebraspe",
    articleRef: "Art. 5º, IX",
    type: "true_false",
    prompt:
      "Julgue o item: a utilização de recursos públicos na produção de uma pesquisa torna constitucionalmente obrigatória a licença prévia para a expressão de seus resultados científicos.",
    explanation:
      "O item está errado. O art. 5º, IX, declara livre a expressão da atividade científica independentemente de censura ou licença, sem estabelecer a origem dos recursos como exceção.",
    learningObjective:
      "Reconhecer que a origem do financiamento não altera a independência de licença prevista no inciso IX.",
    difficulty: 4,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A assertiva cria condição inexistente na fonte." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "A expressão científica independe de licença." },
    ],
  },
  {
    publicId: "034e026a-2359-47d1-89c5-5eabfd9649da",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "fcc",
    articleRef: "Art. 5º, IX",
    type: "multiple_choice",
    prompt:
      "O art. 5º, IX, da Constituição Federal caracteriza a expressão das atividades nele enumeradas como livre",
    explanation:
      "O inciso inclui as atividades intelectual, artística, científica e de comunicação e afirma que sua expressão independe de censura ou licença.",
    learningObjective:
      "Reconhecer o conjunto de atividades protegidas e a dupla independência prevista no inciso IX.",
    difficulty: 3,
    options: [
      { key: "A", text: "apenas depois de licença, embora independente de censura.", isCorrect: false, rationale: "O dispositivo afasta também a licença." },
      { key: "B", text: "somente para as atividades intelectual e artística.", isCorrect: false, rationale: "Atividades científica e de comunicação também são incluídas." },
      { key: "C", text: "independentemente de censura ou licença, abrangendo atividade intelectual, artística, científica e de comunicação.", isCorrect: true, rationale: "A alternativa preserva objetos e condições da norma." },
      { key: "D", text: "desde que submetida à censura administrativa posterior.", isCorrect: false, rationale: "A censura é afastada pelo inciso." },
      { key: "E", text: "exclusivamente quando não envolver comunicação.", isCorrect: false, rationale: "A comunicação aparece expressamente entre as atividades protegidas." },
    ],
  },
  {
    publicId: "a82b9ecb-70e6-41ff-8d26-80e97573613f",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "vunesp",
    articleRef: "Art. 5º, XXXV",
    type: "multiple_choice",
    prompt:
      "Uma lei determina que o titular de um direito somente pode procurar o Poder Judiciário depois que a ameaça se transformar em lesão efetiva. Essa regra, diante do art. 5º, XXXV, é",
    explanation:
      "O inciso XXXV protege a apreciação judicial tanto da lesão quanto da ameaça a direito. Exigir a consumação da lesão elimina a dimensão preventiva da garantia.",
    learningObjective:
      "Aplicar a proteção judicial preventiva diante de ameaça a direito.",
    difficulty: 3,
    options: [
      { key: "A", text: "compatível, porque ameaças não estão abrangidas pela garantia.", isCorrect: false, rationale: "A ameaça a direito é mencionada expressamente." },
      { key: "B", text: "incompatível, porque a ameaça também pode ser apreciada pelo Poder Judiciário.", isCorrect: true, rationale: "A regra excluiria objeto protegido pelo inciso." },
      { key: "C", text: "compatível se a ameaça não envolver direito patrimonial.", isCorrect: false, rationale: "A fonte não restringe a natureza do direito." },
      { key: "D", text: "incompatível apenas quando a lesão já tiver sido reparada.", isCorrect: false, rationale: "O problema está na exclusão da ameaça." },
      { key: "E", text: "compatível sempre que for editada por lei federal.", isCorrect: false, rationale: "A forma federal não supera o comando constitucional." },
    ],
  },
  {
    publicId: "1d7cecbb-4ff6-45f5-a785-cfe31b49d2cb",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "fgv",
    articleRef: "Art. 5º, XXXV",
    type: "multiple_choice",
    prompt:
      "Uma agência pública recebeu por lei competência para decidir definitivamente certas controvérsias, ficando proibida qualquer apreciação judicial de lesão ou ameaça a direito discutida perante ela. Considerando apenas o art. 5º, XXXV, a proibição é",
    explanation:
      "A lei não pode excluir lesão ou ameaça a direito da apreciação do Poder Judiciário. A atribuição administrativa descrita não elimina a garantia constitucional.",
    learningObjective:
      "Distinguir competência decisória administrativa de exclusão constitucionalmente vedada da jurisdição.",
    difficulty: 4,
    options: [
      { key: "A", text: "válida, porque toda decisão administrativa definitiva é imune ao controle judicial.", isCorrect: false, rationale: "Essa imunidade contraria o inciso XXXV." },
      { key: "B", text: "válida somente em relação às ameaças, mas não às lesões.", isCorrect: false, rationale: "Ambas estão protegidas." },
      { key: "C", text: "inválida, pois a lei não pode afastar do Judiciário lesão ou ameaça a direito.", isCorrect: true, rationale: "A alternativa aplica diretamente a inafastabilidade." },
      { key: "D", text: "inválida apenas se a agência integrar o Poder Executivo federal.", isCorrect: false, rationale: "O dispositivo não cria essa limitação orgânica." },
      { key: "E", text: "válida quando a agência oferecer recurso interno.", isCorrect: false, rationale: "O recurso interno não autoriza excluir a apreciação judicial." },
    ],
  },
  {
    publicId: "9fea0a1a-6b05-4d69-abd6-a9100e1aba0b",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "fcc",
    articleRef: "Art. 37, caput",
    type: "multiple_choice",
    prompt:
      "Além de legalidade, impessoalidade, moralidade e publicidade, o art. 37, caput, da Constituição Federal determina expressamente a observância do princípio da",
    explanation:
      "O quinto princípio enumerado no caput é a eficiência, aplicável no mesmo alcance institucional dos demais.",
    learningObjective:
      "Completar corretamente o conjunto expresso de princípios da administração pública.",
    difficulty: 2,
    options: [
      { key: "A", text: "eficiência.", isCorrect: true, rationale: "Eficiência integra a enumeração constitucional." },
      { key: "B", text: "subsidiariedade.", isCorrect: false, rationale: "O termo não integra a lista do caput." },
      { key: "C", text: "autonomia absoluta.", isCorrect: false, rationale: "A expressão não aparece na enumeração." },
      { key: "D", text: "livre iniciativa administrativa.", isCorrect: false, rationale: "Não é o quinto princípio expresso do dispositivo." },
      { key: "E", text: "supremacia legislativa.", isCorrect: false, rationale: "A alternativa não corresponde ao texto selecionado." },
    ],
  },
  {
    publicId: "8cc8550f-7b39-43ab-b0e7-5b2d13f79df5",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "cebraspe",
    articleRef: "Art. 37, caput",
    type: "true_false",
    prompt:
      "Julgue o item: entidades da administração indireta vinculadas ao Poder Legislativo municipal não estão submetidas aos princípios enumerados no art. 37, caput.",
    explanation:
      "O item está errado. O caput alcança a administração direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios.",
    learningObjective:
      "Reconhecer a incidência dos princípios sobre a administração indireta municipal de qualquer Poder.",
    difficulty: 4,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A assertiva cria exclusão contrária ao alcance do caput." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "Administração indireta, Legislativo e Município estão abrangidos." },
    ],
  },
  {
    publicId: "192715c2-6cb1-43c3-b620-5892bc8e393b",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "fgv",
    articleRef: "Art. 37, II",
    type: "multiple_choice",
    prompt:
      "Um órgão abriu seleção exclusivamente de títulos para investir candidatos em cargos efetivos, alegando que a complexidade das funções dispensava provas. À luz apenas do art. 37, II, a solução é",
    explanation:
      "O concurso previsto no inciso II deve ser de provas ou de provas e títulos. A modalidade exclusivamente de títulos não corresponde às formas expressas.",
    learningObjective:
      "Distinguir as modalidades constitucionais de concurso de uma seleção exclusivamente de títulos.",
    difficulty: 4,
    options: [
      { key: "A", text: "compatível, porque a complexidade permite qualquer modalidade seletiva.", isCorrect: false, rationale: "A complexidade não elimina as modalidades previstas." },
      { key: "B", text: "compatível quando os títulos possuírem natureza acadêmica.", isCorrect: false, rationale: "A fonte não cria essa exceção." },
      { key: "C", text: "incompatível, porque a investidura exige concurso de provas ou de provas e títulos.", isCorrect: true, rationale: "Seleção só de títulos fica fora das duas modalidades." },
      { key: "D", text: "incompatível somente para empregos públicos, não para cargos.", isCorrect: false, rationale: "O inciso alcança ambos." },
      { key: "E", text: "compatível se a aprovação ocorrer depois da investidura.", isCorrect: false, rationale: "A aprovação deve ser prévia." },
    ],
  },
  {
    publicId: "327cbd8b-76b6-44f0-b396-479945dae23e",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "vunesp",
    articleRef: "Art. 37, II",
    type: "multiple_choice",
    prompt:
      "A nomeação sem concurso prevista como ressalva no art. 37, II, da Constituição Federal refere-se ao",
    explanation:
      "A ressalva alcança cargo em comissão declarado em lei de livre nomeação e exoneração.",
    learningObjective:
      "Identificar com precisão a hipótese constitucional ressalvada da regra do concurso.",
    difficulty: 2,
    options: [
      { key: "A", text: "cargo efetivo criado por regulamento.", isCorrect: false, rationale: "Cargo efetivo permanece sujeito à regra." },
      { key: "B", text: "emprego público de livre exoneração por contrato.", isCorrect: false, rationale: "A ressalva não é formulada para emprego público." },
      { key: "C", text: "cargo em comissão declarado em lei de livre nomeação e exoneração.", isCorrect: true, rationale: "É a hipótese expressamente ressalvada." },
      { key: "D", text: "cargo temporário escolhido pela autoridade judiciária.", isCorrect: false, rationale: "Essa formulação não consta do inciso." },
      { key: "E", text: "cargo efetivo cuja complexidade seja reduzida.", isCorrect: false, rationale: "A complexidade não transforma cargo efetivo em exceção." },
    ],
  },
  {
    publicId: "1fb46307-9b54-4fd8-a996-1a733cba1333",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "cebraspe",
    articleRef: "Art. 37, III",
    type: "true_false",
    prompt:
      "Julgue o item: é compatível com o art. 37, III, edital que fixe prazo inicial de validade do concurso público em três anos.",
    explanation:
      "O item está errado. O prazo de validade do concurso público será de até dois anos, embora possa ser prorrogado uma vez por igual período.",
    learningObjective:
      "Aplicar o limite máximo do prazo inicial de validade do concurso.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "Três anos excedem o máximo constitucional do prazo inicial." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "O limite inicial é de até dois anos." },
    ],
  },
  {
    publicId: "9481a280-81d2-45dd-9727-7f5a04c573c6",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "fcc",
    articleRef: "Art. 37, III",
    type: "multiple_choice",
    prompt:
      "Um concurso tem validade inicial de seis meses. A prorrogação constitucionalmente compatível com o art. 37, III, poderá ocorrer",
    explanation:
      "O inciso permite uma única prorrogação por igual período. Para validade inicial de seis meses, a prorrogação pode ocorrer uma vez por seis meses.",
    learningObjective:
      "Calcular a frequência e a duração admissíveis da prorrogação do concurso.",
    difficulty: 3,
    options: [
      { key: "A", text: "duas vezes, por três meses cada.", isCorrect: false, rationale: "A prorrogação somente pode ocorrer uma vez." },
      { key: "B", text: "uma vez, por seis meses.", isCorrect: true, rationale: "Frequência e período correspondem ao inciso." },
      { key: "C", text: "uma vez, obrigatoriamente por dois anos.", isCorrect: false, rationale: "O período deve ser igual ao inicial." },
      { key: "D", text: "três vezes, até completar dois anos.", isCorrect: false, rationale: "A quantidade de prorrogações é incompatível." },
      { key: "E", text: "uma vez, por qualquer período inferior a dois anos.", isCorrect: false, rationale: "A igualdade com o prazo inicial é exigida." },
    ],
  },
  {
    publicId: "684f5da2-dbba-4f17-aa13-f31b66b9e1e2",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "vunesp",
    articleRef: "Art. 41, caput",
    type: "multiple_choice",
    prompt:
      "Um servidor foi nomeado para cargo efetivo após concurso, mas completou três anos desde a nomeação sem alcançar três anos de efetivo exercício. Conforme o art. 41, caput, ele",
    explanation:
      "A estabilidade exige três anos de efetivo exercício. O simples transcurso de três anos desde a nomeação não substitui esse requisito.",
    learningObjective:
      "Distinguir tempo desde a nomeação de tempo de efetivo exercício.",
    difficulty: 3,
    options: [
      { key: "A", text: "já é estável, porque basta o tempo transcorrido desde a nomeação.", isCorrect: false, rationale: "A fonte exige efetivo exercício." },
      { key: "B", text: "ainda não preenche o requisito temporal de efetivo exercício.", isCorrect: true, rationale: "O marco constitucional é o exercício efetivo." },
      { key: "C", text: "é estável mesmo que o cargo deixe de ser efetivo.", isCorrect: false, rationale: "A natureza efetiva do cargo também é requisito." },
      { key: "D", text: "somente será estável após quatro anos desde o concurso.", isCorrect: false, rationale: "A Constituição indica três anos de efetivo exercício." },
      { key: "E", text: "não poderá adquirir estabilidade porque ingressou por concurso.", isCorrect: false, rationale: "O concurso é um dos requisitos, não impedimento." },
    ],
  },
  {
    publicId: "f147dc71-ef81-4163-b0a0-f70d5c29ff24",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "fgv",
    articleRef: "Art. 41, caput",
    type: "multiple_choice",
    prompt:
      "Ana ingressou por concurso público, foi nomeada para cargo de provimento efetivo e completou três anos de efetivo exercício. Considerando exclusivamente o art. 41, caput, Ana",
    explanation:
      "A situação reúne os elementos previstos no caput: três anos de efetivo exercício, cargo de provimento efetivo e nomeação em virtude de concurso público.",
    learningObjective:
      "Verificar cumulativamente os requisitos constitucionais da estabilidade.",
    difficulty: 2,
    options: [
      { key: "A", text: "não adquire estabilidade porque o prazo exigido é de cinco anos.", isCorrect: false, rationale: "O prazo constitucional é de três anos." },
      { key: "B", text: "adquire a estabilidade prevista no dispositivo.", isCorrect: true, rationale: "Todos os requisitos expressos foram preenchidos." },
      { key: "C", text: "não adquire estabilidade porque o concurso impede sua aquisição.", isCorrect: false, rationale: "O ingresso por concurso integra a hipótese." },
      { key: "D", text: "adquire estabilidade mesmo que o cargo seja convertido em comissão desde a origem.", isCorrect: false, rationale: "A fonte exige cargo de provimento efetivo." },
      { key: "E", text: "somente adquire estabilidade se deixar o efetivo exercício.", isCorrect: false, rationale: "A alternativa inverte o requisito temporal." },
    ],
  },
  {
    publicId: "f31270dd-f0d5-48c0-a44b-9c91deb7e545",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "fcc",
    articleRef: "Art. 41, § 1º, III",
    type: "multiple_choice",
    prompt:
      "Procedimento de avaliação periódica de desempenho para perda do cargo de servidor estável foi criado por decreto e restringiu a defesa do avaliado. À luz do art. 41, § 1º, III, há incompatibilidade quanto",
    explanation:
      "O inciso exige disciplina na forma de lei complementar e ampla defesa. O decreto e a defesa restrita contrariam requisitos cumulativos.",
    learningObjective:
      "Identificar simultaneamente os requisitos normativo e defensivo do procedimento periódico.",
    difficulty: 4,
    options: [
      { key: "A", text: "apenas à periodicidade, que deveria ser afastada.", isCorrect: false, rationale: "A periodicidade integra a hipótese constitucional." },
      { key: "B", text: "somente ao uso do decreto, pois defesa restrita é suficiente.", isCorrect: false, rationale: "A ampla defesa também é exigida." },
      { key: "C", text: "ao decreto e à restrição defensiva, pois se exigem lei complementar e ampla defesa.", isCorrect: true, rationale: "A alternativa identifica os dois vícios." },
      { key: "D", text: "somente à ampla defesa, porque decreto é a espécie adequada.", isCorrect: false, rationale: "A disciplina deve observar lei complementar." },
      { key: "E", text: "a nenhum ponto, porque a administração escolhe livremente forma e defesa.", isCorrect: false, rationale: "Ambos os requisitos estão expressos." },
    ],
  },
  {
    publicId: "8689b589-f89b-4bb7-9160-44bafc0a20ab",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "cebraspe",
    articleRef: "Art. 41, § 1º, III",
    type: "true_false",
    prompt:
      "Julgue o item: o servidor estável pode perder o cargo mediante avaliação periódica de desempenho disciplinada em lei complementar, desde que lhe seja assegurada ampla defesa.",
    explanation:
      "O item está certo. A assertiva reúne o procedimento periódico, a espécie normativa e a garantia defensiva previstas no inciso III.",
    learningObjective:
      "Reconhecer a hipótese completa de perda do cargo por avaliação periódica.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: true, rationale: "Os requisitos da assertiva correspondem ao dispositivo." },
      { key: "E", text: "Errado", isCorrect: false, rationale: "Não há alteração de procedimento, lei ou garantia defensiva." },
    ],
  },
  {
    publicId: "069e0e31-1f2f-45bb-8f17-28b3bb423447",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "fgv",
    articleRef: "Art. 84, II",
    type: "multiple_choice",
    prompt:
      "O Presidente da República decidiu transferir integralmente aos Ministros de Estado a direção superior da administração federal, deixando de exercê-la. Com base apenas no art. 84, II, essa decisão é",
    explanation:
      "O dispositivo atribui ao Presidente o exercício da direção superior, com o auxílio dos Ministros. Auxílio ministerial não equivale à retirada do titular da atribuição.",
    learningObjective:
      "Diferenciar auxílio ministerial de substituição integral do titular da direção superior.",
    difficulty: 4,
    options: [
      { key: "A", text: "compatível, pois os Ministros são os titulares exclusivos da direção superior.", isCorrect: false, rationale: "A titularidade indicada é presidencial." },
      { key: "B", text: "compatível, porque auxílio significa transferência integral da atribuição.", isCorrect: false, rationale: "A interpretação elimina o exercício presidencial expresso." },
      { key: "C", text: "incompatível, pois o Presidente deve exercer a direção superior com auxílio dos Ministros.", isCorrect: true, rationale: "A alternativa preserva titular e forma de auxílio." },
      { key: "D", text: "incompatível somente porque a administração deveria ser estadual.", isCorrect: false, rationale: "O âmbito correto é federal." },
      { key: "E", text: "compatível se o Poder Judiciário autorizar previamente.", isCorrect: false, rationale: "Essa condição não integra o inciso." },
    ],
  },
  {
    publicId: "b90264cb-119c-43f9-bda5-0ffbd3ebe1e8",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "vunesp",
    articleRef: "Art. 84, II",
    type: "multiple_choice",
    prompt:
      "De acordo com o art. 84, II, da Constituição Federal, os Ministros de Estado participam da direção superior da administração federal na condição de",
    explanation:
      "A direção superior é exercida pelo Presidente da República com o auxílio dos Ministros de Estado.",
    learningObjective:
      "Identificar o papel dos Ministros na atribuição presidencial do inciso II.",
    difficulty: 2,
    options: [
      { key: "A", text: "titulares exclusivos que substituem o Presidente.", isCorrect: false, rationale: "A direção é exercida pelo Presidente." },
      { key: "B", text: "auxiliares do Presidente da República.", isCorrect: true, rationale: "É a relação prevista no dispositivo." },
      { key: "C", text: "representantes do Poder Judiciário.", isCorrect: false, rationale: "Essa posição não consta da fonte." },
      { key: "D", text: "dirigentes da administração municipal.", isCorrect: false, rationale: "O âmbito é federal." },
      { key: "E", text: "órgãos de autorização legislativa prévia.", isCorrect: false, rationale: "O inciso não estabelece essa função." },
    ],
  },
  {
    publicId: "b58ca1fc-af57-4766-be64-37d968ccceb6",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "cebraspe",
    articleRef: "Art. 84, IV",
    type: "true_false",
    prompt:
      "Julgue o item: os decretos e regulamentos expedidos pelo Presidente da República com fundamento no art. 84, IV, destinam-se a substituir as leis consideradas inadequadas.",
    explanation:
      "O item está errado. O inciso prevê decretos e regulamentos para a fiel execução das leis, não para substituí-las.",
    learningObjective:
      "Distinguir execução regulamentar de substituição da lei.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "Substituição é finalidade estranha ao inciso." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "Os atos destinam-se à fiel execução." },
    ],
  },
  {
    publicId: "7f4e2691-0768-4ec2-bbce-2f1b575f052d",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "fcc",
    articleRef: "Art. 84, IV",
    type: "multiple_choice",
    prompt:
      "A finalidade expressamente atribuída aos decretos e regulamentos presidenciais pelo art. 84, IV, da Constituição Federal é",
    explanation:
      "O inciso IV vincula a expedição desses atos à fiel execução das leis.",
    learningObjective:
      "Reconhecer a finalidade constitucional expressa dos atos regulamentares presidenciais.",
    difficulty: 2,
    options: [
      { key: "A", text: "revogar leis sem participação legislativa.", isCorrect: false, rationale: "A fonte não prevê revogação por regulamento." },
      { key: "B", text: "permitir a fiel execução das leis.", isCorrect: true, rationale: "É a finalidade expressa do inciso." },
      { key: "C", text: "suspender automaticamente decisões judiciais.", isCorrect: false, rationale: "Essa finalidade não consta da atribuição." },
      { key: "D", text: "criar emendas à Constituição.", isCorrect: false, rationale: "Decretos e regulamentos não são vinculados a essa função." },
      { key: "E", text: "substituir a promulgação das leis.", isCorrect: false, rationale: "A promulgação não é substituída pelos atos de execução." },
    ],
  },
  {
    publicId: "8e63e7e9-7d77-4d7d-b298-19634421580d",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "vunesp",
    articleRef: "Art. 144, caput",
    type: "multiple_choice",
    prompt:
      "Uma política pública definiu que a segurança pública seria exercida apenas para preservar a ordem pública, excluindo a proteção das pessoas e do patrimônio. Diante do art. 144, caput, essa definição é",
    explanation:
      "O caput inclui a preservação da ordem pública e da incolumidade das pessoas e do patrimônio. A política descrita omite duas finalidades expressas.",
    learningObjective:
      "Identificar cumulativamente as finalidades constitucionais da segurança pública.",
    difficulty: 3,
    options: [
      { key: "A", text: "correta, porque a ordem pública esgota a finalidade constitucional.", isCorrect: false, rationale: "Pessoas e patrimônio também são protegidos." },
      { key: "B", text: "incorreta, pois também devem ser abrangidas a incolumidade das pessoas e do patrimônio.", isCorrect: true, rationale: "A alternativa recompõe as finalidades omitidas." },
      { key: "C", text: "correta se a política for estadual.", isCorrect: false, rationale: "O ente não autoriza reduzir o texto constitucional." },
      { key: "D", text: "incorreta somente por não mencionar a administração federal.", isCorrect: false, rationale: "O vício está nas finalidades excluídas." },
      { key: "E", text: "correta quando houver participação comunitária.", isCorrect: false, rationale: "A participação não elimina as finalidades constitucionais." },
    ],
  },
  {
    publicId: "198ffeec-4fb3-4b29-9203-09dd51b1f2b0",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "fgv",
    articleRef: "Art. 144, caput",
    type: "multiple_choice",
    prompt:
      "Moradores organizaram ações comunitárias de prevenção e, por isso, uma autoridade declarou encerrado o dever estatal de promover segurança pública. À luz apenas do art. 144, caput, a declaração é",
    explanation:
      "A segurança pública é simultaneamente dever do Estado e direito e responsabilidade de todos. A atuação comunitária não elimina o dever estatal.",
    learningObjective:
      "Aplicar a coexistência entre dever estatal e responsabilidade coletiva.",
    difficulty: 3,
    options: [
      { key: "A", text: "correta, porque a responsabilidade de todos substitui o dever estatal.", isCorrect: false, rationale: "As qualificações são cumulativas." },
      { key: "B", text: "incorreta, pois a responsabilidade comunitária não afasta o dever do Estado.", isCorrect: true, rationale: "A alternativa preserva ambos os polos do caput." },
      { key: "C", text: "correta se as ações comunitárias protegerem patrimônio.", isCorrect: false, rationale: "A finalidade protegida não extingue o dever estatal." },
      { key: "D", text: "incorreta somente porque segurança pública é responsabilidade exclusiva do Estado.", isCorrect: false, rationale: "A responsabilidade também é de todos." },
      { key: "E", text: "correta quando houver autorização municipal.", isCorrect: false, rationale: "Essa autorização não altera a Constituição." },
    ],
  },
  {
    publicId: "94a18b20-8f99-49b6-9a12-5d3a3b4673e3",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
    bankSlug: "fcc",
    articleRef: "Art. 144, § 5º",
    type: "multiple_choice",
    prompt:
      "A associação correta entre órgão e atribuição no art. 144, § 5º, da Constituição Federal é:",
    explanation:
      "Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública. Aos corpos de bombeiros militares incumbe a defesa civil, além das atribuições definidas em lei.",
    learningObjective:
      "Relacionar corretamente os órgãos militares estaduais às atribuições do § 5º.",
    difficulty: 3,
    options: [
      { key: "A", text: "Polícia militar — polícia judiciária; bombeiros — defesa nacional exclusiva.", isCorrect: false, rationale: "As duas associações divergem da fonte." },
      { key: "B", text: "Polícia militar — polícia ostensiva e preservação da ordem pública; bombeiros — defesa civil e atribuições legais.", isCorrect: true, rationale: "A alternativa preserva os dois núcleos do dispositivo." },
      { key: "C", text: "Polícia militar — defesa civil; bombeiros — polícia ostensiva.", isCorrect: false, rationale: "As atribuições foram invertidas." },
      { key: "D", text: "Polícia militar — apenas proteção patrimonial; bombeiros — apenas combate a incêndios.", isCorrect: false, rationale: "As restrições não correspondem ao § 5º." },
      { key: "E", text: "Ambos — polícia judiciária e investigação criminal exclusiva.", isCorrect: false, rationale: "Essas funções não são as descritas no dispositivo." },
    ],
  },
  {
    publicId: "f42270fc-cafa-4952-9e22-f32404f11d2f",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
    bankSlug: "cebraspe",
    articleRef: "Art. 144, § 5º",
    type: "true_false",
    prompt:
      "Julgue o item: o art. 144, § 5º, limita os corpos de bombeiros militares exclusivamente à execução de atividades de defesa civil, afastando qualquer atribuição definida em lei.",
    explanation:
      "O item está errado. O dispositivo preserva as atribuições definidas em lei e, além delas, incumbe aos corpos de bombeiros militares a defesa civil.",
    learningObjective:
      "Reconhecer que a defesa civil não exclui outras atribuições legais dos bombeiros militares.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A exclusividade elimina parcela expressamente preservada." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "O texto mantém atribuições legais além da defesa civil." },
    ],
  },
] as const satisfies readonly PilotOriginalQuestion[];
