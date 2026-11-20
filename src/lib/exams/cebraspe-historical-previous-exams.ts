import { createHash } from "node:crypto";

import type { FgvHistoricalPreviousExam } from "@/lib/exams/fgv-historical-previous-exam-admission";

// Lote Cebraspe histórico (admissão composta, treino histórico com legislação atual).
// Mesmo núcleo transacional do lote FGV; a conferência de portal é própria: a página do
// concurso Cebraspe é montada por JavaScript a partir da API pública do evento, que traz
// nome do arquivo, descrição oficial e data de publicação de editais, cadernos e gabaritos.
// Só metadados: nenhum PDF de prova é armazenado ou extraído.

const CDN = "https://cdn.cebraspe.org.br/concursos/";

export const CEBRASPE_HISTORICAL_PREVIOUS_EXAMS: readonly FgvHistoricalPreviousExam[] = [
  {
    bank: "cebraspe", cebraspeEventId: "SEFAZ_RN_25_AUDITOR",
    productSlug: "sefaz-rn-auditor-fiscal-reta-final", editionPublicId: "sefazrn-auditor-fiscal-5-2025-objetiva-p3", opportunitySlug: "sefazrn-auditor-fiscal-5-2025-historico-objetiva",
    portalUrl: "https://www.cebraspe.org.br/concursos/sefaz_rn_25_auditor", portalHeading: "SEFAZ RN 25 AUDITOR",
    portalNotice: { url: `${CDN}sefaz_rn_25_auditor/arquivos/E8D7BE4C19CD39BFF1D87ECFBF92C0409AF35B178B8865C9534F17236D261200.pdf`, label: "Edital nº 1 – Abertura" },
    role: "Auditor Fiscal de Receitas Estaduais", jurisdiction: "RN", jurisdictionName: "Rio Grande do Norte", institution: "SEFAZ-RN", noticeNumber: "5/2025-SEAD/SEFAZ/RN", cycleYear: 2025, careerSlug: "auditor-fiscal",
    examDate: "2026-03-22", expectedQuestionCount: 80,
    noticeUrl: `${CDN}sefaz_rn_25_auditor/arquivos/E8D7BE4C19CD39BFF1D87ECFBF92C0409AF35B178B8865C9534F17236D261200.pdf`,
    noticeSha256: "85cea6fbb0d6e653ad71deb1fea06cde66f03bf047483f8fe7ce22b4985f786b", noticePageCount: 40,
    noticeChecks: [
      { page: 21, pattern: "Prova objetiva de conhecimentos específicos \\(P3\\)[\\s\\S]*Processo administrativo tributário 10" },
      { page: 21, pattern: "múltipla escolha, com cinco opções \\(A, B, C, D e E\\)" },
      { page: 38, pattern: "Aplicação das provas objetivas 21 e 22/3/2026" },
    ],
    examDateCorroboration: "API oficial do evento Cebraspe: caderno P3 publicado em 27/03/2026 e gabarito definitivo P3 em 24/04/2026, após as datas do cronograma (21 e 22/3/2026)",
    editionSourceExternalId: "cebraspe-sefaz-rn-25-auditor-objetiva-p3", editionTitle: "SEFAZ-RN 2025 — Auditor Fiscal de Receitas Estaduais — objetiva P3 (conhecimentos específicos)",
    documents: [
      { documentType: "question_booklet", title: "SEFAZ-RN 2025 — prova objetiva P3 — conhecimentos específicos", label: "PROVA OBJETIVA – CONHECIMENTOS ESPECÍFICOS (P3)", publishedOn: "2026-03-27",
        url: `${CDN}sefaz_rn_25_auditor/arquivos/355613AE6F4CBAEBA889E8A28F0DB4FC3887AE80F556A18EFF6980A58F662096.pdf` },
      { documentType: "answer_key", title: "SEFAZ-RN 2025 — gabarito definitivo da prova objetiva P3", label: "GABARITO DEFINITIVO – CONHECIMENTOS ESPECÍFICOS (P3)", publishedOn: "2026-04-24",
        url: `${CDN}sefaz_rn_25_auditor/arquivos/CAA752D9479FB2950FC4628B664090960445EF8846E2AC3E7AF5FB2F344267C5.pdf` },
    ],
  },
  {
    bank: "cebraspe", cebraspeEventId: "TCE_RN_25",
    productSlug: "tce-rn-auditor-2026", editionPublicId: "tcern-auditor-direito-1-2025-objetiva-p2", opportunitySlug: "tcern-auditor-direito-1-2025-historico-objetiva",
    portalUrl: "https://www.cebraspe.org.br/concursos/tce_rn_25", portalHeading: "Tribunal de Contas do Estado do Rio Grande do Norte",
    portalNotice: { url: `${CDN}TCE_RN_25/arquivos/57E129C2E6851CF23E0EC1333E6F5A80DB7550368502E00A308C4E839EAE78BB.pdf`, label: "Edital nº 1 – Abertura, conforme retificações" },
    role: "Auditor de Controle Externo – Especialidade: Direito", jurisdiction: "RN", jurisdictionName: "Rio Grande do Norte", institution: "TCE-RN", noticeNumber: "1/2025-TCE/RN", cycleYear: 2025, careerSlug: "controle-externo",
    examDate: "2026-04-11", expectedQuestionCount: 70,
    noticeUrl: `${CDN}TCE_RN_25/arquivos/57E129C2E6851CF23E0EC1333E6F5A80DB7550368502E00A308C4E839EAE78BB.pdf`,
    noticeSha256: "a36a581c90f1a59dfb74376608d7ef786fcf5e1e82fbc678ec072af464bdbe37", noticePageCount: 71,
    noticeChecks: [
      { page: 26, pattern: "7\\.1\\.2 AUDITOR DE CONTROLE EXTERNO[\\s\\S]*Prova objetiva \\(P2\\) Conhecimentos específicos 70" },
      { page: 27, pattern: "O julgamento de cada item será CERTO ou ERRADO" },
      { page: 69, pattern: "\\(Auditor de Controle Externo\\) 11/4/2026" },
    ],
    examDateCorroboration: "API oficial do evento Cebraspe: caderno P2 do Cargo 9 publicado em 17/04/2026 e gabarito definitivo em 13/05/2026, após a data do cronograma (11/4/2026)",
    editionSourceExternalId: "cebraspe-tce-rn-25-cargo9-objetiva-p2", editionTitle: "TCE-RN 2025 — Auditor de Controle Externo – Direito (Cargo 9) — objetiva P2 (conhecimentos específicos)",
    documents: [
      { documentType: "question_booklet", title: "TCE-RN 2025 — prova objetiva P2 — conhecimentos específicos — Cargo 9", label: "PROVA OBJETIVA – CONHECIMENTOS ESPECÍFICOS – CARGO 9", publishedOn: "2026-04-17",
        url: `${CDN}TCE_RN_25/arquivos/361EF1E1F67D6BA00F5FF942DEB12899120042A4355EBAEB4966FEFFD970832D.pdf` },
      { documentType: "answer_key", title: "TCE-RN 2025 — gabarito definitivo da prova objetiva P2 — Cargo 9", label: "GABARITO DEFINITIVO – CONHECIMENTOS ESPECÍFICOS – CARGO 9", publishedOn: "2026-05-13",
        url: `${CDN}TCE_RN_25/arquivos/6F2A7444B2D884D74F7FAA21083CF8D4F5342036A955C80C1AA293A4C118882C.pdf` },
    ],
  },
  {
    bank: "cebraspe", cebraspeEventId: "tj_mt_25_notarios",
    productSlug: "tj-mt-cartorios-reta-final", editionPublicId: "tjmt-notas-registro-provimento-48-2025-objetiva", opportunitySlug: "tjmt-notas-registro-provimento-48-2025-historico-objetiva",
    portalUrl: "https://www.cebraspe.org.br/concursos/tj_mt_25_notarios", portalHeading: "TJ MT 25 NOTARIOS",
    portalNotice: { url: `${CDN}tj_mt_25_notarios/arquivos/6500401BB1E96C8AF9F9DA0910FF96202FF79B66FE7A9E9E516DFAA4B169DF9B.pdf`, label: "Edital nº 48 – Abertura – Atualizado conforme retificações" },
    role: "Outorga de Delegações de Notas e de Registro — Ingresso por Provimento", jurisdiction: "MT", jurisdictionName: "Mato Grosso", institution: "TJMT", noticeNumber: "48/2025-TJMT/DGP", cycleYear: 2025, careerSlug: "cartorios",
    examDate: "2026-09-05", expectedQuestionCount: 100,
    noticeUrl: `${CDN}tj_mt_25_notarios/arquivos/6500401BB1E96C8AF9F9DA0910FF96202FF79B66FE7A9E9E516DFAA4B169DF9B.pdf`,
    noticeSha256: "d7e2a9ad3bf80d83c146ded7703b76a2482a0333dc57cf6bd3cba91c6725db9c", noticePageCount: 72,
    noticeChecks: [
      { page: 24, pattern: "múltipla escolha, com cinco opções \\(A, B, C, D" },
      { page: 57, pattern: "Aplicação da prova objetiva de seleção –\\s*Provimento\\s*5/9/2026" },
    ],
    examDateCorroboration: "API oficial do evento Cebraspe: caderno de provimento publicado em 11/09/2026 e gabarito definitivo em 01/10/2026, após a data do cronograma (5/9/2026)",
    editionSourceExternalId: "cebraspe-tj-mt-25-notarios-provimento-objetiva", editionTitle: "TJ-MT 2025 — Notas e Registro, ingresso por provimento — objetiva de seleção",
    documents: [
      { documentType: "question_booklet", title: "TJ-MT 2025 — prova objetiva de seleção — provimento", label: "PROVA OBJETIVA DE SELEÇÃO - PROVIMENTO", publishedOn: "2026-09-11",
        url: `${CDN}tj_mt_25_notarios/arquivos/E8790E73E144A9BDAF6B0FC269782453E9217B3E5CBF4C89F3B67E91D228EED5.pdf` },
      { documentType: "answer_key", title: "TJ-MT 2025 — gabarito definitivo da prova objetiva de seleção — provimento", label: "GABARITO DEFINITIVO - PROVA OBJETIVA DE SELEÇÃO - PROVIMENTO", publishedOn: "2026-10-01",
        url: `${CDN}tj_mt_25_notarios/arquivos/AC049C45E817444A5C57213E5850F5D6B78D57B4D6F4AE912D60F0FE472AFE2B.pdf` },
    ],
  },
  {
    bank: "cebraspe", cebraspeEventId: "TRT10_24",
    productSlug: "trt-10-analista-e-tecnico-df-to", editionPublicId: "trt10-analista-area-judiciaria-1-2024-objetiva-p2", opportunitySlug: "trt10-analista-area-judiciaria-1-2024-historico-objetiva",
    portalUrl: "https://www.cebraspe.org.br/concursos/trt10_24", portalHeading: "Tribunal Regional do Trabalho da 10ª Região",
    portalNotice: { url: `${CDN}TRT10_24/arquivos/Ed_1_2024_TRT_10_Abertura_atualizado_at%C3%A9_ret_6.pdf`, label: "Edital nº 1 – Abertura – Atualizado conforme retificações" },
    role: "Analista Judiciário – Área: Judiciária", jurisdiction: "DF", jurisdictionName: "Distrito Federal", institution: "TRT-10", noticeNumber: "1/2024-TRT10", cycleYear: 2024, careerSlug: "analista",
    examDate: "2025-03-16", expectedQuestionCount: 70,
    noticeUrl: `${CDN}TRT10_24/arquivos/Ed_1_2024_TRT_10_Abertura_atualizado_at%C3%A9_ret_6.pdf`,
    noticeSha256: "8ba3be22e312bde29bf2e682167e4183ee0ac5441581e456a6e335c6eff9433b", noticePageCount: 86,
    noticeChecks: [
      { page: 34, pattern: "O julgamento de cada item será CERTO ou ERRADO" },
      { page: 83, pattern: "Aplicação das provas objetivas e discursiva\\s*16/3/2025" },
    ],
    examDateCorroboration: "API oficial do evento Cebraspe: caderno P2 do Cargo 12 publicado em 21/03/2025 e gabarito definitivo em 14/04/2025, após a data do cronograma (16/3/2025)",
    editionSourceExternalId: "cebraspe-trt10-24-cargo12-objetiva-p2", editionTitle: "TRT-10 2024 — Analista Judiciário – Área Judiciária (Cargo 12) — objetiva P2 (conhecimentos específicos)",
    documents: [
      { documentType: "question_booklet", title: "TRT-10 2024 — prova objetiva P2 — conhecimentos específicos — Cargo 12", label: "PROVA OBJETIVA – CONHECIMENTOS ESPECÍFICOS – CARGO 12", publishedOn: "2025-03-21",
        url: `${CDN}TRT10_24/arquivos/050_TRT10_012_01.pdf` },
      { documentType: "answer_key", title: "TRT-10 2024 — gabarito definitivo da prova objetiva P2 — Cargo 12", label: "GABARITO DEFINITIVO - CONHECIMENTOS ESPECÍFICOS – CARGO 12", publishedOn: "2025-04-14",
        url: `${CDN}TRT10_24/arquivos/Gab_Definitivo_050_TRT10_012_01.pdf` },
    ],
  },
  {
    bank: "cebraspe", cebraspeEventId: "PGE_AL_26",
    productSlug: "pge-al-procurador-do-estado-reta-final", editionPublicId: "pgeal-procurador-1-2026-objetiva-p1", opportunitySlug: "pgeal-procurador-1-2026-historico-objetiva",
    portalUrl: "https://www.cebraspe.org.br/concursos/pge_al_26", portalHeading: "PGE AL 26",
    portalNotice: { url: "https://cdn.cebraspe.org.br/concursos/pge_al_26/arquivos/0C284DE63B81A961F93A4CE27711AF9109B61CE570945D18A8B6F64252D282E3.pdf", label: "Edital nº 1 – Abertura – Atualizado conforme retificações" },
    role: "Procurador do Estado – 1ª Classe", jurisdiction: "AL", jurisdictionName: "Alagoas", institution: "PGE-AL", noticeNumber: "1/2026-PGE/AL", cycleYear: 2026, careerSlug: "procurador",
    examDate: "2026-09-05", expectedQuestionCount: 100,
    noticeUrl: "https://cdn.cebraspe.org.br/concursos/pge_al_26/arquivos/0C284DE63B81A961F93A4CE27711AF9109B61CE570945D18A8B6F64252D282E3.pdf",
    noticeSha256: "e0e8cc8040f090558a87626e8619d9e125bc00bb50b2745e1398c255ca4d37d9", noticePageCount: 51,
    noticeChecks: [
      { page: 22, pattern: "múltipla escolha, com cinco opções \\(A, B, C, D e E\\)" },
      { page: 50, pattern: "Aplicação das provas objetivas\\s*5/9/2026" },
    ],
    examDateCorroboration: "API oficial do evento Cebraspe: caderno P1 publicado em 25/09/2026 e gabarito definitivo em 20/10/2026, após a data do cronograma (5/9/2026)",
    editionSourceExternalId: "cebraspe-pge-al-26-objetiva-p1", editionTitle: "PGE-AL 2026 — Procurador do Estado — objetiva P1",
    documents: [
      { documentType: "question_booklet", title: "PGE-AL 2026 — prova objetiva P1", label: "PROVA OBJETIVA (P1)", publishedOn: "2026-09-25",
        url: "https://cdn.cebraspe.org.br/concursos/pge_al_26/arquivos/E30405D8FA2DE9B7FB3214F56781A2A33187C7F96567C12916CEF4940FDB29AC.pdf" },
      { documentType: "answer_key", title: "PGE-AL 2026 — gabarito definitivo da prova objetiva P1", label: "GABARITO DEFINITIVO – PROVA OBJETIVA (P1)", publishedOn: "2026-10-20",
        url: "https://cdn.cebraspe.org.br/concursos/pge_al_26/arquivos/43C3F343C215B3BCA4EC0F173722CF4F373EF03D9FE757A0EED8F48A7869A341.pdf" },
    ],
  },
  {
    bank: "cebraspe", cebraspeEventId: "PC_DF_26_DELEGADO",
    productSlug: "pc-df-delegado-de-policia-reta-final", editionPublicId: "pcdf-delegado-1-2026-objetiva-p1", opportunitySlug: "pcdf-delegado-1-2026-historico-objetiva",
    portalUrl: "https://www.cebraspe.org.br/concursos/pc_df_26_delegado", portalHeading: "PC DF 26 DELEGADO",
    portalNotice: { url: "https://cdn.cebraspe.org.br/concursos/pc_df_26_delegado/arquivos/0D616074EFE30F97B69C0B62003B1A66CA3330166AC50F786225B864E24A5443.pdf", label: "Edital nº 1 - Abertura - atualizado conforme retificações" },
    role: "Delegado de Polícia", jurisdiction: "DF", jurisdictionName: "Distrito Federal", institution: "PCDF", noticeNumber: "1/2026-PCDF-Delegado", cycleYear: 2026, careerSlug: "delegado",
    examDate: "2026-07-05", expectedQuestionCount: 120,
    noticeUrl: "https://cdn.cebraspe.org.br/concursos/pc_df_26_delegado/arquivos/0D616074EFE30F97B69C0B62003B1A66CA3330166AC50F786225B864E24A5443.pdf",
    noticeSha256: "c1b5a9ca914f7e68e239b6b7fe44c714bf8f1a47aad8257844b1f3583b4a4e29", noticePageCount: 99,
    noticeChecks: [
      { page: 32, pattern: "O julgamento de cada item será CERTO ou ERRADO" },
      { page: 86, pattern: "Aplicação das provas objetiva e discursiva\\s*5/7/2026" },
    ],
    examDateCorroboration: "API oficial do evento Cebraspe: caderno P1 publicado em 07/07/2026 e gabarito definitivo em 10/08/2026, após a data do cronograma (5/7/2026)",
    editionSourceExternalId: "cebraspe-pc-df-26-delegado-objetiva-p1", editionTitle: "PC-DF 2026 — Delegado de Polícia — objetiva P1",
    documents: [
      { documentType: "question_booklet", title: "PC-DF 2026 Delegado — prova objetiva P1", label: "PROVA OBJETIVA (P1) E GABARITO PRELIMINAR COM JUSTIFICATIVAS", publishedOn: "2026-07-07",
        url: "https://cdn.cebraspe.org.br/concursos/pc_df_26_delegado/arquivos/710BA7293977732DDD213CAE2E329E52507C348D3E446135F8978861CDA880F1.pdf" },
      { documentType: "answer_key", title: "PC-DF 2026 Delegado — gabarito definitivo da prova objetiva P1", label: "GABARITO DEFINITIVO – PROVA OBJETIVA (P1)", publishedOn: "2026-08-10",
        url: "https://cdn.cebraspe.org.br/concursos/pc_df_26_delegado/arquivos/793E15AB2B5B357F2DD614A0ACAEE093B9DFE97618931164855D005CDFF89841.pdf" },
    ],
  },
];

