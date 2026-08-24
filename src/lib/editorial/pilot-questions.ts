import type { QuizBankSlug } from "@/lib/quiz/catalog";

export const ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1 = "constitutional-original-pilot-v1";
export const ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2 = "constitutional-original-pilot-v2";
export const ORIGINAL_STYLE_PILOT_GENERATOR = "OpenAI Codex";

type PilotQuestionOption = {
  readonly key: string;
  readonly text: string;
  readonly isCorrect: boolean;
  readonly rationale: string;
};

export type PilotOriginalQuestion = {
  readonly publicId: string;
  readonly promptVersion: string;
  readonly bankSlug: QuizBankSlug;
  readonly articleRef: string;
  readonly type: "multiple_choice" | "true_false";
  readonly prompt: string;
  readonly explanation: string;
  readonly learningObjective: string;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly options: readonly PilotQuestionOption[];
};

/**
 * Lote inicial inteiramente autoral, criado somente a partir dos artigos oficiais
 * já revisados na biblioteca. O seed registra estes itens como rascunhos de IA:
 * nenhum deles é publicado ou atribuído a uma pessoa antes da assunção editorial.
 */
export const PILOT_ORIGINAL_QUESTIONS = [
  {
    publicId: "fed46abe-967f-46c8-8a3f-3e7ce4bbbd09",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "vunesp",
    articleRef: "Art. 5º, IV",
    type: "multiple_choice",
    prompt:
      "Bruno pretende publicar uma crítica política em um canal aberto de participação social, mas exige que sua identidade permaneça desconhecida. Considerando exclusivamente o art. 5º, IV, da Constituição Federal, assinale a conclusão correta.",
    explanation:
      "O art. 5º, IV, assegura a livre manifestação do pensamento e, simultaneamente, veda o anonimato. Portanto, a proteção à manifestação não inclui o direito de ocultar a autoria.",
    learningObjective:
      "Distinguir a liberdade de manifestação do pensamento da vedação constitucional ao anonimato.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "A crítica depende de autorização prévia da autoridade responsável pelo canal.",
        isCorrect: false,
        rationale: "O dispositivo não condiciona a manifestação a autorização prévia.",
      },
      {
        key: "B",
        text: "A manifestação é livre, mas a Constituição veda que ela seja anônima.",
        isCorrect: true,
        rationale: "A alternativa reúne os dois comandos expressos no inciso IV.",
      },
      {
        key: "C",
        text: "O anonimato é permitido quando a manifestação tratar de tema político.",
        isCorrect: false,
        rationale: "O inciso IV não cria essa exceção temática.",
      },
      {
        key: "D",
        text: "A manifestação somente é livre quando não houver crítica a agente público.",
        isCorrect: false,
        rationale: "Essa limitação não consta do dispositivo usado como fonte.",
      },
      {
        key: "E",
        text: "A Constituição protege o anonimato, mas permite censura posterior da crítica.",
        isCorrect: false,
        rationale: "A assertiva inverte a vedação expressa ao anonimato.",
      },
    ],
  },
  {
    publicId: "853cbb02-eff7-4c77-b928-863f30c2f941",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "fgv",
    articleRef: "Art. 5º, IX",
    type: "multiple_choice",
    prompt:
      "Uma lei municipal passou a exigir licença prévia para que autores divulguem, em meios digitais, obras artísticas produzidas no território local. À luz apenas do art. 5º, IX, da Constituição Federal, a medida é",
    explanation:
      "O art. 5º, IX, declara livre a expressão das atividades intelectual, artística, científica e de comunicação, independentemente de censura ou licença. A licença descrita incide sobre a própria divulgação artística e contraria esse comando.",
    learningObjective:
      "Aplicar a independência de censura ou licença à expressão intelectual, artística, científica e comunicacional.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "compatível, porque a liberdade constitucional alcança apenas atividade científica.",
        isCorrect: false,
        rationale: "O inciso também protege expressamente a atividade artística.",
      },
      {
        key: "B",
        text: "compatível, desde que a licença não seja acompanhada de censura do conteúdo.",
        isCorrect: false,
        rationale: "A norma afasta tanto a censura quanto a licença.",
      },
      {
        key: "C",
        text: "compatível, porque o meio digital não está abrangido pela atividade de comunicação.",
        isCorrect: false,
        rationale: "O dispositivo não exclui a comunicação realizada por meio digital.",
      },
      {
        key: "D",
        text: "incompatível, porque a expressão artística é livre independentemente de censura ou licença.",
        isCorrect: true,
        rationale: "É a consequência direta do comando constitucional selecionado.",
      },
      {
        key: "E",
        text: "incompatível somente se a obra também tiver finalidade científica.",
        isCorrect: false,
        rationale: "As atividades protegidas são alternativas, não requisitos cumulativos.",
      },
    ],
  },
  {
    publicId: "442bf4a3-577e-4aad-817a-127fb21a401a",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "fcc",
    articleRef: "Art. 5º, XXXV",
    type: "multiple_choice",
    prompt:
      "Ao registrar o alcance do princípio da inafastabilidade da jurisdição, uma equipe deve adotar a formulação que corresponde ao art. 5º, XXXV, da Constituição Federal. Essa formulação estabelece que",
    explanation:
      "O inciso XXXV impede a lei de excluir da apreciação do Poder Judiciário tanto uma lesão já ocorrida quanto uma ameaça a direito.",
    learningObjective:
      "Reconhecer o alcance objetivo e institucional da garantia de acesso ao Poder Judiciário.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito.",
        isCorrect: true,
        rationale: "A alternativa preserva o Poder competente e as duas situações protegidas.",
      },
      {
        key: "B",
        text: "a lei não excluirá da apreciação do Poder Judiciário apenas a lesão consumada a direito.",
        isCorrect: false,
        rationale: "A ameaça a direito também está expressamente abrangida.",
      },
      {
        key: "C",
        text: "a administração não excluirá da apreciação do Poder Legislativo lesão ou ameaça a direito.",
        isCorrect: false,
        rationale: "O dispositivo se refere à lei e ao Poder Judiciário.",
      },
      {
        key: "D",
        text: "a lei poderá excluir ameaça a direito quando ainda não houver lesão comprovada.",
        isCorrect: false,
        rationale: "A ameaça é protegida de modo expresso, sem essa condição.",
      },
      {
        key: "E",
        text: "o Poder Judiciário não apreciará lesão que possa ser resolvida administrativamente.",
        isCorrect: false,
        rationale: "Essa limitação não integra o inciso usado como fonte.",
      },
    ],
  },
  {
    publicId: "199fca09-87a6-404f-9f08-10086dfd0ace",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "cebraspe",
    articleRef: "Art. 37, caput",
    type: "true_false",
    prompt:
      "Julgue o item: a observância dos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência limita-se à administração direta do Poder Executivo da União.",
    explanation:
      "O item está errado. O art. 37, caput, alcança a administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios.",
    learningObjective:
      "Identificar o alcance subjetivo e federativo dos princípios constitucionais da administração pública.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A assertiva restringe indevidamente o alcance do caput." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "O caput inclui administração direta e indireta de todos os Poderes e entes indicados." },
    ],
  },
  {
    publicId: "c8440197-2fc7-43ff-a3f8-9f58bec408e6",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "vunesp",
    articleRef: "Art. 37, II",
    type: "multiple_choice",
    prompt:
      "Um município pretende preencher um cargo efetivo sem concurso e, ao mesmo tempo, nomear livremente pessoa para cargo em comissão assim declarado em lei. Segundo o art. 37, II, da Constituição Federal, é correto afirmar que",
    explanation:
      "A investidura em cargo ou emprego público depende de aprovação prévia em concurso de provas ou de provas e títulos, ressalvadas as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração.",
    learningObjective:
      "Diferenciar a regra do concurso público da ressalva constitucional relativa aos cargos em comissão.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "ambas as nomeações independem de concurso, desde que haja previsão em decreto municipal.",
        isCorrect: false,
        rationale: "A regra constitucional exige concurso para o cargo efetivo e menciona declaração em lei para o cargo em comissão.",
      },
      {
        key: "B",
        text: "ambas as nomeações exigem concurso público exclusivamente de provas.",
        isCorrect: false,
        rationale: "A ressalva alcança o cargo em comissão e o concurso pode ser de provas ou de provas e títulos.",
      },
      {
        key: "C",
        text: "o cargo efetivo exige aprovação prévia em concurso, enquanto o cargo em comissão descrito está abrangido pela ressalva constitucional.",
        isCorrect: true,
        rationale: "A alternativa aplica corretamente a regra e a ressalva do inciso II.",
      },
      {
        key: "D",
        text: "o cargo efetivo admite concurso posterior à investidura, e o cargo em comissão exige concurso prévio.",
        isCorrect: false,
        rationale: "A aprovação deve ser prévia e a ressalva opera no sentido oposto.",
      },
      {
        key: "E",
        text: "o cargo efetivo exige concurso apenas quando sua complexidade for elevada.",
        isCorrect: false,
        rationale: "Natureza e complexidade orientam o concurso, mas não eliminam a exigência.",
      },
    ],
  },
  {
    publicId: "49817eae-a9a2-4b1a-aea3-c6ed16f573e3",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "fgv",
    articleRef: "Art. 37, III",
    type: "multiple_choice",
    prompt:
      "O edital de um concurso fixou prazo de validade de dezoito meses e previu uma única prorrogação por doze meses. Considerando apenas o art. 37, III, da Constituição Federal, a previsão é",
    explanation:
      "O prazo inicial de dezoito meses está dentro do máximo constitucional de dois anos. Contudo, caso haja prorrogação, ela somente pode ocorrer uma vez e deve ter período igual ao prazo inicial, isto é, dezoito meses.",
    learningObjective:
      "Aplicar os limites de duração, frequência e equivalência temporal da prorrogação de concurso público.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "integralmente válida, pois qualquer prorrogação inferior a dois anos é permitida.",
        isCorrect: false,
        rationale: "A prorrogação deve ter período igual ao prazo inicial.",
      },
      {
        key: "B",
        text: "inválida apenas porque o prazo inicial deveria ser exatamente de dois anos.",
        isCorrect: false,
        rationale: "A Constituição estabelece prazo de até dois anos, não prazo fixo.",
      },
      {
        key: "C",
        text: "válida se forem autorizadas duas prorrogações sucessivas de doze meses.",
        isCorrect: false,
        rationale: "O dispositivo permite uma única prorrogação.",
      },
      {
        key: "D",
        text: "integralmente inválida, porque nenhum concurso pode ter validade inferior a dois anos.",
        isCorrect: false,
        rationale: "O prazo de dois anos é máximo, não mínimo.",
      },
      {
        key: "E",
        text: "parcialmente incompatível, pois a única prorrogação admitida deve repetir os dezoito meses do prazo inicial.",
        isCorrect: true,
        rationale: "A resposta preserva o prazo inicial e corrige a exigência de igual período.",
      },
    ],
  },
  {
    publicId: "5869f68d-88cc-4624-bf5d-2f77ce0a7f1a",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "fcc",
    articleRef: "Art. 41, caput",
    type: "multiple_choice",
    prompt:
      "De acordo com o art. 41, caput, da Constituição Federal, a estabilidade ali prevista é adquirida por servidores que reúnam, cumulativamente,",
    explanation:
      "O caput do art. 41 combina três elementos: três anos de efetivo exercício, nomeação para cargo de provimento efetivo e ingresso em virtude de concurso público.",
    learningObjective:
      "Reconhecer os elementos cumulativos expressamente associados à estabilidade constitucional do servidor.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "dois anos de exercício, cargo efetivo e processo seletivo simplificado.",
        isCorrect: false,
        rationale: "O prazo é de três anos e a fonte exige concurso público.",
      },
      {
        key: "B",
        text: "três anos de efetivo exercício, cargo de provimento efetivo e nomeação em virtude de concurso público.",
        isCorrect: true,
        rationale: "A alternativa contém os três elementos previstos no caput.",
      },
      {
        key: "C",
        text: "três anos de exercício, cargo em comissão e nomeação de livre escolha.",
        isCorrect: false,
        rationale: "Cargo em comissão não corresponde ao cargo efetivo descrito.",
      },
      {
        key: "D",
        text: "quatro anos de efetivo exercício, qualquer cargo público e aprovação interna.",
        isCorrect: false,
        rationale: "Prazo, tipo de cargo e forma de ingresso divergem da fonte.",
      },
      {
        key: "E",
        text: "três anos desde a nomeação, ainda que não haja efetivo exercício ou concurso público.",
        isCorrect: false,
        rationale: "A fonte exige efetivo exercício e nomeação em virtude de concurso.",
      },
    ],
  },
  {
    publicId: "525da577-bfab-4ac5-9716-ae50c89fe17a",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "cebraspe",
    articleRef: "Art. 41, § 1º, III",
    type: "true_false",
    prompt:
      "Julgue o item: o servidor público estável pode perder o cargo mediante procedimento de avaliação periódica de desempenho, na forma de lei ordinária, desde que lhe seja assegurada ampla defesa.",
    explanation:
      "O item está errado porque o art. 41, § 1º, III, exige que o procedimento de avaliação periódica de desempenho seja disciplinado na forma de lei complementar, além de assegurar ampla defesa.",
    learningObjective:
      "Distinguir a espécie normativa exigida para a perda do cargo por avaliação periódica de desempenho.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A referência à lei ordinária torna a assertiva incorreta." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "O dispositivo exige lei complementar." },
    ],
  },
  {
    publicId: "c3c87f4f-b486-4afb-90bc-10a668fb3d77",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "vunesp",
    articleRef: "Art. 84, II",
    type: "multiple_choice",
    prompt:
      "Ao organizar a direção superior da administração federal, qual solução corresponde à atribuição presidencial prevista no art. 84, II, da Constituição Federal?",
    explanation:
      "O inciso II atribui ao Presidente da República o exercício da direção superior da administração federal com o auxílio dos Ministros de Estado.",
    learningObjective:
      "Identificar o titular e a forma de exercício da direção superior da administração federal.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "Transferir integralmente a direção superior ao Congresso Nacional.",
        isCorrect: false,
        rationale: "A atribuição indicada é presidencial.",
      },
      {
        key: "B",
        text: "Exercer a direção superior sem qualquer participação dos Ministros de Estado.",
        isCorrect: false,
        rationale: "O texto constitucional menciona o auxílio dos Ministros de Estado.",
      },
      {
        key: "C",
        text: "Limitar a direção superior à administração estadual e municipal.",
        isCorrect: false,
        rationale: "O dispositivo trata da administração federal.",
      },
      {
        key: "D",
        text: "Exercer, com o auxílio dos Ministros de Estado, a direção superior da administração federal.",
        isCorrect: true,
        rationale: "A alternativa preserva sujeito, auxílio e âmbito previstos no inciso.",
      },
      {
        key: "E",
        text: "Submeter a direção superior à autorização prévia do Poder Judiciário.",
        isCorrect: false,
        rationale: "Essa condição não consta do dispositivo selecionado.",
      },
    ],
  },
  {
    publicId: "0a04d70b-ae85-4015-9468-bf0a93bd120d",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "fgv",
    articleRef: "Art. 84, IV",
    type: "multiple_choice",
    prompt:
      "Após a publicação de uma lei federal, o Presidente da República avalia a edição de atos destinados a permitir sua execução fiel. Com base apenas no art. 84, IV, da Constituição Federal, compete-lhe",
    explanation:
      "O art. 84, IV, prevê, entre outras ações, a expedição de decretos e regulamentos para a fiel execução das leis.",
    learningObjective:
      "Reconhecer a finalidade constitucional dos decretos e regulamentos expedidos pelo Presidente da República.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "expedir decretos e regulamentos para a fiel execução da lei.",
        isCorrect: true,
        rationale: "A alternativa corresponde à finalidade expressa no inciso IV.",
      },
      {
        key: "B",
        text: "expedir resoluções para substituir integralmente a lei publicada.",
        isCorrect: false,
        rationale: "O inciso não prevê substituição da lei por resolução.",
      },
      {
        key: "C",
        text: "suspender a lei até que o Poder Judiciário aprove seu regulamento.",
        isCorrect: false,
        rationale: "Essa condição não consta da atribuição constitucional indicada.",
      },
      {
        key: "D",
        text: "editar regulamentos independentes da execução da lei.",
        isCorrect: false,
        rationale: "A fonte vincula os atos à fiel execução das leis.",
      },
      {
        key: "E",
        text: "promulgar apenas a lei, ficando vedada a expedição de decretos.",
        isCorrect: false,
        rationale: "O inciso autoriza expressamente decretos e regulamentos.",
      },
    ],
  },
  {
    publicId: "92f2a0a3-b3eb-40f5-8fd8-b178c8f6334d",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "fcc",
    articleRef: "Art. 144, caput",
    type: "multiple_choice",
    prompt:
      "Na formulação constitucional da segurança pública prevista no art. 144, caput, a relação entre dever, direito, responsabilidade e finalidade está corretamente expressa em:",
    explanation:
      "O caput do art. 144 define a segurança pública como dever do Estado, direito e responsabilidade de todos, exercida para preservar a ordem pública e a incolumidade das pessoas e do patrimônio.",
    learningObjective:
      "Relacionar os sujeitos e as finalidades que estruturam a segurança pública no texto constitucional.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "dever de todos, direito exclusivo do Estado e finalidade limitada à proteção patrimonial.",
        isCorrect: false,
        rationale: "A alternativa troca os sujeitos e reduz indevidamente a finalidade.",
      },
      {
        key: "B",
        text: "dever dos Municípios, responsabilidade da União e finalidade de defesa nacional.",
        isCorrect: false,
        rationale: "Esses sujeitos e essa finalidade não correspondem ao caput.",
      },
      {
        key: "C",
        text: "dever do Estado, direito e responsabilidade de todos, com preservação da ordem pública e da incolumidade das pessoas e do patrimônio.",
        isCorrect: true,
        rationale: "A alternativa conserva todos os elementos relevantes do dispositivo.",
      },
      {
        key: "D",
        text: "direito do Estado, dever dos agentes policiais e responsabilidade facultativa da sociedade.",
        isCorrect: false,
        rationale: "A distribuição constitucional dos papéis foi alterada.",
      },
      {
        key: "E",
        text: "responsabilidade exclusiva da União, destinada apenas à preservação da ordem pública.",
        isCorrect: false,
        rationale: "Não há exclusividade da União, e a finalidade é mais ampla.",
      },
    ],
  },
  {
    publicId: "e86dc46a-8b53-4565-aa09-6bd043374c12",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
    bankSlug: "cebraspe",
    articleRef: "Art. 144, § 5º",
    type: "true_false",
    prompt:
      "Julgue o item: às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa civil.",
    explanation:
      "O item está certo e reproduz os dois núcleos de atribuições estabelecidos no art. 144, § 5º, da Constituição Federal.",
    learningObjective:
      "Diferenciar as atribuições constitucionais das polícias militares e dos corpos de bombeiros militares.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: true, rationale: "A assertiva corresponde integralmente ao § 5º." },
      { key: "E", text: "Errado", isCorrect: false, rationale: "Não há alteração de sujeito, atribuição ou condição no item." },
    ],
  },
  {
    publicId: "7977295c-3eef-4150-a69f-f5d15b622243",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "cebraspe",
    articleRef: "Art. 5º, IV",
    type: "true_false",
    prompt:
      "Julgue o item: por assegurar a livre manifestação do pensamento, a Constituição Federal também protege o anonimato sempre que a identificação puder desencorajar a exposição de uma opinião.",
    explanation:
      "O item está errado. O art. 5º, IV, assegura a livre manifestação do pensamento, mas veda expressamente o anonimato, sem prever a condição descrita na assertiva.",
    learningObjective:
      "Julgar corretamente a relação entre liberdade de manifestação e vedação ao anonimato.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: false, rationale: "A proteção ao anonimato contradiz a vedação expressa do inciso IV." },
      { key: "E", text: "Errado", isCorrect: true, rationale: "A manifestação é livre, mas o anonimato é vedado." },
    ],
  },
  {
    publicId: "14c66fb7-e0f0-4abf-9123-997a31e7c67d",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "fcc",
    articleRef: "Art. 5º, IX",
    type: "multiple_choice",
    prompt:
      "O art. 5º, IX, da Constituição Federal estabelece uma liberdade cujo objeto e cuja condição de exercício estão corretamente indicados em:",
    explanation:
      "O inciso IX protege a expressão das atividades intelectual, artística, científica e de comunicação e determina que seu exercício independe de censura ou licença.",
    learningObjective:
      "Reconhecer simultaneamente as atividades protegidas e a independência de censura ou licença.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "atividade intelectual e científica, mediante licença e sem censura.",
        isCorrect: false,
        rationale: "Há omissão de atividades protegidas e inclusão indevida de licença.",
      },
      {
        key: "B",
        text: "atividade artística e de comunicação, desde que submetida a censura posterior.",
        isCorrect: false,
        rationale: "O dispositivo afasta a censura e não restringe a proteção a duas atividades.",
      },
      {
        key: "C",
        text: "atividade intelectual, artística e científica, mediante autorização administrativa.",
        isCorrect: false,
        rationale: "A comunicação foi omitida e a autorização equivale a condição não prevista.",
      },
      {
        key: "D",
        text: "atividade de comunicação, desde que licenciada e desvinculada de produção artística.",
        isCorrect: false,
        rationale: "A licença é afastada, e as atividades não são excludentes entre si.",
      },
      {
        key: "E",
        text: "atividade intelectual, artística, científica e de comunicação, independentemente de censura ou licença.",
        isCorrect: true,
        rationale: "A alternativa preserva integralmente objeto e condição do inciso IX.",
      },
    ],
  },
  {
    publicId: "84bbf60b-4c1c-49c8-a373-d0ef3c08d0b8",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "vunesp",
    articleRef: "Art. 5º, XXXV",
    type: "multiple_choice",
    prompt:
      "Uma lei determinou que o Poder Judiciário somente poderá apreciar uma controvérsia depois que a ameaça a direito se transformar em lesão efetiva. Considerando o art. 5º, XXXV, da Constituição Federal, essa regra",
    explanation:
      "A regra é incompatível com o inciso XXXV, pois a lei não pode excluir da apreciação do Poder Judiciário nem a lesão nem a ameaça a direito.",
    learningObjective:
      "Aplicar a proteção jurisdicional preventiva diante de ameaça a direito.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "é válida, porque o Judiciário atua somente depois de consumado o dano.",
        isCorrect: false,
        rationale: "A ameaça a direito também recebe proteção constitucional.",
      },
      {
        key: "B",
        text: "é válida quando a ameaça puder ser examinada por autoridade administrativa.",
        isCorrect: false,
        rationale: "A possibilidade administrativa não autoriza a exclusão prevista na lei descrita.",
      },
      {
        key: "C",
        text: "é inválida apenas quando a lesão futura tiver natureza patrimonial.",
        isCorrect: false,
        rationale: "O inciso não limita a garantia a direitos patrimoniais.",
      },
      {
        key: "D",
        text: "é incompatível com a Constituição, que também protege a ameaça a direito perante o Poder Judiciário.",
        isCorrect: true,
        rationale: "A alternativa aplica diretamente os dois objetos protegidos pelo inciso.",
      },
      {
        key: "E",
        text: "é compatível desde que aprovada por maioria absoluta do Poder Legislativo.",
        isCorrect: false,
        rationale: "O processo de aprovação não afasta a garantia material do inciso XXXV.",
      },
    ],
  },
  {
    publicId: "edb8eee0-54dc-4078-a221-82ab4dce9c2e",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "fgv",
    articleRef: "Art. 37, caput",
    type: "multiple_choice",
    prompt:
      "Uma fundação integrante da administração indireta de um Estado sustenta que o princípio da eficiência não lhe é aplicável, porque o art. 37, caput, alcançaria apenas órgãos da administração direta. À luz desse dispositivo, a fundação está",
    explanation:
      "A fundação está equivocada. O art. 37, caput, submete a administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios aos cinco princípios enumerados, inclusive eficiência.",
    learningObjective:
      "Aplicar os princípios do art. 37 à administração indireta dos diferentes entes federativos.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "correta, pois eficiência é princípio exclusivo da administração direta federal.",
        isCorrect: false,
        rationale: "O alcance é mais amplo quanto à estrutura e ao ente federativo.",
      },
      {
        key: "B",
        text: "correta, porque fundações se submetem apenas à legalidade e à publicidade.",
        isCorrect: false,
        rationale: "O caput enumera cinco princípios sem essa redução.",
      },
      {
        key: "C",
        text: "equivocada, porque a administração indireta estadual também deve observar a eficiência e os demais princípios enumerados.",
        isCorrect: true,
        rationale: "A alternativa preserva estrutura, ente e conjunto de princípios do caput.",
      },
      {
        key: "D",
        text: "equivocada apenas se estiver vinculada ao Poder Executivo da União.",
        isCorrect: false,
        rationale: "A regra alcança qualquer dos Poderes e todos os entes indicados.",
      },
      {
        key: "E",
        text: "correta, salvo se lei estadual estender voluntariamente os princípios à fundação.",
        isCorrect: false,
        rationale: "A incidência decorre diretamente da Constituição.",
      },
    ],
  },
  {
    publicId: "ba103e70-a62f-4fe4-b456-34ac952fc8ae",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "fcc",
    articleRef: "Art. 37, II",
    type: "multiple_choice",
    prompt:
      "A disciplina constitucional da investidura em cargo ou emprego público, prevista no art. 37, II, combina corretamente modalidade de seleção e ressalva em:",
    explanation:
      "A regra exige aprovação prévia em concurso público de provas ou de provas e títulos, conforme a natureza e a complexidade do cargo ou emprego. A ressalva refere-se às nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração.",
    learningObjective:
      "Identificar a modalidade constitucional do concurso e a extensão exata da ressalva aos cargos em comissão.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "concurso exclusivamente de títulos; ressalva para todo cargo temporário criado por decreto.",
        isCorrect: false,
        rationale: "A modalidade e a ressalva não correspondem ao inciso II.",
      },
      {
        key: "B",
        text: "concurso de provas ou de provas e títulos; ressalva para cargo em comissão declarado em lei de livre nomeação e exoneração.",
        isCorrect: true,
        rationale: "A alternativa reúne a modalidade e a ressalva previstas.",
      },
      {
        key: "C",
        text: "concurso apenas de provas; ressalva para qualquer emprego público de confiança.",
        isCorrect: false,
        rationale: "O concurso também pode incluir títulos, e a ressalva tem objeto específico.",
      },
      {
        key: "D",
        text: "processo seletivo posterior à investidura; ressalva para cargo efetivo de direção.",
        isCorrect: false,
        rationale: "A aprovação deve ser prévia e cargo efetivo não integra a ressalva descrita.",
      },
      {
        key: "E",
        text: "concurso definido livremente pela autoridade; ressalva para nomeação autorizada em regulamento.",
        isCorrect: false,
        rationale: "O inciso estabelece modalidades e exige declaração em lei para o cargo em comissão.",
      },
    ],
  },
  {
    publicId: "560390cd-7385-44e6-914c-de132a62c949",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "cebraspe",
    articleRef: "Art. 37, III",
    type: "true_false",
    prompt:
      "Julgue o item: o prazo de validade do concurso público pode ser fixado em período inferior a dois anos e, se houver prorrogação, ela poderá ocorrer uma única vez por período igual ao inicialmente estabelecido.",
    explanation:
      "O item está certo. O art. 37, III, fixa prazo de validade de até dois anos e admite uma prorrogação por igual período, o que permite prazo inicial inferior ao limite máximo.",
    learningObjective:
      "Distinguir prazo máximo de prazo fixo e aplicar a regra da prorrogação por igual período.",
    difficulty: 3,
    options: [
      { key: "C", text: "Certo", isCorrect: true, rationale: "A assertiva respeita o limite máximo e a única prorrogação por igual período." },
      { key: "E", text: "Errado", isCorrect: false, rationale: "Dois anos são o limite máximo, não uma duração obrigatória." },
    ],
  },
  {
    publicId: "5c3744dc-4a48-4d39-8a04-8500d8b80094",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "fgv",
    articleRef: "Art. 41, caput",
    type: "multiple_choice",
    prompt:
      "Nina foi aprovada em concurso público, nomeada para cargo de provimento efetivo e completou dois anos e onze meses de efetivo exercício. Com fundamento apenas no art. 41, caput, da Constituição Federal, Nina",
    explanation:
      "Nina ainda não adquiriu a estabilidade prevista no caput, pois o dispositivo exige três anos de efetivo exercício, embora os demais requisitos narrados estejam presentes.",
    learningObjective:
      "Aplicar cumulativamente prazo, espécie de cargo e forma de ingresso para reconhecer a estabilidade.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "já é estável, porque a aprovação no concurso produz estabilidade imediata.",
        isCorrect: false,
        rationale: "A aprovação não substitui o período de efetivo exercício.",
      },
      {
        key: "B",
        text: "já é estável, porque dois anos de efetivo exercício são suficientes.",
        isCorrect: false,
        rationale: "O prazo constitucional é de três anos.",
      },
      {
        key: "C",
        text: "ainda não é estável, porque não completou três anos de efetivo exercício.",
        isCorrect: true,
        rationale: "Falta o requisito temporal expresso no caput.",
      },
      {
        key: "D",
        text: "não poderá adquirir estabilidade, porque ela se aplica apenas a cargo em comissão.",
        isCorrect: false,
        rationale: "O dispositivo se refere justamente ao cargo de provimento efetivo.",
      },
      {
        key: "E",
        text: "somente será estável após cinco anos contados da nomeação, ainda que sem exercício.",
        isCorrect: false,
        rationale: "Prazo e marco temporal divergem da fonte constitucional.",
      },
    ],
  },
  {
    publicId: "bde4a0c5-8382-435d-99ee-97dbe4377bc5",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "vunesp",
    articleRef: "Art. 41, § 1º, III",
    type: "multiple_choice",
    prompt:
      "Um servidor estável foi submetido a procedimento de avaliação periódica de desempenho para possível perda do cargo. Segundo o art. 41, § 1º, III, da Constituição Federal, o procedimento deve",
    explanation:
      "A hipótese constitucional exige procedimento de avaliação periódica de desempenho, na forma de lei complementar, com ampla defesa assegurada.",
    learningObjective:
      "Aplicar os requisitos formais e defensivos da perda do cargo por avaliação periódica de desempenho.",
    difficulty: 3,
    options: [
      {
        key: "A",
        text: "ser disciplinado por decreto e admitir defesa restrita à análise documental.",
        isCorrect: false,
        rationale: "A fonte exige lei complementar e ampla defesa.",
      },
      {
        key: "B",
        text: "ser eventual, regulado por lei ordinária e dispensar defesa quando houver nota insuficiente.",
        isCorrect: false,
        rationale: "Periodicidade, espécie normativa e garantia defensiva estão incorretas.",
      },
      {
        key: "C",
        text: "ser regulado por resolução interna, com defesa apenas depois da perda do cargo.",
        isCorrect: false,
        rationale: "A exigência é de lei complementar e de ampla defesa no procedimento.",
      },
      {
        key: "D",
        text: "ser especial, previsto em lei ordinária e assegurar contraditório sem ampla defesa.",
        isCorrect: false,
        rationale: "A fonte fala em avaliação periódica, lei complementar e ampla defesa.",
      },
      {
        key: "E",
        text: "ser periódico, observar a forma de lei complementar e assegurar ampla defesa.",
        isCorrect: true,
        rationale: "A alternativa conserva os três elementos do inciso III.",
      },
    ],
  },
  {
    publicId: "c9a858eb-4791-4d6b-af54-fb08f6960f66",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "fcc",
    articleRef: "Art. 84, II",
    type: "multiple_choice",
    prompt:
      "A atribuição prevista no art. 84, II, da Constituição Federal é corretamente descrita quanto ao titular, aos auxiliares e ao âmbito administrativo em:",
    explanation:
      "O dispositivo atribui ao Presidente da República o exercício, com o auxílio dos Ministros de Estado, da direção superior da administração federal.",
    learningObjective:
      "Relacionar titular, auxiliares e âmbito da direção superior prevista no art. 84, II.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "Congresso Nacional, com auxílio dos Governadores, na administração estadual.",
        isCorrect: false,
        rationale: "Titular, auxiliares e âmbito não correspondem ao inciso.",
      },
      {
        key: "B",
        text: "Presidente da República, sem auxílio ministerial, na administração municipal.",
        isCorrect: false,
        rationale: "A fonte menciona auxílio ministerial e administração federal.",
      },
      {
        key: "C",
        text: "Ministros de Estado, com auxílio do Judiciário, na administração indireta estadual.",
        isCorrect: false,
        rationale: "A direção é atribuída ao Presidente e tem âmbito federal.",
      },
      {
        key: "D",
        text: "Presidente da República, com auxílio dos Ministros de Estado, na direção superior da administração federal.",
        isCorrect: true,
        rationale: "A alternativa preserva os três elementos do inciso II.",
      },
      {
        key: "E",
        text: "Supremo Tribunal Federal, com auxílio do Presidente, na administração de todos os entes.",
        isCorrect: false,
        rationale: "Nenhum desses elementos corresponde ao comando selecionado.",
      },
    ],
  },
  {
    publicId: "1b30cfa2-5016-4bc1-8b4a-07b9441a681f",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "cebraspe",
    articleRef: "Art. 84, IV",
    type: "true_false",
    prompt:
      "Julgue o item: entre as atribuições do Presidente da República está a expedição de decretos e regulamentos destinados à fiel execução das leis.",
    explanation:
      "O item está certo. O art. 84, IV, inclui expressamente a expedição de decretos e regulamentos para a fiel execução das leis.",
    learningObjective:
      "Reconhecer a finalidade executiva dos decretos e regulamentos presidenciais no inciso IV.",
    difficulty: 2,
    options: [
      { key: "C", text: "Certo", isCorrect: true, rationale: "A assertiva corresponde à atribuição expressa no inciso IV." },
      { key: "E", text: "Errado", isCorrect: false, rationale: "A fonte prevê exatamente decretos e regulamentos para fiel execução." },
    ],
  },
  {
    publicId: "97d62847-6992-4737-bb2f-bd86a783ea5a",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "vunesp",
    articleRef: "Art. 144, caput",
    type: "multiple_choice",
    prompt:
      "Uma autoridade afirmou que, por ser responsabilidade de todos, a segurança pública deixou de constituir dever do Estado. À luz do art. 144, caput, da Constituição Federal, a afirmação é",
    explanation:
      "A afirmação é incorreta. O caput reúne as qualificações: segurança pública é dever do Estado e, ao mesmo tempo, direito e responsabilidade de todos.",
    learningObjective:
      "Interpretar como cumulativas as qualificações constitucionais da segurança pública.",
    difficulty: 2,
    options: [
      {
        key: "A",
        text: "correta, porque a responsabilidade social substitui integralmente o dever estatal.",
        isCorrect: false,
        rationale: "As qualificações são cumulativas, não substitutivas.",
      },
      {
        key: "B",
        text: "incorreta, porque a segurança pública é dever do Estado, além de direito e responsabilidade de todos.",
        isCorrect: true,
        rationale: "A alternativa reúne corretamente os papéis previstos no caput.",
      },
      {
        key: "C",
        text: "correta, pois o Estado responde apenas pela proteção do patrimônio público.",
        isCorrect: false,
        rationale: "O Estado mantém o dever, e a finalidade abrange pessoas e patrimônio.",
      },
      {
        key: "D",
        text: "incorreta somente porque a segurança pública é direito exclusivo dos agentes estatais.",
        isCorrect: false,
        rationale: "O direito é de todos, não exclusivo de agentes.",
      },
      {
        key: "E",
        text: "correta quando a comunidade organizar meios próprios de preservação da ordem.",
        isCorrect: false,
        rationale: "A organização comunitária não elimina o dever constitucional do Estado.",
      },
    ],
  },
  {
    publicId: "65dc589d-1305-4813-9176-7c60fca989fb",
    promptVersion: ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
    bankSlug: "fgv",
    articleRef: "Art. 144, § 5º",
    type: "multiple_choice",
    prompt:
      "Um Estado pretende atribuir às polícias militares a polícia judiciária e limitar os corpos de bombeiros militares exclusivamente à defesa civil, eliminando outras atribuições legais. Considerando apenas o art. 144, § 5º, da Constituição Federal, a proposta é",
    explanation:
      "A proposta contraria os dois núcleos do § 5º: às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares incumbe a defesa civil, além das atribuições definidas em lei.",
    learningObjective:
      "Aplicar conjuntamente as atribuições constitucionais das polícias e dos corpos de bombeiros militares.",
    difficulty: 4,
    options: [
      {
        key: "A",
        text: "compatível em ambos os pontos, porque o Estado pode redistribuir livremente essas atribuições.",
        isCorrect: false,
        rationale: "A proposta se afasta das atribuições expressamente previstas.",
      },
      {
        key: "B",
        text: "compatível apenas quanto à polícia judiciária atribuída às polícias militares.",
        isCorrect: false,
        rationale: "O § 5º lhes atribui polícia ostensiva e preservação da ordem pública.",
      },
      {
        key: "C",
        text: "compatível apenas quanto à exclusividade da defesa civil para os corpos de bombeiros militares.",
        isCorrect: false,
        rationale: "O texto preserva outras atribuições definidas em lei.",
      },
      {
        key: "D",
        text: "incompatível nos dois pontos, pelas atribuições das polícias militares e pela manutenção de atribuições legais dos corpos de bombeiros militares.",
        isCorrect: true,
        rationale: "A alternativa corrige os dois desvios da proposta.",
      },
      {
        key: "E",
        text: "incompatível somente porque a defesa civil cabe às polícias militares.",
        isCorrect: false,
        rationale: "A defesa civil é incumbência dos corpos de bombeiros militares no dispositivo.",
      },
    ],
  },
] as const satisfies readonly PilotOriginalQuestion[];
