import { parseOfficialExamUrl } from "@/lib/official-sources/exam-registry";

export type AvailableExamDocument = Readonly<{
  documentType: "question_booklet" | "answer_key";
  title: string;
  sourceUrl: string;
  fileName: string;
  expectedQuestionCount: number | null;
}>;

export type AvailableExamEdition = Readonly<{
  publicId: string;
  sourceExternalId: string;
  careerSlug: string;
  bankSlug: "fgv" | "fcc";
  institutionAcronym: "ENFAM" | "CNJ" | "PC-PR" | "PGM-MANAUS";
  jurisdictionCode: "BR" | "PR" | "AM";
  title: string;
  organizer: string;
  jurisdiction: string;
  officialUrl: string;
  examDate: string;
  durationMinutes: number | null;
  status: "scheduled" | "published";
  opportunitySlug?: string;
  productSlugs?: readonly string[];
  documents: readonly AvailableExamDocument[];
}>;

export const AVAILABLE_REAL_EXAM_EDITIONS = [
  {
    publicId: "enac-2026-2",
    sourceExternalId: "enac-4exame-2026-2",
    careerSlug: "cartorios",
    bankSlug: "fgv",
    institutionAcronym: "CNJ",
    jurisdictionCode: "BR",
    title: "4º Exame Nacional dos Cartórios — ENAC 2026.2",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Brasil",
    officialUrl: "https://conhecimento.fgv.br/exames/enac/4exame",
    examDate: "2026-11-22",
    durationMinutes: 300,
    status: "scheduled",
    opportunitySlug: "enac-2026-2",
    productSlugs: ["enac-exame-nacional-dos-cartorios-2026-2"],
    documents: [],
  },
  {
    publicId: "enam-2026-2",
    sourceExternalId: "enam-6exame-2026-2",
    careerSlug: "magistratura",
    bankSlug: "fgv",
    institutionAcronym: "ENFAM",
    jurisdictionCode: "BR",
    title: "6º Exame Nacional da Magistratura — ENAM 2026.2",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Brasil",
    officialUrl: "https://conhecimento.fgv.br/exames/enam/6exame",
    examDate: "2026-11-29",
    durationMinutes: 300,
    status: "scheduled",
    opportunitySlug: "enam-2026-2",
    productSlugs: ["enam-exame-nacional-da-magistratura-2026-2"],
    documents: [],
  },
  {
    publicId: "pc-pr-2026",
    sourceExternalId: "pcpr26",
    careerSlug: "policia-civil",
    bankSlug: "fgv",
    institutionAcronym: "PC-PR",
    jurisdictionCode: "PR",
    title: "Polícia Civil do Paraná — Concurso 2026",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Paraná",
    officialUrl: "https://conhecimento.fgv.br/concursos/pcpr26",
    examDate: "2026-10-11",
    durationMinutes: 300,
    status: "scheduled",
    opportunitySlug: "pc-pr-2026",
    productSlugs: ["pc-pr-delegado-2026", "pc-pr-agente-2026"],
    documents: [],
  },
  {
    publicId: "pgm-manaus-2026",
    sourceExternalId: "pgmam126",
    careerSlug: "procurador",
    bankSlug: "fcc",
    institutionAcronym: "PGM-MANAUS",
    jurisdictionCode: "AM",
    title: "PGM Manaus 2026 — Procurador do Município de 3ª Classe",
    organizer: "Fundação Carlos Chagas",
    jurisdiction: "Amazonas",
    officialUrl: "https://www.concursosfcc.com.br/concursos/pgmam126/index.html",
    examDate: "2026-09-20",
    durationMinutes: null,
    status: "scheduled",
    opportunitySlug: "pgm-manaus-2026",
    productSlugs: ["pgm-manaus-procurador-do-municipio-2026"],
    documents: [],
  },
  {
    publicId: "enac-2026-1",
    sourceExternalId: "enac-3exame-2026-1-tipo-1",
    careerSlug: "cartorios",
    bankSlug: "fgv",
    institutionAcronym: "CNJ",
    jurisdictionCode: "BR",
    title: "3º Exame Nacional dos Cartórios — ENAC 2026.1",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Brasil",
    officialUrl: "https://conhecimento.fgv.br/exames/enac/3exame",
    examDate: "2026-06-14",
    durationMinutes: 300,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "ENAC 2026.1 — Tipo 1 — caderno de questões",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/enac-2026-1-enac-2026-1-tipo-1-2.pdf",
        fileName: "enac-2026-1-tipo-1.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "ENAC 2026.1 — gabarito definitivo",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/gabarito-definitivo-enac-2026.1.pdf",
        fileName: "gabarito-definitivo-enac-2026.1.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "enam-2026-1",
    sourceExternalId: "enam-5exame-2026-1-tipo-1",
    careerSlug: "magistratura",
    bankSlug: "fgv",
    institutionAcronym: "ENFAM",
    jurisdictionCode: "BR",
    title: "5º Exame Nacional da Magistratura — ENAM 2026.1",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Brasil",
    officialUrl: "https://conhecimento.fgv.br/exames/enam/5exame",
    examDate: "2026-06-07",
    durationMinutes: 300,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "ENAM 2026.1 — Tipo 1 — caderno de questões",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/magistratura-cns001-tipo-1.pdf",
        fileName: "enam-2026.1-tipo-1.pdf",
        expectedQuestionCount: 80,
      },
      {
        documentType: "answer_key",
        title: "ENAM 2026.1 — gabarito definitivo",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/enam-exame-nacional-de-magistratura-2026.1.pdf",
        fileName: "gabarito-definitivo-enam-2026.1.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
] as const satisfies readonly AvailableExamEdition[];

export function validateAvailableRealExamEditions(
  editions: readonly AvailableExamEdition[] = AVAILABLE_REAL_EXAM_EDITIONS,
) {
  const publicIds = new Set<string>();
  const sourceIds = new Set<string>();
  const products = new Set<string>();
  for (const edition of editions) {
    if (publicIds.has(edition.publicId)) throw new Error(`Edição duplicada: ${edition.publicId}.`);
    if (sourceIds.has(`${edition.bankSlug}:${edition.sourceExternalId}`)) throw new Error(`Fonte duplicada: ${edition.sourceExternalId}.`);
    publicIds.add(edition.publicId);
    sourceIds.add(`${edition.bankSlug}:${edition.sourceExternalId}`);
    parseOfficialExamUrl(edition.bankSlug, edition.officialUrl);
    if (edition.status === "scheduled" && (!edition.opportunitySlug || !edition.productSlugs?.length)) {
      throw new Error(`Edição futura sem oportunidade/produto: ${edition.publicId}.`);
    }
    for (const productSlug of edition.productSlugs ?? []) {
      if (products.has(productSlug)) throw new Error(`Produto duplicado: ${productSlug}.`);
      products.add(productSlug);
    }
    for (const document of edition.documents) {
      parseOfficialExamUrl(edition.bankSlug, document.sourceUrl);
      if ((document.documentType === "question_booklet") !== (document.expectedQuestionCount !== null)) {
        throw new Error(`Quantidade incompatível no documento ${document.title}.`);
      }
    }
  }
  return editions;
}
