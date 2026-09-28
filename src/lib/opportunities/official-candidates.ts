import type {
  BrazilianJurisdictionCode,
  QuizBankSlug,
  ResponsibleRole,
  ResponsibleType,
} from "@/lib/opportunities/domain";
import type { OfficialOpportunitySourceId } from "@/lib/opportunities/source-monitor-policy";

type IsoDate = `${number}-${number}-${number}`;

export type InternalOpportunitySourceCandidate = Readonly<{
  sourceId: OfficialOpportunitySourceId;
  publisher: string;
  url: string;
  documentType:
    | "authorization"
    | "organizer_contract"
    | "official_announcement"
    | "notice";
  status: "pending_review";
  sourcePolicy: "metadata_only";
  sourceContentStored: false;
}>;

export type InternalOrganizerSignal = Readonly<{
  organizationName: string;
  responsibleType: ResponsibleType;
  role: ResponsibleRole;
  quizBankSlug: QuizBankSlug | null;
  status: "pending_review";
  sourceUrl: string;
}>;

export type InternalOpportunityCandidate = Readonly<{
  slug: string;
  title: string;
  categorySlug: string;
  careerSlug: string;
  jurisdictionCode: BrazilianJurisdictionCode;
  scope: "national" | "federal" | "state" | "regional" | "municipal";
  cycleYear: number;
  institutionAcronym: string;
  institutionName: string;
  roleName: string;
  officialNoticeNumber: string | null;
  lifecycleStatus:
    | "authorized"
    | "pre_notice"
    | "notice_published"
    | "registration_open"
    | "registration_closed";
  statusAsOf: IsoDate;
  noticePublishedAt: IsoDate | null;
  registrationStartsAt: IsoDate | null;
  registrationEndsAt: IsoDate | null;
  examDate: IsoDate | null;
  summary: string;
  officialUrl: string;
  officialSources: readonly InternalOpportunitySourceCandidate[];
  organizerSignals: readonly InternalOrganizerSignal[];
  editorialStatus: "pending_review";
  indexable: false;
  sourcePolicy: "metadata_only";
  sourceContentStored: false;
}>;

function defineCandidate(candidate: InternalOpportunityCandidate): InternalOpportunityCandidate {
  return Object.freeze({
    ...candidate,
    officialSources: Object.freeze(candidate.officialSources.map((source) => Object.freeze(source))),
    organizerSignals: Object.freeze(
      candidate.organizerSignals.map((organizer) => Object.freeze(organizer)),
    ),
  });
}

const PENDING_SOURCE_POLICY = {
  status: "pending_review",
  sourcePolicy: "metadata_only",
  sourceContentStored: false,
} as const;

const INTERNAL_REVIEW_GATE = {
  editorialStatus: "pending_review",
  indexable: false,
  sourcePolicy: "metadata_only",
  sourceContentStored: false,
} as const;

const BANK_NOTICE_PAGES = {
  cebraspe: { sourceId: "cebraspe", publisher: "Cebraspe", organizationName: "Cebraspe" },
  fgv: {
    sourceId: "fgv-conhecimento",
    publisher: "FGV Conhecimento",
    organizationName: "Fundação Getulio Vargas",
  },
} as const;

/** Edital publicado na página da própria banca, que também executa o concurso. */
function bankNoticeCandidate(
  bank: keyof typeof BANK_NOTICE_PAGES,
  candidate: Omit<
    InternalOpportunityCandidate,
    "officialSources" | "organizerSignals" | keyof typeof INTERNAL_REVIEW_GATE
  >,
) {
  const page = BANK_NOTICE_PAGES[bank];
  return defineCandidate({
    ...candidate,
    officialSources: [
      {
        sourceId: page.sourceId,
        publisher: page.publisher,
        url: candidate.officialUrl,
        documentType: "notice",
        ...PENDING_SOURCE_POLICY,
      },
    ],
    organizerSignals: [
      {
        organizationName: page.organizationName,
        responsibleType: "external_organizer",
        role: "primary_responsible",
        quizBankSlug: bank,
        status: "pending_review",
        sourceUrl: candidate.officialUrl,
      },
    ],
    ...INTERNAL_REVIEW_GATE,
  });
}

/**
 * Discovery seeds verified against institutional pages on 2026-08-31. They are
 * deliberately not public content: every record and signal still requires an
 * independent human review before it can be copied to the editorial catalog.
 */
