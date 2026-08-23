export type QuizBankSlug = "vunesp" | "fgv" | "fcc" | "cebraspe";

export type QuizModeSlug = "dry_law" | "previous_exam" | "original_style";

export type QuizExperience = "training" | "exam";

export type QuizCareerSpecialization = {
  readonly slug: string;
  readonly name: string;
};

export type QuizBank = {
  readonly slug: QuizBankSlug;
  readonly name: string;
  readonly fullName: string;
};

export type QuizTopic = {
  readonly slug: string;
  readonly name: string;
};

export type QuizSubject = {
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
  readonly topics: readonly QuizTopic[];
};

export type QuizCareerTrack = {
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly featured: boolean;
  readonly specializations: readonly QuizCareerSpecialization[];
  readonly subjectSlugs: readonly string[];
};

export type QuizMode = {
  readonly slug: QuizModeSlug;
  readonly name: string;
  readonly description: string;
};

export const quizBanks = [
  {
    slug: "vunesp",
    name: "VUNESP",
    fullName: "Fundação para o Vestibular da Universidade Estadual Paulista",
  },
  {
    slug: "fgv",
    name: "FGV",
    fullName: "Fundação Getulio Vargas",
  },
  {
    slug: "fcc",
    name: "FCC",
    fullName: "Fundação Carlos Chagas",
  },
  {
    slug: "cebraspe",
    name: "CEBRASPE",
    fullName: "Centro Brasileiro de Pesquisa em Avaliação e Seleção e de Promoção de Eventos",
  },
] as const satisfies readonly QuizBank[];