type CebraspeFile = { nomeArquivo?: unknown; descricaoArquivo?: unknown; dataArquivoObj?: unknown; isGuid?: unknown };
const label = (value: unknown) => typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
const fileName = (url: string) => decodeURIComponent(new URL(url).pathname.split("/").at(-1)!);

/** Confere evento, edital e documentos na API oficial e devolve só o que foi conferido. */
export function assertCebraspeHistoricalEvent(target: FgvHistoricalPreviousExam, payload: unknown) {
  if (target.bank !== "cebraspe" || !target.cebraspeEventId) throw new Error("Alvo não é do lote Cebraspe.");
  if (typeof payload !== "object" || payload === null) throw new Error("Resposta oficial do evento inválida.");
  const event = payload as { eventoURL?: unknown; eventoNomeCompleto?: unknown; arquivosEdital?: unknown; arquivosGabarito?: unknown };
  if (label(event.eventoURL).toUpperCase() !== target.cebraspeEventId.toUpperCase() || !label(event.eventoNomeCompleto).includes(target.portalHeading)
    || !Array.isArray(event.arquivosEdital) || !Array.isArray(event.arquivosGabarito)) throw new Error("Evento oficial de outro concurso; cadastro bloqueado.");
  const inEvent = (url: string) => {
    const { hostname, pathname } = new URL(url);
    const segment = pathname.split("/")[2] ?? "";
    if (hostname !== "cdn.cebraspe.org.br" || !pathname.startsWith("/concursos/") || segment.toUpperCase() !== target.cebraspeEventId!.toUpperCase()) throw new Error("Arquivo fora do evento oficial.");
  };
  const match = (files: CebraspeFile[], url: string) => {
    inEvent(url);
    const found = files.filter((file) => file.isGuid !== true && label(file.nomeArquivo) === fileName(url));
    if (found.length !== 1) throw new Error("Arquivo oficial ausente ou duplicado na API do evento.");
    return found[0];
  };
  const notice = match(event.arquivosEdital as CebraspeFile[], target.portalNotice.url);
  if (label(notice.descricaoArquivo) !== target.portalNotice.label) throw new Error("API não referencia o edital aprovado esperado; cadastro bloqueado.");
  const verified: { href: string; label: string; publishedOn: string }[] = [];
  for (const document of target.documents) {
    const file = match(event.arquivosGabarito as CebraspeFile[], document.url);
    if (label(file.descricaoArquivo) !== document.label) throw new Error("Documento oficial com descrição diferente.");
    if (label(file.dataArquivoObj).slice(0, 10) !== document.publishedOn) throw new Error("Data de publicação do link diverge da fonte oficial.");
    verified.push({ href: document.url, label: document.label, publishedOn: document.publishedOn });
  }
  return createHash("sha256").update(JSON.stringify({ event: target.cebraspeEventId, heading: target.portalHeading, notice: target.portalNotice, documents: verified })).digest("hex");
}