export const OFFICIAL_OPPORTUNITY_CANDIDATES = Object.freeze([
  defineCandidate({
    slug: "enam-2026-2",
    title: "6º Exame Nacional da Magistratura — ENAM 2026.2",
    categorySlug: "carreiras-juridicas",
    careerSlug: "magistratura",
    jurisdictionCode: "BR",
    scope: "national",
    cycleYear: 2026,
    institutionAcronym: "ENFAM",
    institutionName: "Escola Nacional de Formação e Aperfeiçoamento de Magistrados",
    roleName: "Habilitação nacional para concursos da magistratura",
    officialNoticeNumber: "02/2026",
    lifecycleStatus: "registration_open",
    statusAsOf: "2026-08-31",
    noticePublishedAt: "2026-08-24",
    registrationStartsAt: "2026-08-25",
    registrationEndsAt: "2026-09-24",
    examDate: "2026-11-29",
    summary:
      "Inscrições abertas até 24 de setembro de 2026, com prova objetiva prevista para 29 de novembro, segundo ENFAM e FGV.",
    officialUrl:
      "https://www.enfam.jus.br/publicado-o-edital-da-sexta-edicao-do-exame-nacional-da-magistratura/",
    officialSources: [
      {
        sourceId: "enfam",
        publisher: "Escola Nacional de Formação e Aperfeiçoamento de Magistrados",
        url: "https://www.enfam.jus.br/publicado-o-edital-da-sexta-edicao-do-exame-nacional-da-magistratura/",
        documentType: "official_announcement",
        ...PENDING_SOURCE_POLICY,
      },
      {
        sourceId: "fgv-conhecimento",
        publisher: "FGV Conhecimento",
        url: "https://conhecimento.fgv.br/exames/enam/6exame",
        documentType: "notice",
        ...PENDING_SOURCE_POLICY,
      },
    ],
    organizerSignals: [
      {
        organizationName: "Escola Nacional de Formação e Aperfeiçoamento de Magistrados",
        responsibleType: "institutional_commission",
        role: "primary_responsible",
        quizBankSlug: null,
        status: "pending_review",
        sourceUrl:
          "https://www.enfam.jus.br/publicado-o-edital-da-sexta-edicao-do-exame-nacional-da-magistratura/",
      },
      {
        organizationName: "Fundação Getulio Vargas",
        responsibleType: "external_organizer",
        role: "examination_provider",
        quizBankSlug: "fgv",
        status: "pending_review",
        sourceUrl: "https://conhecimento.fgv.br/exames/enam/6exame",
      },
    ],
    ...INTERNAL_REVIEW_GATE,
  }),
  defineCandidate({
    slug: "enac-2026-2",
    title: "4º Exame Nacional dos Cartórios — ENAC 2026.2",
    categorySlug: "cartorios",
    careerSlug: "cartorios",
    jurisdictionCode: "BR",
    scope: "national",
    cycleYear: 2026,
    institutionAcronym: "CNJ",
    institutionName: "Conselho Nacional de Justiça",
    roleName: "Habilitação nacional para concursos de cartórios",
    officialNoticeNumber: "02/2026",
    lifecycleStatus: "registration_open",
    statusAsOf: "2026-08-31",
    noticePublishedAt: "2026-08-28",
    registrationStartsAt: "2026-08-31",
    registrationEndsAt: "2026-09-29",
    examDate: "2026-11-22",
    summary:
      "Inscrições abertas até 29 de setembro de 2026, com prova objetiva prevista para 22 de novembro, segundo CNJ e FGV.",
    officialUrl:
      "https://www.cnj.jus.br/4o-exame-nacional-dos-cartorios-abre-inscricoes-nesta-segunda-feira-31-8/",
    officialSources: [
      {
        sourceId: "cnj",
        publisher: "Conselho Nacional de Justiça",
        url: "https://www.cnj.jus.br/4o-exame-nacional-dos-cartorios-abre-inscricoes-nesta-segunda-feira-31-8/",
        documentType: "official_announcement",
        ...PENDING_SOURCE_POLICY,
      },
      {
        sourceId: "fgv-conhecimento",
        publisher: "FGV Conhecimento",
        url: "https://conhecimento.fgv.br/exames/enac/4exame",
        documentType: "notice",
        ...PENDING_SOURCE_POLICY,
      },
    ],
    organizerSignals: [
      {
        organizationName: "Conselho Nacional de Justiça",
        responsibleType: "institutional_commission",
        role: "primary_responsible",
        quizBankSlug: null,
        status: "pending_review",
        sourceUrl:
          "https://www.cnj.jus.br/4o-exame-nacional-dos-cartorios-abre-inscricoes-nesta-segunda-feira-31-8/",
      },
      {
        organizationName: "Fundação Getulio Vargas",
        responsibleType: "external_organizer",
        role: "examination_provider",
        quizBankSlug: "fgv",
        status: "pending_review",
        sourceUrl: "https://conhecimento.fgv.br/exames/enac/4exame",
      },
    ],
    ...INTERNAL_REVIEW_GATE,
  }),
  defineCandidate({
    slug: "pc-ba-2026",
    title: "Polícia Civil da Bahia — concurso autorizado em 2026",
    categorySlug: "carreiras-policiais",
    careerSlug: "policia-civil",
    jurisdictionCode: "BA",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "PC-BA",
    institutionName: "Polícia Civil do Estado da Bahia",
    roleName: "Delegado, escrivão e investigador",
    officialNoticeNumber: null,
    lifecycleStatus: "authorized",
    statusAsOf: "2026-08-31",
    noticePublishedAt: null,
    registrationStartsAt: null,
    registrationEndsAt: null,
    examDate: null,
    summary:
      "O certame está autorizado para 750 vagas — 100 para delegado, 150 para escrivão e 500 para investigador —; edital, cronograma e organizadora ainda aguardam publicação oficial.",
    officialUrl:
      "https://www.ba.gov.br/ssp/sites/site-ssp/files/2026-05/Relatorio_de_Gestao_2025___rev.final___consolidado___2026.04.23.pdf",
    officialSources: [
      {
        sourceId: "governo-bahia",
        publisher: "Secretaria da Segurança Pública da Bahia",
        url: "https://www.ba.gov.br/ssp/sites/site-ssp/files/2026-05/Relatorio_de_Gestao_2025___rev.final___consolidado___2026.04.23.pdf",
        documentType: "authorization",
        ...PENDING_SOURCE_POLICY,
      },
    ],
    organizerSignals: [],
    ...INTERNAL_REVIEW_GATE,
  }),
  defineCandidate({
    slug: "pc-ma-2026",
    title: "Polícia Civil do Maranhão — concurso anunciado em 2026",
    categorySlug: "carreiras-policiais",
    careerSlug: "policia-civil",
    jurisdictionCode: "MA",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "PC-MA",
    institutionName: "Polícia Civil do Estado do Maranhão",
    roleName: "Cargos policiais a confirmar em edital",
    officialNoticeNumber: null,
    lifecycleStatus: "pre_notice",
    statusAsOf: "2026-08-31",
    noticePublishedAt: null,
    registrationStartsAt: null,
    registrationEndsAt: null,
    examDate: null,
    summary:
      "O Governo do Maranhão anunciou novo concurso com 415 vagas; edital, distribuição por cargo, cronograma e organizadora ainda aguardam publicação oficial.",
    officialUrl:
      "https://www.policiacivil.ma.gov.br/policia-civil-participa-de-solenidade-de-promocao-de-integrantes-da-policia-militar-e-do-corpo-de-bombeiros-do-maranhao/",
    officialSources: [
      {
        sourceId: "policia-civil-maranhao",
        publisher: "Polícia Civil do Estado do Maranhão",
        url: "https://www.policiacivil.ma.gov.br/policia-civil-participa-de-solenidade-de-promocao-de-integrantes-da-policia-militar-e-do-corpo-de-bombeiros-do-maranhao/",
        documentType: "official_announcement",
        ...PENDING_SOURCE_POLICY,
      },
    ],
    organizerSignals: [],
    ...INTERNAL_REVIEW_GATE,
  }),
  defineCandidate({
    slug: "pc-pr-2026",
    title: "Polícia Civil do Paraná — concurso 2026",
    categorySlug: "carreiras-policiais",
    careerSlug: "policia-civil",
    jurisdictionCode: "PR",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "PC-PR",
    institutionName: "Polícia Civil do Estado do Paraná",
    roleName: "Delegado, agente de polícia judiciária e papiloscopista",
    officialNoticeNumber: "01/2026",
    lifecycleStatus: "registration_closed",
    statusAsOf: "2026-08-31",
    noticePublishedAt: "2026-07-06",
    registrationStartsAt: "2026-07-14",
    registrationEndsAt: "2026-08-12",
    examDate: "2026-10-11",
    summary:
      "O Edital nº 01/2026, executado pela FGV, prevê cadastro de reserva para delegado, agente de polícia judiciária e papiloscopista, com prova objetiva em 11 de outubro.",
    officialUrl: "https://conhecimento.fgv.br/concursos/pcpr26",
    officialSources: [
      {
        sourceId: "fgv-conhecimento",
        publisher: "FGV Conhecimento",
        url: "https://conhecimento.fgv.br/concursos/pcpr26",
        documentType: "notice",
        ...PENDING_SOURCE_POLICY,
      },
    ],
    organizerSignals: [
      {
        organizationName: "Fundação Getulio Vargas",
        responsibleType: "external_organizer",
        role: "primary_responsible",
        quizBankSlug: "fgv",
        status: "pending_review",
        sourceUrl: "https://conhecimento.fgv.br/concursos/pcpr26",
      },
    ],
    ...INTERNAL_REVIEW_GATE,
  }),
  defineCandidate({
    slug: "pgm-manaus-2026",
    title: "PGM Manaus 2026 — Procurador do Município",
    categorySlug: "procuradorias",
    careerSlug: "procurador",
    jurisdictionCode: "AM",
    scope: "municipal",
    cycleYear: 2026,
    institutionAcronym: "PGM-MANAUS",
    institutionName: "Procuradoria-Geral do Município de Manaus",
    roleName: "Procurador do Município de 3ª Classe",
    officialNoticeNumber: "01/2026",
    lifecycleStatus: "registration_closed",
    statusAsOf: "2026-08-31",
    noticePublishedAt: "2026-07-02",
    registrationStartsAt: "2026-07-06",
    registrationEndsAt: "2026-08-04",
    examDate: "2026-09-20",
    summary:
      "O Edital nº 01/2026 oferece seis vagas para Procurador do Município de 3ª Classe, com execução da FCC e prova objetiva em 20 de setembro.",
    officialUrl:
      "https://www.manaus.am.gov.br/noticia/edital/concurso-publico-com-vagas-para-procurador-do-municipio/",
    officialSources: [
      {
        sourceId: "prefeitura-manaus",
        publisher: "Prefeitura de Manaus",
        url: "https://www.manaus.am.gov.br/noticia/edital/concurso-publico-com-vagas-para-procurador-do-municipio/",
        documentType: "official_announcement",
        ...PENDING_SOURCE_POLICY,
      },
      {
        sourceId: "fcc-concursos",
        publisher: "Fundação Carlos Chagas",
        url: "https://www.concursosfcc.com.br/concursos/pgmam126/index.html",
        documentType: "notice",
        ...PENDING_SOURCE_POLICY,
      },
    ],
    organizerSignals: [
      {
        organizationName: "Fundação Carlos Chagas",
        responsibleType: "external_organizer",
        role: "primary_responsible",
        quizBankSlug: "fcc",
        status: "pending_review",
        sourceUrl: "https://www.concursosfcc.com.br/concursos/pgmam126/index.html",
      },
    ],
    ...INTERNAL_REVIEW_GATE,
  }),
  // Editais ativos conferidos em 28/09/2026 nas páginas oficiais da FGV e da
  // Cebraspe (cabeçalho, cronograma e data de assinatura de cada edital).
  bankNoticeCandidate("fgv", {
    slug: "trf-5-juiz-federal-2026",
    title: "TRF-5 — XVI Concurso para Juiz Federal Substituto",
    categorySlug: "carreiras-juridicas",
    careerSlug: "magistratura",
    // Sede em Pernambuco; mesma convenção da prova anterior registrada.
    jurisdictionCode: "PE",
    scope: "regional",
    cycleYear: 2026,
    institutionAcronym: "TRF-5",
    institutionName: "Tribunal Regional Federal da 5ª Região",
    roleName: "Juiz Federal Substituto",
    officialNoticeNumber: "01/2026",
    lifecycleStatus: "registration_open",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-08-17",
    registrationStartsAt: "2026-08-28",
    registrationEndsAt: "2026-09-28",
    examDate: "2026-12-20",
    summary:
      "O XVI Concurso, executado pela FGV pelo Edital nº 01/2026 (retificado em 17/09/2026), recebe inscrições até 28 de setembro e prevê a prova objetiva seletiva em 20 de dezembro de 2026.",
    officialUrl: "https://conhecimento.fgv.br/concursos/trf5juiz26",
  }),
  bankNoticeCandidate("fgv", {
    slug: "tj-rs-juiz-2026",
    title: "TJ-RS — Concurso para Juiz de Direito Substituto 2026",
    categorySlug: "carreiras-juridicas",
    careerSlug: "magistratura",
    jurisdictionCode: "RS",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "TJ-RS",
    institutionName: "Tribunal de Justiça do Estado do Rio Grande do Sul",
    roleName: "Juiz de Direito Substituto",
    officialNoticeNumber: "0031/2026-DMAG",
    lifecycleStatus: "registration_open",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-08-27",
    registrationStartsAt: "2026-09-15",
    registrationEndsAt: "2026-10-14",
    examDate: "2026-12-13",
    summary:
      "O Edital nº 0031/2026-DMAG, executado pela FGV, recebe inscrições de 15 de setembro a 14 de outubro e prevê a prova objetiva seletiva em 13 de dezembro de 2026.",
    officialUrl: "https://conhecimento.fgv.br/concursos/tjrsjuiz26",
  }),
  bankNoticeCandidate("cebraspe", {
    slug: "pc-al-2026",
    title: "Polícia Civil de Alagoas — Agente e Escrivão 2026",
    categorySlug: "carreiras-policiais",
    careerSlug: "policia-civil",
    jurisdictionCode: "AL",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "PC-AL",
    institutionName: "Polícia Civil do Estado de Alagoas",
    roleName: "Agente de Polícia Civil e Escrivão de Polícia Civil",
    officialNoticeNumber: "1/2026",
    lifecycleStatus: "registration_closed",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-07-02",
    registrationStartsAt: "2026-08-03",
    registrationEndsAt: "2026-09-11",
    examDate: "2026-12-06",
    summary:
      "O Edital nº 1 – PC/AL, de 2 de julho de 2026, executado pelo Cebraspe, prevê as provas objetivas e a discursiva em 6 de dezembro de 2026 para agente e escrivão.",
    officialUrl: "https://www.cebraspe.org.br/concursos/PC_AL_26",
  }),
  bankNoticeCandidate("cebraspe", {
    slug: "pc-ma-delegado-2026",
    title: "Polícia Civil do Maranhão — Delegado 2026",
    categorySlug: "carreiras-policiais",
    careerSlug: "delegado",
    jurisdictionCode: "MA",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "PC-MA",
    institutionName: "Polícia Civil do Estado do Maranhão",
    roleName: "Delegado de Polícia Civil – 3ª Classe",
    officialNoticeNumber: "1/2026",
    lifecycleStatus: "registration_closed",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-07-13",
    registrationStartsAt: "2026-07-20",
    registrationEndsAt: "2026-08-13",
    examDate: "2026-11-01",
    summary:
      "O Edital nº 1 – PCMA – Delegado, de 13 de julho de 2026, executado pelo Cebraspe, prevê a prova objetiva em 1º de novembro de 2026.",
    officialUrl: "https://www.cebraspe.org.br/concursos/PC_MA_26_DELEGADO",
  }),
  bankNoticeCandidate("cebraspe", {
    slug: "pc-ma-investigador-2026",
    title: "Polícia Civil do Maranhão — Investigador 2026",
    categorySlug: "carreiras-policiais",
    careerSlug: "policia-civil",
    jurisdictionCode: "MA",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "PC-MA",
    institutionName: "Polícia Civil do Estado do Maranhão",
    roleName: "Investigador de Polícia",
    officialNoticeNumber: "1/2026",
    lifecycleStatus: "registration_closed",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-07-13",
    registrationStartsAt: "2026-07-24",
    registrationEndsAt: "2026-08-24",
    examDate: "2026-12-06",
    summary:
      "O Edital nº 1 – PCMA – Investigador, de 13 de julho de 2026, executado pelo Cebraspe, prevê as provas objetiva e discursiva em 6 de dezembro de 2026.",
    officialUrl: "https://www.cebraspe.org.br/concursos/PC_MA_26_INVESTIGADOR",
  }),
  bankNoticeCandidate("cebraspe", {
    slug: "seap-ma-inspetor-2026",
    title: "SEAP-MA — Inspetor de Polícia Penal 2026",
    categorySlug: "carreiras-policiais",
    careerSlug: "policia-penal",
    jurisdictionCode: "MA",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "SEAP-MA",
    institutionName: "Secretaria de Estado de Administração Penitenciária do Maranhão",
    roleName: "Inspetor de Polícia Penal",
    officialNoticeNumber: "1/2026",
    lifecycleStatus: "registration_closed",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-07-21",
    registrationStartsAt: "2026-07-30",
    registrationEndsAt: "2026-08-31",
    examDate: "2026-12-13",
    summary:
      "O Edital nº 1 – SEAP/MA – Inspetor e Monitor, de 21 de julho de 2026, executado pelo Cebraspe, prevê as provas objetivas e a discursiva em 13 de dezembro de 2026.",
    officialUrl: "https://www.cebraspe.org.br/concursos/SEAP_MA_26_INSPETOR_MONITOR",
  }),
  bankNoticeCandidate("cebraspe", {
    slug: "sefaz-al-auditor-fiscal-2026",
    title: "SEFAZ-AL — Auditor Fiscal 2026",
    categorySlug: "fiscal-e-controle",
    careerSlug: "auditor-fiscal",
    jurisdictionCode: "AL",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "SEFAZ-AL",
    institutionName: "Secretaria de Estado da Fazenda de Alagoas",
    roleName: "Auditor Fiscal da Administração Tributária Estadual",
    officialNoticeNumber: "1/2026",
    lifecycleStatus: "registration_open",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-08-24",
    registrationStartsAt: "2026-09-17",
    registrationEndsAt: "2026-10-21",
    examDate: "2026-12-20",
    summary:
      "O Edital nº 1 – SEFAZ/AL, de 24 de agosto de 2026, executado pelo Cebraspe, recebe inscrições de 17 de setembro a 21 de outubro e prevê as provas objetivas em 20 de dezembro de 2026.",
    officialUrl: "https://www.cebraspe.org.br/concursos/SEFAZ_AL_26",
  }),
  bankNoticeCandidate("cebraspe", {
    slug: "tce-ma-2026",
    title: "TCE-MA — Controle Externo 2026",
    categorySlug: "fiscal-e-controle",
    careerSlug: "controle-externo",
    jurisdictionCode: "MA",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "TCE-MA",
    institutionName: "Tribunal de Contas do Estado do Maranhão",
    roleName: "Analista Estadual de Apoio ao Controle Externo e Técnico Estadual de Controle Externo",
    officialNoticeNumber: "1/2026",
    lifecycleStatus: "registration_closed",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-07-06",
    registrationStartsAt: "2026-07-17",
    registrationEndsAt: "2026-08-21",
    examDate: "2026-11-22",
    summary:
      "O Edital nº 1 – TCE/MA, de 6 de julho de 2026, executado pelo Cebraspe, prevê as provas em 22 de novembro (analista) e 29 de novembro de 2026 (auditor e técnico).",
    officialUrl: "https://www.cebraspe.org.br/concursos/TCE_MA_26",
  }),
  bankNoticeCandidate("cebraspe", {
    slug: "tc-df-analista-2026",
    title: "TC-DF — Analista Administrativo de Controle Externo 2026",
    categorySlug: "fiscal-e-controle",
    careerSlug: "controle-externo",
    jurisdictionCode: "DF",
    scope: "state",
    cycleYear: 2026,
    institutionAcronym: "TC-DF",
    institutionName: "Tribunal de Contas do Distrito Federal",
    roleName: "Analista Administrativo de Controle Externo",
    officialNoticeNumber: "1/2026",
    lifecycleStatus: "registration_closed",
    statusAsOf: "2026-09-28",
    noticePublishedAt: "2026-07-08",
    registrationStartsAt: "2026-08-26",
    registrationEndsAt: "2026-09-17",
    examDate: "2026-11-22",
    summary:
      "O Edital nº 1 – TCDF/ANACE, de 8 de julho de 2026, executado pelo Cebraspe, prevê as provas objetivas e a discursiva em 22 de novembro de 2026.",
    officialUrl: "https://www.cebraspe.org.br/concursos/TC_DF_26_ANALISTA",
  }),
] satisfies readonly InternalOpportunityCandidate[]);

export function getOfficialOpportunityCandidate(slug: string) {
  return OFFICIAL_OPPORTUNITY_CANDIDATES.find((candidate) => candidate.slug === slug) ?? null;
}
