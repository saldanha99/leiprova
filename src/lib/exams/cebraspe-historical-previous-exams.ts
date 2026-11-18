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
];

type CebraspeFile = { nomeArquivo?: unknown; descricaoArquivo?: unknown; dataArquivoObj?: unknown; isGuid?: unknown };
const label = (value: unknown) => typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
const fileName = (url: string) => new URL(url).pathname.split("/").at(-1)!;

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