export const quizSubjects = [
  {
    slug: "direito-constitucional",
    name: "Direito Constitucional",
    shortName: "Constitucional",
    topics: [
      { slug: "direitos-e-garantias-fundamentais", name: "Direitos e garantias fundamentais" },
      { slug: "administracao-publica", name: "Administração pública" },
      { slug: "poder-executivo", name: "Poder Executivo" },
      { slug: "seguranca-publica", name: "Segurança pública" },
    ],
  },
  {
    slug: "direito-administrativo",
    name: "Direito Administrativo",
    shortName: "Administrativo",
    topics: [
      { slug: "atos-administrativos", name: "Atos administrativos" },
      { slug: "agentes-publicos", name: "Agentes públicos" },
      { slug: "licitacoes-e-contratos", name: "Licitações e contratos" },
    ],
  },
  {
    slug: "direito-civil",
    name: "Direito Civil",
    shortName: "Civil",
    topics: [
      { slug: "parte-geral", name: "Parte geral" },
      { slug: "obrigacoes", name: "Obrigações" },
      { slug: "contratos", name: "Contratos" },
      { slug: "responsabilidade-civil", name: "Responsabilidade civil" },
      { slug: "familia-e-sucessoes", name: "Família e sucessões" },
    ],
  },
  {
    slug: "processo-civil",
    name: "Direito Processual Civil",
    shortName: "Processo Civil",
    topics: [
      { slug: "parte-geral", name: "Parte geral" },
      { slug: "procedimento-comum", name: "Procedimento comum" },
      { slug: "recursos", name: "Recursos" },
      { slug: "execucao", name: "Execução" },
    ],
  },
  {
    slug: "direito-penal",
    name: "Direito Penal",
    shortName: "Penal",
    topics: [
      { slug: "parte-geral", name: "Parte geral" },
      { slug: "crimes-contra-a-pessoa", name: "Crimes contra a pessoa" },
      { slug: "crimes-contra-o-patrimonio", name: "Crimes contra o patrimônio" },
      { slug: "crimes-contra-a-administracao", name: "Crimes contra a Administração Pública" },
    ],
  },
  {
    slug: "processo-penal",
    name: "Direito Processual Penal",
    shortName: "Processo Penal",
    topics: [
      { slug: "inquerito-policial", name: "Inquérito policial" },
      { slug: "acao-penal", name: "Ação penal" },
      { slug: "provas", name: "Provas" },
      { slug: "prisoes-e-medidas-cautelares", name: "Prisões e medidas cautelares" },
    ],
  },
  {
    slug: "direito-do-trabalho",
    name: "Direito do Trabalho",
    shortName: "Trabalho",
    topics: [
      { slug: "relacao-de-emprego", name: "Relação de emprego" },
      { slug: "contrato-de-trabalho", name: "Contrato de trabalho" },
      { slug: "duracao-do-trabalho", name: "Duração do trabalho" },
    ],
  },
  {
    slug: "processo-do-trabalho",
    name: "Direito Processual do Trabalho",
    shortName: "Processo do Trabalho",
    topics: [
      { slug: "competencia", name: "Competência" },
      { slug: "procedimentos", name: "Procedimentos" },
      { slug: "recursos", name: "Recursos" },
    ],
  },
  {
    slug: "direito-tributario",
    name: "Direito Tributário",
    shortName: "Tributário",
    topics: [
      { slug: "sistema-tributario-nacional", name: "Sistema Tributário Nacional" },
      { slug: "obrigacao-tributaria", name: "Obrigação tributária" },
      { slug: "credito-tributario", name: "Crédito tributário" },
    ],
  },
  {
    slug: "direitos-humanos",
    name: "Direitos Humanos",
    shortName: "Direitos Humanos",
    topics: [
      { slug: "sistema-global", name: "Sistema global" },
      { slug: "sistema-interamericano", name: "Sistema interamericano" },
      { slug: "direitos-fundamentais", name: "Direitos fundamentais" },
    ],
  },
  {
    slug: "direito-empresarial",
    name: "Direito Empresarial",
    shortName: "Empresarial",
    topics: [
      { slug: "empresario-e-sociedades", name: "Empresário e sociedades" },
      { slug: "titulos-de-credito", name: "Títulos de crédito" },
      { slug: "recuperacao-e-falencia", name: "Recuperação e falência" },
    ],
  },
  {
    slug: "direito-eleitoral",
    name: "Direito Eleitoral",
    shortName: "Eleitoral",
    topics: [
      { slug: "direitos-politicos", name: "Direitos políticos" },
      { slug: "partidos-politicos", name: "Partidos políticos" },
      { slug: "processo-eleitoral", name: "Processo eleitoral" },
    ],
  },
  {
    slug: "legislacao-especial",
    name: "Legislação Especial",
    shortName: "Legislação Especial",
    topics: [
      { slug: "estatutos", name: "Estatutos" },
      { slug: "leis-penais-especiais", name: "Leis penais especiais" },
      { slug: "normas-institucionais", name: "Normas institucionais" },
    ],
  },
] as const satisfies readonly QuizSubject[];

const allSubjectSlugs = quizSubjects.map((subject) => subject.slug);
const corePublicSubjectSlugs = [
  "direito-constitucional",
  "direito-administrativo",
  "direito-civil",
  "processo-civil",
  "direito-penal",
  "processo-penal",
  "direitos-humanos",
  "legislacao-especial",
] as const;

