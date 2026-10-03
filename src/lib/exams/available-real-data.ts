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
  bankSlug: "fgv" | "fcc" | "cebraspe" | "faurgs";
  // Validados em validateAvailableRealExamEditions contra as mesmas regras do banco.
  institutionAcronym: string;
  jurisdictionCode: string;
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

const NOTICE_PAGES = {
  fgv: { base: "https://conhecimento.fgv.br/concursos/", organizer: "Fundação Getulio Vargas" },
  cebraspe: { base: "https://www.cebraspe.org.br/concursos/", organizer: "Cebraspe" },
} as const;

/** Edição futura de um edital publicado na página da banca, sem documentos de prova. */
function scheduledNotice(
  bankSlug: keyof typeof NOTICE_PAGES,
  sourceExternalId: string,
  edition: Pick<
    AvailableExamEdition,
    | "publicId"
    | "careerSlug"
    | "institutionAcronym"
    | "jurisdictionCode"
    | "title"
    | "jurisdiction"
    | "examDate"
  > & { productSlugs: readonly string[] },
): AvailableExamEdition {
  return {
    ...edition,
    sourceExternalId,
    bankSlug,
    organizer: NOTICE_PAGES[bankSlug].organizer,
    officialUrl: `${NOTICE_PAGES[bankSlug].base}${sourceExternalId}`,
    durationMinutes: null,
    status: "scheduled",
    opportunitySlug: edition.publicId,
    documents: [],
  };
}

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
  // Editais ativos de 28/09/2026: ligam cada produto à oportunidade oficial
  // aprovada em official-candidates.ts (mesma carreira, sigla, UF e data).
  scheduledNotice("fgv", "trf5juiz26", {
    publicId: "trf-5-juiz-federal-2026",
    careerSlug: "magistratura",
    institutionAcronym: "TRF-5",
    jurisdictionCode: "PE",
    title: "TRF-5 — XVI Concurso para Juiz Federal Substituto",
    jurisdiction: "5ª Região (AL, CE, PB, PE, RN e SE)",
    examDate: "2026-12-20",
    productSlugs: ["trf-5-juiz-federal-5-regiao"],
  }),
  scheduledNotice("fgv", "tjrsjuiz26", {
    publicId: "tj-rs-juiz-2026",
    careerSlug: "magistratura",
    institutionAcronym: "TJ-RS",
    jurisdictionCode: "RS",
    title: "TJ-RS — Concurso para Juiz de Direito Substituto 2026",
    jurisdiction: "Rio Grande do Sul",
    examDate: "2026-12-13",
    productSlugs: ["tj-rs-juiz-de-direito-2026"],
  }),
  scheduledNotice("cebraspe", "PC_AL_26", {
    publicId: "pc-al-2026",
    careerSlug: "policia-civil",
    institutionAcronym: "PC-AL",
    jurisdictionCode: "AL",
    title: "Polícia Civil de Alagoas — Agente e Escrivão 2026",
    jurisdiction: "Alagoas",
    examDate: "2026-12-06",
    productSlugs: ["pc-al-agente-e-escrivao-2026"],
  }),
  scheduledNotice("cebraspe", "PC_MA_26_DELEGADO", {
    publicId: "pc-ma-delegado-2026",
    careerSlug: "delegado",
    institutionAcronym: "PC-MA",
    jurisdictionCode: "MA",
    title: "Polícia Civil do Maranhão — Delegado 2026",
    jurisdiction: "Maranhão",
    examDate: "2026-11-01",
    productSlugs: ["pc-ma-delegado-2026"],
  }),
  scheduledNotice("cebraspe", "PC_MA_26_INVESTIGADOR", {
    publicId: "pc-ma-investigador-2026",
    careerSlug: "policia-civil",
    institutionAcronym: "PC-MA",
    jurisdictionCode: "MA",
    title: "Polícia Civil do Maranhão — Investigador 2026",
    jurisdiction: "Maranhão",
    examDate: "2026-12-06",
    productSlugs: ["pc-ma-oficial-investigador-2026"],
  }),
  scheduledNotice("cebraspe", "SEAP_MA_26_INSPETOR_MONITOR", {
    publicId: "seap-ma-inspetor-2026",
    careerSlug: "policia-penal",
    institutionAcronym: "SEAP-MA",
    jurisdictionCode: "MA",
    title: "SEAP-MA — Inspetor de Polícia Penal 2026",
    jurisdiction: "Maranhão",
    examDate: "2026-12-13",
    productSlugs: ["pp-ma-inspetor-2026"],
  }),
  scheduledNotice("cebraspe", "SEFAZ_AL_26", {
    publicId: "sefaz-al-auditor-fiscal-2026",
    careerSlug: "auditor-fiscal",
    institutionAcronym: "SEFAZ-AL",
    jurisdictionCode: "AL",
    title: "SEFAZ-AL — Auditor Fiscal 2026",
    jurisdiction: "Alagoas",
    examDate: "2026-12-20",
    productSlugs: ["sefaz-al-auditor-fiscal-2026"],
  }),
  scheduledNotice("cebraspe", "TCE_MA_26", {
    publicId: "tce-ma-2026",
    careerSlug: "controle-externo",
    institutionAcronym: "TCE-MA",
    jurisdictionCode: "MA",
    title: "TCE-MA — Controle Externo 2026",
    jurisdiction: "Maranhão",
    examDate: "2026-11-22",
    productSlugs: ["tce-ma-analista-e-tecnico-2026"],
  }),
  scheduledNotice("cebraspe", "TC_DF_26_ANALISTA", {
    publicId: "tc-df-analista-2026",
    careerSlug: "controle-externo",
    institutionAcronym: "TC-DF",
    jurisdictionCode: "DF",
    title: "TC-DF — Analista Administrativo de Controle Externo 2026",
    jurisdiction: "Distrito Federal",
    examDate: "2026-11-22",
    productSlugs: ["tc-df-analista-2026"],
  }),
  // Últimas provas anteriores por produto, levantadas em 27/09/2026 nos portais
  // oficiais. Datas conferidas no gabarito, comunicado ou edital de cada prova;
  // detalhes e pendências em docs/research/provas-anteriores-2026-09-27.json.
  {
    publicId: "agu-advogado-2023",
    sourceExternalId: "AGU_22_ADVOGADO",
    careerSlug: "procurador",
    bankSlug: "cebraspe",
    institutionAcronym: "AGU",
    jurisdictionCode: "BR",
    title: "AGU 2022 — Advogado da União — prova objetiva (P1)",
    organizer: "Cebraspe",
    jurisdiction: "Brasil",
    officialUrl: "https://www.cebraspe.org.br/concursos/AGU_22_ADVOGADO",
    examDate: "2023-04-30",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "AGU 2022 — Advogado da União — caderno da prova objetiva (P1)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/AGU_22_ADVOGADO/arquivos/804_AGU_ADVOGADO_001_01.PDF",
        fileName: "804_AGU_ADVOGADO_001_01.PDF",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "AGU 2022 — Advogado da União — gabarito definitivo (P1)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/AGU_22_ADVOGADO/arquivos/GAB_DEFINITIVO_804_AGU_ADVOGADO_001_01.PDF",
        fileName: "GAB_DEFINITIVO_804_AGU_ADVOGADO_001_01.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "pc-ma-delegado-2018",
    sourceExternalId: "PC_MA_17_DELEGADO",
    careerSlug: "delegado",
    bankSlug: "cebraspe",
    institutionAcronym: "PC-MA",
    jurisdictionCode: "MA",
    title: "PC-MA 2017 — Delegado de Polícia Civil — prova objetiva",
    organizer: "Cebraspe",
    jurisdiction: "Maranhão",
    officialUrl: "https://www.cebraspe.org.br/concursos/PC_MA_17_DELEGADO",
    examDate: "2018-01-28",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "PC-MA 2017 — Delegado de Polícia Civil — caderno de provas",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PC_MA_17_DELEGADO/arquivos/372_PCMADELEGADO_001_01.PDF",
        fileName: "372_PCMADELEGADO_001_01.PDF",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "PC-MA 2017 — Delegado de Polícia Civil — gabarito definitivo",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PC_MA_17_DELEGADO/arquivos/GAB_DEFINITIVO_372_PCMADELEGADO_001_01.PDF",
        fileName: "GAB_DEFINITIVO_372_PCMADELEGADO_001_01.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  // Cebraspe divide a prova em partes com gabaritos separados. Para lei seca,
  // o vínculo usa o caderno e o gabarito definitivo dos conhecimentos
  // específicos; a página da edição traz as demais partes. Itens contados nos
  // gabaritos oficiais e datas tiradas dos editais de aplicação (01/10/2026).
  {
    publicId: "pc-al-agente-2021",
    sourceExternalId: "PC_AL_21",
    careerSlug: "policia-civil",
    bankSlug: "cebraspe",
    institutionAcronym: "PC-AL",
    jurisdictionCode: "AL",
    title: "PC-AL 2021 — Agente de Polícia — prova objetiva",
    organizer: "Cebraspe",
    jurisdiction: "Alagoas",
    officialUrl: "https://www.cebraspe.org.br/concursos/PC_AL_21",
    examDate: "2021-08-29",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "PC-AL 2021 — Agente de Polícia — caderno da prova objetiva (itens 1 a 120)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PC_AL_21/arquivos/MATRIZ_600_PCAL_001.PDF",
        fileName: "MATRIZ_600_PCAL_001.PDF",
        expectedQuestionCount: 120,
      },
      {
        documentType: "answer_key",
        title: "PC-AL 2021 — Agente de Polícia — gabarito definitivo dos conhecimentos específicos (itens 51 a 120)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PC_AL_21/arquivos/GAB_DEFINITIVO_MATRIZ_600_PCAL_001_00.PDF",
        fileName: "GAB_DEFINITIVO_MATRIZ_600_PCAL_001_00.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "pc-ma-investigador-2018",
    sourceExternalId: "PC_MA_17_APC",
    careerSlug: "policia-civil",
    bankSlug: "cebraspe",
    institutionAcronym: "PC-MA",
    jurisdictionCode: "MA",
    title: "PC-MA 2017 — Investigador de Polícia — prova objetiva",
    organizer: "Cebraspe",
    jurisdiction: "Maranhão",
    officialUrl: "https://www.cebraspe.org.br/concursos/PC_MA_17_APC",
    examDate: "2018-01-28",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "PC-MA 2017 — Investigador de Polícia — caderno de conhecimentos específicos (questões 21 a 60)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PC_MA_17_APC/arquivos/373_SSPMA_APC_002_01.PDF",
        fileName: "373_SSPMA_APC_002_01.PDF",
        expectedQuestionCount: 40,
      },
      {
        documentType: "answer_key",
        title: "PC-MA 2017 — Investigador de Polícia — gabarito definitivo dos conhecimentos específicos",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PC_MA_17_APC/arquivos/GAB_DEFINITIVO_373_SSPMA_APC_002_01.PDF",
        fileName: "GAB_DEFINITIVO_373_SSPMA_APC_002_01.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "sefaz-al-auditor-fiscal-2021",
    sourceExternalId: "SEFAZ_AL_21_AUDITOR",
    careerSlug: "auditor-fiscal",
    bankSlug: "cebraspe",
    institutionAcronym: "SEFAZ-AL",
    jurisdictionCode: "AL",
    title: "SEFAZ-AL 2021 — Auditor Fiscal da Receita Estadual — prova objetiva",
    organizer: "Cebraspe",
    jurisdiction: "Alagoas",
    officialUrl: "https://www.cebraspe.org.br/concursos/SEFAZ_AL_21_AUDITOR",
    examDate: "2021-10-23",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "SEFAZ-AL 2021 — Auditor Fiscal da Receita Estadual — caderno da prova objetiva (itens 1 a 160)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/SEFAZ_AL_21_AUDITOR/arquivos/MATRIZ_607_SEFAZ_AL_002.PDF",
        fileName: "MATRIZ_607_SEFAZ_AL_002.PDF",
        expectedQuestionCount: 160,
      },
      {
        documentType: "answer_key",
        title: "SEFAZ-AL 2021 — Auditor Fiscal da Receita Estadual — gabarito definitivo dos conhecimentos específicos (itens 101 a 160)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/SEFAZ_AL_21_AUDITOR/arquivos/GAB_DEFINITIVO_MATRIZ_607_SEFAZ_AL_002_00.PDF",
        fileName: "GAB_DEFINITIVO_MATRIZ_607_SEFAZ_AL_002_00.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "tc-df-analista-2023",
    sourceExternalId: "TC_DF_23",
    careerSlug: "controle-externo",
    bankSlug: "cebraspe",
    institutionAcronym: "TC-DF",
    jurisdictionCode: "DF",
    title: "TC-DF 2023 — Analista Administrativo de Controle Externo — prova objetiva P3",
    organizer: "Cebraspe",
    jurisdiction: "Distrito Federal",
    officialUrl: "https://www.cebraspe.org.br/concursos/TC_DF_23",
    examDate: "2023-11-19",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TC-DF 2023 — Analista Administrativo de Controle Externo — caderno P3, conhecimentos específicos II (itens 81 a 150)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/TC_DF_23/arquivos/895_TCDF_001_01_COM_JUSTIFICATIVA.PDF",
        fileName: "895_TCDF_001_01_COM_JUSTIFICATIVA.PDF",
        expectedQuestionCount: 70,
      },
      {
        documentType: "answer_key",
        title: "TC-DF 2023 — Analista Administrativo de Controle Externo — gabarito definitivo P3 (itens 81 a 150)",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/TC_DF_23/arquivos/GAB_DEFINITIVO_895_TCDF_001_01.PDF",
        fileName: "GAB_DEFINITIVO_895_TCDF_001_01.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  // TJ-RS fez a última prova de juiz com a FAURGS (Edital 61/2019, aplicada em
  // 16/01/2022); a edição 2026 é da FGV. Vale pela decisão de 02/10/2026. O
  // gabarito definitivo saiu no Edital nº 43/2022, após os recursos.
  {
    publicId: "tj-rs-juiz-2022",
    sourceExternalId: "127-612019",
    careerSlug: "magistratura",
    bankSlug: "faurgs",
    institutionAcronym: "TJ-RS",
    jurisdictionCode: "RS",
    title: "TJ-RS 2022 — Juiz de Direito Substituto — prova objetiva",
    organizer: "FAURGS",
    jurisdiction: "Rio Grande do Sul",
    officialUrl: "https://portalfaurgs.com.br/concursosFaurgs/encerrados/127-612019tribunaldejusticadoestadodoriograndedosul",
    examDate: "2022-01-16",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TJ-RS 2022 — Juiz de Direito Substituto — caderno da prova objetiva",
        sourceUrl: "https://portalfaurgs.com.br/LerArquivo/6a4df8bd-ebc4-4bcb-be50-a574cc59277d",
        fileName: "prova-objetiva-juiz-de-direito-substituto.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "TJ-RS 2022 — Juiz de Direito Substituto — gabarito definitivo (Edital nº 43/2022)",
        sourceUrl: "https://portalfaurgs.com.br/LerArquivo/d41f6110-ba74-4c1c-959a-27e385c63382",
        fileName: "edital-43-2022-gabarito-definitivo.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "pc-rj-delegado-2022",
    sourceExternalId: "PC_RJ_21_DELEGADO",
    careerSlug: "delegado",
    bankSlug: "cebraspe",
    institutionAcronym: "PC-RJ",
    jurisdictionCode: "RJ",
    title: "PC-RJ 2021 — Delegado de Polícia — prova objetiva",
    organizer: "Cebraspe",
    jurisdiction: "Rio de Janeiro",
    officialUrl: "https://www.cebraspe.org.br/concursos/PC_RJ_21_DELEGADO",
    examDate: "2022-03-13",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "PC-RJ 2021 — Delegado de Polícia — caderno da prova objetiva",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PC_RJ_21_DELEGADO/arquivos/662_PCRJ_001_01.PDF",
        fileName: "662_PCRJ_001_01.PDF",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "PC-RJ 2021 — Delegado de Polícia — gabarito definitivo",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PC_RJ_21_DELEGADO/arquivos/GAB_DEFINITIVO_662_PCRJ_001_01.PDF",
        fileName: "GAB_DEFINITIVO_662_PCRJ_001_01.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "pge-al-procurador-2021",
    sourceExternalId: "PGE_AL_21_PROCURADOR",
    careerSlug: "procurador",
    bankSlug: "cebraspe",
    institutionAcronym: "PGE-AL",
    jurisdictionCode: "AL",
    title: "PGE-AL 2021 — Procurador do Estado — prova objetiva",
    organizer: "Cebraspe",
    jurisdiction: "Alagoas",
    officialUrl: "https://www.cebraspe.org.br/concursos/PGE_AL_21_PROCURADOR",
    examDate: "2021-10-30",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "PGE-AL 2021 — Procurador do Estado — caderno da prova objetiva",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PGE_AL_21_PROCURADOR/arquivos/608_PGEAL_001_01.PDF",
        fileName: "608_PGEAL_001_01.PDF",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "PGE-AL 2021 — Procurador do Estado — gabarito definitivo",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PGE_AL_21_PROCURADOR/arquivos/GAB_DEFINITIVO_608_PGEAL_001_01.PDF",
        fileName: "GAB_DEFINITIVO_608_PGEAL_001_01.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "pgm-manaus-procurador-2018",
    sourceExternalId: "PGM_MANAUS_18_PROCURADOR",
    careerSlug: "procurador",
    bankSlug: "cebraspe",
    institutionAcronym: "PGM-MANAUS",
    jurisdictionCode: "AM",
    title: "PGM Manaus 2018 — Procurador do Município de 3ª Classe — prova objetiva",
    organizer: "Cebraspe",
    jurisdiction: "Amazonas",
    officialUrl: "https://www.cebraspe.org.br/concursos/PGM_MANAUS_18_PROCURADOR",
    examDate: "2018-05-20",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "PGM Manaus 2018 — Procurador do Município de 3ª Classe — caderno da prova objetiva",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PGM_MANAUS_18_PROCURADOR/arquivos/388_PGMMANAUS001.PDF",
        fileName: "388_PGMMANAUS001.PDF",
        expectedQuestionCount: 150,
      },
      {
        documentType: "answer_key",
        title: "PGM Manaus 2018 — Procurador do Município de 3ª Classe — gabarito definitivo",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PGM_MANAUS_18_PROCURADOR/arquivos/GAB_DEFINITIVO_388_PGMMANAUS001.PDF",
        fileName: "GAB_DEFINITIVO_388_PGMMANAUS001.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "tj-ba-juiz-2019",
    sourceExternalId: "TJ_BA_18_JUIZ",
    careerSlug: "magistratura",
    bankSlug: "cebraspe",
    institutionAcronym: "TJ-BA",
    jurisdictionCode: "BA",
    title: "TJ-BA 2018 — Juiz de Direito Substituto — prova objetiva seletiva",
    organizer: "Cebraspe",
    jurisdiction: "Bahia",
    officialUrl: "https://www.cebraspe.org.br/concursos/TJ_BA_18_JUIZ",
    examDate: "2019-01-13",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TJ-BA 2018 — Juiz de Direito Substituto — caderno da prova objetiva seletiva",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/TJ_BA_18_JUIZ/arquivos/MATRIZ_428_TJBA001_PAG_19.PDF",
        fileName: "MATRIZ_428_TJBA001_PAG_19.PDF",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "TJ-BA 2018 — Juiz de Direito Substituto — gabarito definitivo",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/TJ_BA_18_JUIZ/arquivos/GAB_DEFINITIVO_MATRIZ_428_TJ_BA001.PDF",
        fileName: "GAB_DEFINITIVO_MATRIZ_428_TJ_BA001.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "tj-dft-juiz-2023",
    sourceExternalId: "TJDFT_22_JUIZ",
    careerSlug: "magistratura",
    bankSlug: "cebraspe",
    institutionAcronym: "TJ-DFT",
    jurisdictionCode: "DF",
    title: "TJDFT 2022 — Juiz de Direito Substituto — prova objetiva seletiva",
    organizer: "Cebraspe",
    jurisdiction: "Distrito Federal",
    officialUrl: "https://www.cebraspe.org.br/concursos/TJDFT_22_JUIZ",
    examDate: "2023-02-05",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TJDFT 2022 — Juiz de Direito Substituto — caderno da prova objetiva seletiva",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/TJDFT_22_JUIZ/arquivos/790_TJDFT_001_01.PDF",
        fileName: "790_TJDFT_001_01.PDF",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "TJDFT 2022 — Juiz de Direito Substituto — gabarito definitivo",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/TJDFT_22_JUIZ/arquivos/GAB_DEFINITIVO_790_TJDFT_001_01.PDF",
        fileName: "GAB_DEFINITIVO_790_TJDFT_001_01.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "prf-policial-2021",
    sourceExternalId: "PRF_21",
    careerSlug: "policia-rodoviaria-federal",
    bankSlug: "cebraspe",
    institutionAcronym: "PRF",
    jurisdictionCode: "BR",
    title: "PRF 2021 — Policial Rodoviário Federal — prova objetiva",
    organizer: "Cebraspe",
    jurisdiction: "Brasil",
    officialUrl: "https://www.cebraspe.org.br/concursos/PRF_21",
    examDate: "2021-05-09",
    durationMinutes: 270,
    status: "published",
    documents: [
      {
        // Itens 1 a 8 (língua estrangeira) ficam em cadernos oficiais próprios.
        documentType: "question_booklet",
        title: "PRF 2021 — Policial Rodoviário Federal — caderno da prova objetiva, itens 9 a 120",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PRF_21/arquivos/578_PRF_001_01.PDF",
        fileName: "578_PRF_001_01.PDF",
        expectedQuestionCount: 112,
      },
      {
        documentType: "answer_key",
        title: "PRF 2021 — Policial Rodoviário Federal — gabarito definitivo, itens 9 a 120",
        sourceUrl: "https://cdn.cebraspe.org.br/concursos/PRF_21/arquivos/GAB_DEFINITIVO_578_PRF_001_01.PDF",
        fileName: "GAB_DEFINITIVO_578_PRF_001_01.PDF",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "trf-5-juiz-federal-2025",
    sourceExternalId: "trf5juiz",
    careerSlug: "magistratura",
    bankSlug: "fgv",
    institutionAcronym: "TRF-5",
    // Tribunal regional: sede em Pernambuco, jurisdição sobre AL, CE, PB, PE, RN e SE.
    jurisdictionCode: "PE",
    title: "TRF-5 2025 — Juiz Federal Substituto — prova objetiva seletiva",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "5ª Região (AL, CE, PB, PE, RN e SE)",
    officialUrl: "https://conhecimento.fgv.br/concursos/trf5juiz",
    examDate: "2025-05-25",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TRF-5 2025 — Juiz Federal Substituto — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/trf5-t1.pdf",
        fileName: "trf5-t1.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "TRF-5 2025 — Juiz Federal Substituto — gabarito oficial definitivo",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/gabdef_juiz-federal-substituto.pdf",
        fileName: "gabdef_juiz-federal-substituto.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "tj-pe-juiz-2024",
    sourceExternalId: "tjpe24",
    careerSlug: "magistratura",
    bankSlug: "fgv",
    institutionAcronym: "TJ-PE",
    jurisdictionCode: "PE",
    title: "TJ-PE 2024 — Juiz Substituto — prova objetiva seletiva",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Pernambuco",
    officialUrl: "https://conhecimento.fgv.br/concursos/tjpe24",
    examDate: "2024-12-01",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TJ-PE 2024 — Juiz Substituto — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/juiz-substituto-tjpeobj01jz-subst-pe-tipo-1.pdf",
        fileName: "juiz-substituto-tjpeobj01jz-subst-pe-tipo-1.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "TJ-PE 2024 — Juiz Substituto — gabarito oficial definitivo",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/gabarito_definitivo_tjpe.pdf",
        fileName: "gabarito_definitivo_tjpe.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "csjt-juiz-do-trabalho-2023",
    sourceExternalId: "csjt23",
    careerSlug: "magistratura",
    bankSlug: "fgv",
    institutionAcronym: "CSJT",
    jurisdictionCode: "BR",
    title: "CSJT 2023 — Juiz do Trabalho Substituto — prova objetiva seletiva",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Brasil",
    officialUrl: "https://conhecimento.fgv.br/concursos/csjt23",
    examDate: "2023-05-14",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "CSJT 2023 — Juiz do Trabalho Substituto — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/juiza-do-trabalho-substitutoajuiz-substituto-tipo-1.pdf",
        fileName: "juiza-do-trabalho-substitutoajuiz-substituto-tipo-1.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "CSJT 2023 — Juiz do Trabalho Substituto — gabarito oficial definitivo",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/csjt-gabaritos-definitivos.pdf",
        fileName: "csjt-gabaritos-definitivos.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "mpe-rj-promotor-2025",
    sourceExternalId: "mprjpromotor2025",
    careerSlug: "promotor-justica",
    bankSlug: "fgv",
    institutionAcronym: "MPE-RJ",
    jurisdictionCode: "RJ",
    title: "MPRJ — XXXVIII Concurso — Promotor de Justiça Substituto — prova preambular",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Rio de Janeiro",
    officialUrl: "https://conhecimento.fgv.br/concursos/mprjpromotor2025",
    examDate: "2025-08-03",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "MPRJ XXXVIII — Promotor de Justiça Substituto — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substitutocns001-tipo-1_0.pdf",
        fileName: "promotor-de-justica-substitutocns001-tipo-1_0.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "MPRJ XXXVIII — Promotor de Justiça Substituto — gabarito oficial definitivo",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/v2gabarito-definito-mprj-promotor.pdf",
        fileName: "v2gabarito-definito-mprj-promotor.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "tj-pr-juiz-2023",
    sourceExternalId: "tjpr2023",
    careerSlug: "magistratura",
    bankSlug: "fgv",
    institutionAcronym: "TJ-PR",
    jurisdictionCode: "PR",
    title: "TJ-PR 2023 — Juiz Substituto — prova objetiva seletiva",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Paraná",
    officialUrl: "https://conhecimento.fgv.br/concursos/tjpr2023",
    examDate: "2023-12-03",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TJ-PR 2023 — Juiz Substituto — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/tjpr-2023-juiz-substitutojuizsubstituto-tipo-1.pdf",
        fileName: "tjpr-2023-juiz-substitutojuizsubstituto-tipo-1.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "TJ-PR 2023 — Juiz Substituto — gabarito oficial definitivo (Edital nº 19/2023)",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/19-edital-no-019-2023-gabarito-oficial-assinado74616.pdf",
        fileName: "19-edital-no-019-2023-gabarito-oficial-assinado74616.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "mpe-go-promotor-2024",
    sourceExternalId: "mpgo23",
    careerSlug: "promotor-justica",
    bankSlug: "fgv",
    institutionAcronym: "MPE-GO",
    jurisdictionCode: "GO",
    title: "MPGO 2023 — Promotor de Justiça Substituto — prova preambular",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Goiás",
    officialUrl: "https://conhecimento.fgv.br/concursos/mpgo23",
    examDate: "2024-01-28",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "MPGO 2023 — Promotor de Justiça Substituto — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/promotor-de-justica-substitutocns001-tipo-1.pdf",
        fileName: "promotor-de-justica-substitutocns001-tipo-1.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "MPGO 2023 — Promotor de Justiça Substituto — gabarito oficial definitivo (Comunicado nº 11)",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/comissaodeconcurso_comunicado-n.-11.pdf",
        fileName: "comissaodeconcurso_comunicado-n.-11.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "tj-go-juiz-2023",
    sourceExternalId: "tjgo2023",
    careerSlug: "magistratura",
    bankSlug: "fgv",
    institutionAcronym: "TJ-GO",
    jurisdictionCode: "GO",
    title: "TJ-GO 2023 — Juiz Substituto — prova objetiva seletiva",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Goiás",
    officialUrl: "https://conhecimento.fgv.br/concursos/tjgo2023",
    examDate: "2023-12-17",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TJ-GO 2023 — Juiz Substituto — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/tjgo-2023-juiz-substitutojuizsubstituto-tipo-1.pdf",
        fileName: "tjgo-2023-juiz-substitutojuizsubstituto-tipo-1.pdf",
        expectedQuestionCount: 100,
      },
      {
        documentType: "answer_key",
        title: "TJ-GO 2023 — Juiz Substituto — gabarito oficial definitivo",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/tjgo2023_gabaritodefinitivo_20240131-002.pdf",
        fileName: "tjgo2023_gabaritodefinitivo_20240131-002.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "tj-ms-analista-area-fim-2026",
    sourceExternalId: "tjms25-analista-area-fim",
    careerSlug: "analista-juridico",
    bankSlug: "fgv",
    institutionAcronym: "TJ-MS",
    jurisdictionCode: "MS",
    title: "TJ-MS — XI Concurso — Analista Judiciário, Área Fim — prova objetiva",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Mato Grosso do Sul",
    officialUrl: "https://conhecimento.fgv.br/concursos/tjms25",
    examDate: "2026-01-25",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TJ-MS XI — Analista Judiciário, Área Fim — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/analista-judiciario-area-fim-cns101-tipo-1.pdf",
        fileName: "analista-judiciario-area-fim-cns101-tipo-1.pdf",
        expectedQuestionCount: 60,
      },
      {
        documentType: "answer_key",
        title: "TJ-MS XI — Analista e Técnico — gabarito oficial definitivo",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/tjms-analista-e-tecnico.pdf",
        fileName: "tjms-analista-e-tecnico.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "trt-ms-analista-judiciario-2025",
    sourceExternalId: "trt24-analista-area-judiciaria",
    careerSlug: "analista",
    bankSlug: "fgv",
    institutionAcronym: "TRT-MS",
    jurisdictionCode: "MS",
    title: "TRT-24 2024 — Analista Judiciário, Área Judiciária — prova objetiva (reaplicação)",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Mato Grosso do Sul",
    officialUrl: "https://conhecimento.fgv.br/concursos/trt24",
    examDate: "2025-05-11",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TRT-24 — Analista Judiciário, Área Judiciária — caderno Tipo 1 (reaplicação)",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/area-judiciaria-sem-especialidadecns101-tipo-1.pdf",
        fileName: "area-judiciaria-sem-especialidadecns101-tipo-1.pdf",
        expectedQuestionCount: 60,
      },
      {
        documentType: "answer_key",
        title: "TRT-24 — Analista Judiciário — gabarito oficial definitivo (reaplicação)",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/gabaritodefinitivo_trt24-analista.pdf",
        fileName: "gabaritodefinitivo_trt24-analista.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
  {
    publicId: "trt-ms-tecnico-judiciario-2025",
    sourceExternalId: "trt24-tecnico-area-administrativa",
    careerSlug: "tecnico-judiciario",
    bankSlug: "fgv",
    institutionAcronym: "TRT-MS",
    jurisdictionCode: "MS",
    title: "TRT-24 2024 — Técnico Judiciário, Área Administrativa — prova objetiva",
    organizer: "Fundação Getulio Vargas",
    jurisdiction: "Mato Grosso do Sul",
    officialUrl: "https://conhecimento.fgv.br/concursos/trt24",
    examDate: "2025-03-09",
    durationMinutes: null,
    status: "published",
    documents: [
      {
        documentType: "question_booklet",
        title: "TRT-24 — Técnico Judiciário, Área Administrativa — caderno Tipo 1",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/tecnico-judiciario-administrativa-sem-especialidadecns201-tipo-1.pdf",
        fileName: "tecnico-judiciario-administrativa-sem-especialidadecns201-tipo-1.pdf",
        expectedQuestionCount: 60,
      },
      {
        documentType: "answer_key",
        title: "TRT-24 — Técnico Judiciário — gabarito oficial definitivo (retificado)",
        sourceUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/gabarito_definitivo_trt2024_v3.pdf",
        fileName: "gabarito_definitivo_trt2024_v3.pdf",
        expectedQuestionCount: null,
      },
    ],
  },
] as const satisfies readonly AvailableExamEdition[];

// Mesmas regras das restrições exam_editions_* do schema.
const JURISDICTION_CODE =
  /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO|BR)$/u;
const INSTITUTION_ACRONYM = /^[A-Z0-9][A-Z0-9 .-]{1,79}$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

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
    if (!JURISDICTION_CODE.test(edition.jurisdictionCode)) {
      throw new Error(`Jurisdição inválida: ${edition.publicId}.`);
    }
    if (!INSTITUTION_ACRONYM.test(edition.institutionAcronym)) {
      throw new Error(`Sigla institucional inválida: ${edition.publicId}.`);
    }
    if (!ISO_DATE.test(edition.examDate)) throw new Error(`Data inválida: ${edition.publicId}.`);
    if (edition.status === "scheduled" && (!edition.opportunitySlug || !edition.productSlugs?.length)) {
      throw new Error(`Edição futura sem oportunidade/produto: ${edition.publicId}.`);
    }
    // Prova histórica só entra com o par exato caderno + gabarito definitivo.
    if (
      edition.status === "published" &&
      (edition.documents.length !== 2 ||
        !edition.documents.some((document) => document.documentType === "question_booklet") ||
        !edition.documents.some((document) => document.documentType === "answer_key"))
    ) {
      throw new Error(`Edição histórica sem caderno e gabarito: ${edition.publicId}.`);
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
