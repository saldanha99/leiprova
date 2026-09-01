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
] satisfies readonly InternalOpportunityCandidate[]);

export function getOfficialOpportunityCandidate(slug: string) {
  return OFFICIAL_OPPORTUNITY_CANDIDATES.find((candidate) => candidate.slug === slug) ?? null;
}