export const quizCareerTracks = [
  {
    slug: "defensor-publico",
    name: "Defensor Público",
    shortName: "Defensoria",
    description: "Preparação para Defensorias Públicas estaduais e federal.",
    featured: false,
    specializations: [],
    subjectSlugs: [...corePublicSubjectSlugs, "direito-tributario", "direito-empresarial"],
  },
  {
    slug: "analista",
    name: "Analista",
    shortName: "Analista",
    description: "Trilhas jurídicas e administrativas para cargos de analista.",
    featured: false,
    specializations: [],
    subjectSlugs: allSubjectSlugs,
  },
  {
    slug: "analista-juridico",
    name: "Analista Jurídico",
    shortName: "Analista Jurídico",
    description: "Conteúdo jurídico aprofundado para carreiras de analista.",
    featured: false,
    specializations: [],
    subjectSlugs: allSubjectSlugs,
  },
  {
    slug: "promotor-justica",
    name: "Promotor de Justiça",
    shortName: "Promotoria",
    description: "Preparação para concursos do Ministério Público.",
    featured: false,
    specializations: [],
    subjectSlugs: allSubjectSlugs,
  },
  {
    slug: "magistratura",
    name: "Magistratura",
    shortName: "Magistratura",
    description: "Preparação separada por Justiça Federal, Estadual e do Trabalho.",
    featured: false,
    specializations: [
      { slug: "federal", name: "Magistratura Federal" },
      { slug: "estadual", name: "Magistratura Estadual" },
      { slug: "trabalho", name: "Magistratura do Trabalho" },
    ],
    subjectSlugs: allSubjectSlugs,
  },
  {
    slug: "tecnico-judiciario",
    name: "Técnico Judiciário",
    shortName: "Técnico Judiciário",
    description: "Base jurídica para tribunais e órgãos do sistema de Justiça.",
    featured: false,
    specializations: [],
    subjectSlugs: [
      "direito-constitucional",
      "direito-administrativo",
      "direito-civil",
      "processo-civil",
      "direito-penal",
      "processo-penal",
      "legislacao-especial",
    ],
  },
  {
    slug: "delegado",
    name: "Delegado",
    shortName: "Delegado",
    description: "Preparação jurídica para concursos de Delegado de Polícia.",
    featured: false,
    specializations: [],
    subjectSlugs: corePublicSubjectSlugs,
  },
  {
    slug: "policia-civil",
    name: "Polícia Civil",
    shortName: "Polícia Civil",
    description: "Trilhas para os diferentes cargos das Polícias Civis.",
    featured: false,
    specializations: [],
    subjectSlugs: corePublicSubjectSlugs,
  },
  {
    slug: "policia-federal",
    name: "Polícia Federal",
    shortName: "Polícia Federal",
    description: "Trilha prioritária para os cargos da Polícia Federal.",
    featured: true,
    specializations: [],
    subjectSlugs: [...corePublicSubjectSlugs, "direito-tributario", "direito-empresarial"],
  },
  {
    slug: "oab",
    name: "OAB",
    shortName: "OAB",
    description: "Revisão objetiva para o Exame de Ordem.",
    featured: false,
    specializations: [],
    subjectSlugs: allSubjectSlugs,
  },
  {
    slug: "oficial-promotoria",
    name: "Oficial da Promotoria",
    shortName: "Oficial da Promotoria",
    description: "Preparação direcionada aos quadros de apoio do Ministério Público.",
    featured: false,
    specializations: [],
    subjectSlugs: corePublicSubjectSlugs,
  },
  {
    slug: "oficial-justica",
    name: "Oficial de Justiça",
    shortName: "Oficial de Justiça",
    description: "Conteúdo jurídico para carreiras de cumprimento de mandados.",
    featured: false,
    specializations: [],
    subjectSlugs: [
      "direito-constitucional",
      "direito-administrativo",
      "direito-civil",
      "processo-civil",
      "direito-penal",
      "processo-penal",
      "legislacao-especial",
    ],
  },
  {
    slug: "escrivao-policia-civil",
    name: "Escrivão de Polícia Civil",
    shortName: "Escrivão PC",
    description: "Preparação específica para Escrivão de Polícia Civil.",
    featured: false,
    specializations: [],
    subjectSlugs: corePublicSubjectSlugs,
  },
] as const satisfies readonly QuizCareerTrack[];

export const quizModes = [
  {
    slug: "dry_law",
    name: "Lei seca",
    description: "Treino autoral de literalidade com base em fonte oficial verificada.",
  },
  {
    slug: "previous_exam",
    name: "Questões anteriores",
    description: "Questões de provas anteriores exibidas somente quando houver licença e procedência registradas.",
  },
  {
    slug: "original_style",
    name: "Questões inéditas",
    description: "Questões originais revisadas e classificadas pelo estilo da banca, sem prometer geração ao vivo.",
  },
] as const satisfies readonly QuizMode[];

export function getCareerBySlug(slug: string) {
  return quizCareerTracks.find((career) => career.slug === slug);
}

export function getSubjectsForCareer(careerSlug: string) {
  const career = getCareerBySlug(careerSlug);
  if (!career) return [];
  const allowed = new Set<string>(career.subjectSlugs);
  return quizSubjects.filter((subject) => allowed.has(subject.slug));
}
