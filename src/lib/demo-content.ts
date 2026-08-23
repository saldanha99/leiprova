export const CONSTITUTION_OFFICIAL_URL =
  "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";

export const DEMO_CONTENT_PROVENANCE = {
  authorshipMethod: "ai_assisted",
  generatorModel: "OpenAI Codex",
  promptVersion: "constitutional-literal-v1",
  humanReviewRecorded: false,
  publicationStage: "beta",
} as const;

export type DemoQuestionOptionId = "a" | "b" | "c" | "d";

export type DemoQuestionMutationKind =
  | "literal"
  | "addition"
  | "condition"
  | "deadline"
  | "frequency"
  | "institution"
  | "modality"
  | "negation"
  | "normative-source"
  | "omission"
  | "scope"
  | "sequence"
  | "substitution";

export type DemoQuestionDifficulty = "easy" | "medium" | "hard";

export interface DemoQuestionOption {
  readonly id: DemoQuestionOptionId;
  readonly text: string;
  readonly mutationKind: DemoQuestionMutationKind;
}

export interface DemoQuestion {
  readonly slug: string;
  readonly legalAct: string;
  readonly articleRef: string;
  readonly officialUrl: string;
  readonly verifiedAt: "2026-08-16";
  readonly prompt: string;
  readonly options: readonly DemoQuestionOption[];
  readonly correctOptionId: DemoQuestionOptionId;
  readonly literalText: string;
  readonly explanation: string;
  readonly difficulty: DemoQuestionDifficulty;
  readonly topic: string;
  readonly suggestedReviewDays: readonly number[];
}

export const DEMO_QUESTIONS = [
  {
    slug: "cf-art-5-iv-manifestacao-pensamento",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 5º, IV",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Assinale a alternativa que reproduz literalmente o art. 5º, IV, da Constituição Federal.",
    options: [
      {
        id: "a",
        text: "é livre a manifestação do pensamento, sendo permitido o anonimato;",
        mutationKind: "negation",
      },
      {
        id: "b",
        text: "é livre a manifestação do pensamento, sendo vedado o anonimato;",
        mutationKind: "literal",
      },
      {
        id: "c",
        text: "é assegurada a manifestação do pensamento, sendo vedado o anonimato;",
        mutationKind: "substitution",
      },
      {
        id: "d",
        text: "é livre a manifestação do pensamento, sendo vedado o anonimato apenas em comunicações públicas;",
        mutationKind: "scope",
      },
    ],
    correctOptionId: "b",
    literalText:
      "é livre a manifestação do pensamento, sendo vedado o anonimato;",
    explanation:
      "O inciso IV assegura a livre manifestação do pensamento e veda o anonimato, sem a restrição adicional proposta nos distratores.",
    difficulty: "easy",
    topic: "Direitos e garantias fundamentais",
    suggestedReviewDays: [1, 3, 7, 14, 30],
  },
  {
    slug: "cf-art-5-ix-liberdade-expressao",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 5º, IX",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Qual alternativa apresenta a redação literal do art. 5º, IX, da Constituição Federal?",
    options: [
      {
        id: "a",
        text: "é livre a expressão da atividade intelectual, artística, científica e de comunicação, mediante licença;",
        mutationKind: "condition",
      },
      {
        id: "b",
        text: "é livre a expressão da atividade intelectual, artística, científica e de comunicação, independentemente de censura, mas dependente de licença;",
        mutationKind: "condition",
      },
      {
        id: "c",
        text: "é livre a expressão da atividade intelectual, artística e científica, independentemente de censura ou licença;",
        mutationKind: "omission",
      },
      {
        id: "d",
        text: "é livre a expressão da atividade intelectual, artística, científica e de comunicação, independentemente de censura ou licença;",
        mutationKind: "literal",
      },
    ],
    correctOptionId: "d",
    literalText:
      "é livre a expressão da atividade intelectual, artística, científica e de comunicação, independentemente de censura ou licença;",
    explanation:
      "O inciso IX inclui a atividade de comunicação e declara a liberdade independentemente tanto de censura quanto de licença.",
    difficulty: "medium",
    topic: "Direitos e garantias fundamentais",
    suggestedReviewDays: [1, 3, 7, 15, 30, 60],
  },
  {
    slug: "cf-art-5-xxxv-inafastabilidade-jurisdicao",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 5º, XXXV",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Assinale a única alternativa que corresponde literalmente ao art. 5º, XXXV, da Constituição Federal.",
    options: [
      {
        id: "a",
        text: "a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito;",
        mutationKind: "literal",
      },
      {
        id: "b",
        text: "a lei não excluirá da apreciação do Poder Judiciário lesão consumada a direito;",
        mutationKind: "scope",
      },
      {
        id: "c",
        text: "a lei não excluirá da apreciação do Poder Executivo lesão ou ameaça a direito;",
        mutationKind: "institution",
      },
      {
        id: "d",
        text: "a lei poderá excluir da apreciação do Poder Judiciário lesão ou ameaça a direito;",
        mutationKind: "modality",
      },
    ],
    correctOptionId: "a",
    literalText:
      "a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito;",
    explanation:
      "A literalidade protege tanto a lesão quanto a ameaça a direito e atribui sua apreciação ao Poder Judiciário.",
    difficulty: "easy",
    topic: "Direitos e garantias fundamentais",
    suggestedReviewDays: [1, 3, 7, 14, 30],
  },
  {
    slug: "cf-art-37-caput-principios-administracao",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 37, caput",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Qual alternativa reproduz literalmente o caput do art. 37 da Constituição Federal?",
    options: [
      {
        id: "a",
        text: "A administração pública direta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência e, também, ao seguinte:",
        mutationKind: "omission",
      },
      {
        id: "b",
        text: "A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e economicidade e, também, ao seguinte:",
        mutationKind: "substitution",
      },
      {
        id: "c",
        text: "A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência e, também, ao seguinte:",
        mutationKind: "literal",
      },
      {
        id: "d",
        text: "A administração pública direta e indireta do Poder Executivo da União obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência e, também, ao seguinte:",
        mutationKind: "scope",
      },
    ],
    correctOptionId: "c",
    literalText:
      "A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência e, também, ao seguinte:",
    explanation:
      "O caput alcança a administração direta e indireta de qualquer Poder de todos os entes indicados e enumera legalidade, impessoalidade, moralidade, publicidade e eficiência.",
    difficulty: "medium",
    topic: "Princípios da administração pública",
    suggestedReviewDays: [1, 3, 7, 15, 30, 60],
  },
  {
    slug: "cf-art-37-ii-investidura-concurso",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 37, II",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Assinale a alternativa que contém a redação literal do art. 37, II, da Constituição Federal.",
    options: [
      {
        id: "a",
        text: "a investidura em cargo ou emprego público depende de aprovação prévia em concurso público exclusivamente de provas, de acordo com a natureza e a complexidade do cargo ou emprego, na forma prevista em lei, ressalvadas as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração;",
        mutationKind: "scope",
      },
      {
        id: "b",
        text: "a investidura em cargo ou emprego público depende de aprovação prévia em concurso público de provas ou de provas e títulos, de acordo com a natureza e a complexidade do cargo ou emprego, na forma prevista em lei, ressalvadas as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração;",
        mutationKind: "literal",
      },
      {
        id: "c",
        text: "a investidura em cargo ou emprego público depende de aprovação prévia em concurso público de provas ou de provas e títulos, de acordo com a natureza e a complexidade do cargo ou emprego, na forma prevista em lei, incluídas as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração;",
        mutationKind: "negation",
      },
      {
        id: "d",
        text: "a investidura em cargo ou emprego público depende de aprovação posterior em concurso público de provas ou de provas e títulos, de acordo com a natureza e a complexidade do cargo ou emprego, na forma prevista em lei, ressalvadas as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração;",
        mutationKind: "sequence",
      },
    ],
    correctOptionId: "b",
    literalText:
      "a investidura em cargo ou emprego público depende de aprovação prévia em concurso público de provas ou de provas e títulos, de acordo com a natureza e a complexidade do cargo ou emprego, na forma prevista em lei, ressalvadas as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração;",
    explanation:
      "O inciso II exige aprovação prévia em concurso de provas ou de provas e títulos e ressalva as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração.",
    difficulty: "hard",
    topic: "Concurso público e investidura",
    suggestedReviewDays: [1, 2, 5, 10, 21, 45, 90],
  },
  {
    slug: "cf-art-37-iii-validade-concurso",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 37, III",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Segundo a literalidade do art. 37, III, da Constituição Federal, qual é a redação correta sobre a validade do concurso público?",
    options: [
      {
        id: "a",
        text: "o prazo de validade do concurso público será de até quatro anos, prorrogável uma vez, por igual período;",
        mutationKind: "deadline",
      },
      {
        id: "b",
        text: "o prazo de validade do concurso público será de até dois anos, prorrogável duas vezes, por igual período;",
        mutationKind: "frequency",
      },
      {
        id: "c",
        text: "o prazo de validade do concurso público será de até dois anos, prorrogável uma vez, por período diverso;",
        mutationKind: "deadline",
      },
      {
        id: "d",
        text: "o prazo de validade do concurso público será de até dois anos, prorrogável uma vez, por igual período;",
        mutationKind: "literal",
      },
    ],
    correctOptionId: "d",
    literalText:
      "o prazo de validade do concurso público será de até dois anos, prorrogável uma vez, por igual período;",
    explanation:
      "A Constituição fixa prazo de até dois anos e admite uma única prorrogação, pelo mesmo período.",
    difficulty: "easy",
    topic: "Concurso público e validade",
    suggestedReviewDays: [1, 3, 7, 14, 30],
  },
  {
    slug: "cf-art-41-caput-estabilidade",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 41, caput",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Assinale a alternativa que reproduz literalmente o caput do art. 41 da Constituição Federal.",
    options: [
      {
        id: "a",
        text: "São estáveis após três anos de efetivo exercício os servidores nomeados para cargo de provimento efetivo em virtude de concurso público.",
        mutationKind: "literal",
      },
      {
        id: "b",
        text: "São estáveis após dois anos de efetivo exercício os servidores nomeados para cargo de provimento efetivo em virtude de concurso público.",
        mutationKind: "deadline",
      },
      {
        id: "c",
        text: "São estáveis após três anos de efetivo exercício os servidores nomeados para cargo em comissão em virtude de concurso público.",
        mutationKind: "substitution",
      },
      {
        id: "d",
        text: "São estáveis após três anos de efetivo exercício os servidores nomeados para cargo de provimento efetivo, independentemente de concurso público.",
        mutationKind: "condition",
      },
    ],
    correctOptionId: "a",
    literalText:
      "São estáveis após três anos de efetivo exercício os servidores nomeados para cargo de provimento efetivo em virtude de concurso público.",
    explanation:
      "A estabilidade do caput refere-se a três anos de efetivo exercício, cargo de provimento efetivo e nomeação em virtude de concurso público.",
    difficulty: "easy",
    topic: "Estabilidade do servidor público",
    suggestedReviewDays: [1, 3, 7, 14, 30],
  },
  {
    slug: "cf-art-41-paragrafo-1-iii-avaliacao-periodica",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 41, § 1º, III",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "No art. 41, § 1º, III, qual alternativa reproduz literalmente a hipótese de perda do cargo ali prevista?",
    options: [
      {
        id: "a",
        text: "mediante procedimento de avaliação especial de desempenho, na forma de lei complementar, assegurada ampla defesa.",
        mutationKind: "substitution",
      },
      {
        id: "b",
        text: "mediante procedimento de avaliação periódica de desempenho, na forma de lei ordinária, assegurada ampla defesa.",
        mutationKind: "normative-source",
      },
      {
        id: "c",
        text: "mediante procedimento de avaliação periódica de desempenho, na forma de lei complementar, assegurada ampla defesa.",
        mutationKind: "literal",
      },
      {
        id: "d",
        text: "mediante procedimento de avaliação periódica de desempenho, na forma de lei complementar, assegurada defesa restrita.",
        mutationKind: "scope",
      },
    ],
    correctOptionId: "c",
    literalText:
      "mediante procedimento de avaliação periódica de desempenho, na forma de lei complementar, assegurada ampla defesa.",
    explanation:
      "O inciso III menciona avaliação periódica de desempenho, exige a forma de lei complementar e assegura ampla defesa.",
    difficulty: "medium",
    topic: "Perda do cargo do servidor estável",
    suggestedReviewDays: [1, 3, 7, 15, 30, 60],
  },
  {
    slug: "cf-art-84-ii-direcao-administracao-federal",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 84, II",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Assinale a alternativa que reproduz literalmente a atribuição prevista no art. 84, II, da Constituição Federal.",
    options: [
      {
        id: "a",
        text: "exercer, sem o auxílio dos Ministros de Estado, a direção superior da administração federal;",
        mutationKind: "negation",
      },
      {
        id: "b",
        text: "exercer, com o auxílio dos Ministros de Estado, a direção superior da administração federal;",
        mutationKind: "literal",
      },
      {
        id: "c",
        text: "exercer, com o auxílio dos Ministros de Estado, a direção superior da administração estadual;",
        mutationKind: "scope",
      },
      {
        id: "d",
        text: "exercer, com o auxílio dos Ministros de Estado, a direção normativa da administração federal;",
        mutationKind: "substitution",
      },
    ],
    correctOptionId: "b",
    literalText:
      "exercer, com o auxílio dos Ministros de Estado, a direção superior da administração federal;",
    explanation:
      "O inciso II atribui ao Presidente da República a direção superior da administração federal, exercida com o auxílio dos Ministros de Estado.",
    difficulty: "easy",
    topic: "Atribuições do Presidente da República",
    suggestedReviewDays: [1, 3, 7, 14, 30],
  },
  {
    slug: "cf-art-84-iv-sancao-decretos-regulamentos",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 84, IV",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Qual alternativa corresponde literalmente ao art. 84, IV, da Constituição Federal?",
    options: [
      {
        id: "a",
        text: "sancionar, promulgar e fazer publicar as leis, bem como expedir resoluções e regulamentos para sua fiel execução;",
        mutationKind: "substitution",
      },
      {
        id: "b",
        text: "sancionar, promulgar e fazer publicar as leis, bem como expedir decretos e regulamentos independentemente de sua execução;",
        mutationKind: "condition",
      },
      {
        id: "c",
        text: "sancionar e fazer publicar as leis, bem como expedir decretos e regulamentos para sua fiel execução;",
        mutationKind: "omission",
      },
      {
        id: "d",
        text: "sancionar, promulgar e fazer publicar as leis, bem como expedir decretos e regulamentos para sua fiel execução;",
        mutationKind: "literal",
      },
    ],
    correctOptionId: "d",
    literalText:
      "sancionar, promulgar e fazer publicar as leis, bem como expedir decretos e regulamentos para sua fiel execução;",
    explanation:
      "A redação reúne sancionar, promulgar e fazer publicar as leis, além de expedir decretos e regulamentos para sua fiel execução.",
    difficulty: "medium",
    topic: "Atribuições do Presidente da República",
    suggestedReviewDays: [1, 3, 7, 15, 30, 60],
  },
  {
    slug: "cf-art-144-caput-seguranca-publica",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 144, caput",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Assinale a única alternativa que reproduz literalmente o caput do art. 144 da Constituição Federal.",
    options: [
      {
        id: "a",
        text: "A segurança pública, dever de todos, direito e responsabilidade do Estado, é exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio, através dos seguintes órgãos:",
        mutationKind: "substitution",
      },
      {
        id: "b",
        text: "A segurança pública, dever do Estado, direito e responsabilidade de todos, é exercida para a preservação da ordem pública e do patrimônio, através dos seguintes órgãos:",
        mutationKind: "omission",
      },
      {
        id: "c",
        text: "A segurança pública, dever do Estado, direito e responsabilidade de todos, é exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio, através dos seguintes órgãos:",
        mutationKind: "literal",
      },
      {
        id: "d",
        text: "A segurança pública, dever do Estado, direito exclusivo dos agentes públicos e responsabilidade de todos, é exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio, através dos seguintes órgãos:",
        mutationKind: "scope",
      },
    ],
    correctOptionId: "c",
    literalText:
      "A segurança pública, dever do Estado, direito e responsabilidade de todos, é exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio, através dos seguintes órgãos:",
    explanation:
      "O caput qualifica a segurança pública como dever do Estado e como direito e responsabilidade de todos, com as finalidades descritas na alternativa correta.",
    difficulty: "medium",
    topic: "Segurança pública",
    suggestedReviewDays: [1, 3, 7, 15, 30, 60],
  },
  {
    slug: "cf-art-144-paragrafo-5-policias-bombeiros",
    legalAct: "Constituição da República Federativa do Brasil de 1988",
    articleRef: "Art. 144, § 5º",
    officialUrl: CONSTITUTION_OFFICIAL_URL,
    verifiedAt: "2026-08-16",
    prompt:
      "Qual alternativa reproduz literalmente o art. 144, § 5º, da Constituição Federal?",
    options: [
      {
        id: "a",
        text: "Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa civil.",
        mutationKind: "literal",
      },
      {
        id: "b",
        text: "Às polícias militares cabem a polícia judiciária e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa civil.",
        mutationKind: "substitution",
      },
      {
        id: "c",
        text: "Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa nacional.",
        mutationKind: "substitution",
      },
      {
        id: "d",
        text: "Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares incumbe exclusivamente a execução de atividades de defesa civil.",
        mutationKind: "scope",
      },
    ],
    correctOptionId: "a",
    literalText:
      "Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa civil.",
    explanation:
      "O § 5º atribui às polícias militares a polícia ostensiva e a preservação da ordem pública e, aos corpos de bombeiros militares, as atividades de defesa civil, além das atribuições legais.",
    difficulty: "hard",
    topic: "Órgãos e atribuições da segurança pública",
    suggestedReviewDays: [1, 2, 5, 10, 21, 45, 90],
  },
] as const satisfies readonly DemoQuestion[];
