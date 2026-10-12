import { createHash } from "node:crypto";

import type { CapturedOfficialDocument } from "@/lib/opportunities/official-document-fetch";
import { extractOfficialSyllabusCandidates } from "@/lib/editorial/official-syllabus-extractor";

export const OFFICIAL_COURSE_STANDING_REFERENCE =
  "owner-standing-2026-10-12:official-sources-programs";

type EvidenceClaim = Readonly<{ field: string; page: number; contains: readonly string[] }>;
export type OfficialCourseDossierRecipe = Readonly<{
  productSlug: string;
  noticeUrl: string;
  title: string;
  institution: string;
  role: string;
  jurisdiction: string;
  edition: string;
  bankScope: string;
  pageCount: number;
  programme: Readonly<{ startPage: number; endPage: number; anchor: string }>;
  claims: readonly EvidenceClaim[];
  limitations: readonly string[];
}>;

// Deliberately bounded: adding another dossier requires its own verified recipe.
// The prepared discovery queue is never treated as evidence of approval.
export const OFFICIAL_COURSE_DOSSIER_RECIPES: readonly OfficialCourseDossierRecipe[] = [
  {
    productSlug: "mpe-go-promotor-de-justica-2025",
    noticeUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/edital-retificado-publicado.pdf",
    title: "Edital 182/2025-CSMP — 63º concurso MPGO, retificado em 26/09/2025",
    institution: "Ministério Público do Estado de Goiás",
    role: "Promotora e Promotor de Justiça Substituto",
    jurisdiction: "GO",
    edition: "182/2025-CSMP",
    bankScope: "FGV: inscrições provisórias e prova preambular; MPGO: fases subsequentes",
    pageCount: 69,
    programme: { startPage: 49, endPage: 63, anchor: "PROGRAMA/CONTEÚDO POR GRUPO DE DISCIPLINAS" },
    claims: [
      { field: "identity", page: 1, contains: ["ESTADO DE GOIÁS", "182/2025-CSMP", "Justiça Substituto"] },
      { field: "bankScope", page: 1, contains: ["inscrições provisórias", "Fundação Getulio Vargas", "executado pelo próprio Ministério Público"] },
      { field: "programme", page: 49, contains: ["PROGRAMA", "GRUPO", "DIREITO PENAL"] },
    ],
    limitations: [
      "Página 1 cita sessão em 15/10/2025, mas assinatura/publicação em 26/09/2025; não inferir ou aprovar a data da sessão.",
      "Programa deve ser usado para treino histórico com legislação atual; não reproduz o corte normativo original da prova.",
      "FGV não executa automaticamente todas as fases do certame.",
      "Cronograma prevê prova preambular em 01/02/2026; publicação do caderno em 02/02/2026 não é a data da aplicação.",
      "Demais retificações/comunicados e vínculos legais exigem conferência própria antes da admissão comercial.",
    ],
  },
  {
    productSlug: "mpe-mt-promotor-de-justica-2026",
    noticeUrl: "https://conhecimento.fgv.br/sites/default/files/concursos/edital_n_01_2026_compilado_ate_a_1_a_retificacao_de_20_07_2026-1.pdf",
    title: "Edital 01/2026 MPMT — compilado até retificação de 20/07/2026",
    institution: "Ministério Público do Estado de Mato Grosso",
    role: "Promotor de Justiça Substituto",
    jurisdiction: "MT",
    edition: "01/2026",
    bankScope: "FGV e Comissão do MPMT; oral, inscrição definitiva e investigação social possuem atribuição própria",
    pageCount: 66,
    programme: { startPage: 33, endPage: 64, anchor: "ANEXO I" },
    claims: [
      { field: "identity", page: 1, contains: ["MATO GROSSO", "01/2026", "Promotor de Justiça Substituto"] },
      { field: "programme", page: 33, contains: ["ANEXO I", "CONTEÚDO PROGRAMÁTICO", "GRUPO"] },
      { field: "bankAndNoticeDate", page: 32, contains: ["FGV em conjunto com a Comissão de Concurso do MPMT", "17 de março de 2026"] },
      { field: "objectiveSchedule", page: 18, contains: ["Prova Preambular Objetiva", "14 de junho de 2026"] },
    ],
    limitations: [
      "Provas objetivas/discursivas já ocorreram; treino histórico com legislação atual, sem presumir edital futuro.",
      "Não transferir perfil objetivo para as provas discursivas ou orais.",
      "Retificação de 20/07/2026 e atribuições da Comissão precisam acompanhar a admissão.",
      "Não aprova fontes legais, respostas, questões, direitos de reprodução ou acesso comercial.",
    ],
  },
];

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase().trim();
}

/** MPMT uses "1 a)" rather than "1.". Preserve its source lines verbatim,
 * including continuation pages, and split only at actual lettered subitems. */
export function extractLetteredProgrammeCandidates(pages: readonly string[], startPage: number) {
  const items: { requirementText: string; pageNumber: number; sourceLocator: string; suggestedSubjectId: null; suggestedSubjectName: string }[] = [];
  let subject = "";
  let pending: { lines: string[]; page: number } | null = null;
  const flush = () => {
    if (!pending) return;
    const text = pending.lines.join(" ").replace(/\s+/g, " ").trim();
    const parts = text.split(/\s+(?=[b-z]\)\s+[A-ZÀ-ÖØ-Þ])/u);
    for (const part of parts) {
      // Retain long subitems in bounded contiguous source-line chunks.
      let current = "";
      for (const sentence of part.split(/(?<=\.)\s+(?=[A-ZÀ-ÖØ-Þ])/u)) {
        if (current && current.length + sentence.length + 1 > 2000) {
          items.push({ requirementText: current, pageNumber: pending.page, sourceLocator: `Conteúdo programático, p. ${pending.page} · ${subject}`, suggestedSubjectId: null, suggestedSubjectName: subject });
          current = "";
        }
        if (sentence.length > 2000) throw new Error("Subitem longo sem fronteira segura; programa requer extração própria.");
        current = current ? `${current} ${sentence}` : sentence;
      }
      if (current.length >= 8) items.push({ requirementText: current, pageNumber: pending.page, sourceLocator: `Conteúdo programático, p. ${pending.page} · ${subject}`, suggestedSubjectId: null, suggestedSubjectName: subject });
    }
    pending = null;
  };
  pages.forEach((page, index) => {
    for (const line of page.split(/\n+/u).map((value) => value.trim()).filter(Boolean)) {
      if (/^MINISTÉRIO PÚBLICO DO ESTADO DE MATO GROSSO \| CONCURSO PÚBLICO \d+$/u.test(line) || /^GRUPO \d+:/u.test(line) || /^ANEXO /u.test(line)) continue;
      if (/^[A-ZÀ-ÖØ-Þ ,–-]{5,100}$/u.test(line)) { flush(); subject = line; continue; }
      if (!subject) continue;
      if (/^\d+\s+a\)\s+/u.test(line)) { flush(); pending = { lines: [line], page: startPage + index }; }
      else if (pending) pending.lines.push(line);
    }
  });
  flush();
  const seen = new Set<string>();
  return items.filter((item) => { if (seen.has(item.requirementText)) return false; seen.add(item.requirementText); return true; });
}

export function buildOfficialCourseDossierPreview(
  recipe: OfficialCourseDossierRecipe,
  document: CapturedOfficialDocument,
  capturedAt: string,
) {
  if (!Number.isFinite(Date.parse(capturedAt))) throw new Error("Data de captura inválida.");
  if (document.documentUrl !== recipe.noticeUrl) throw new Error("Documento final diverge da receita verificada.");
  if (document.pageCount !== recipe.pageCount || document.pageTexts.length !== recipe.pageCount) {
    throw new Error("Paginação mudou; reconferir identidade e programa.");
  }
  const actualHash = createHash("sha256").update(document.documentBytes).digest("hex");
  if (actualHash !== document.checksumSha256) throw new Error("Hash da captura diverge dos bytes.");
  const evidence = recipe.claims.map((claim) => {
    const page = normalized(document.pageTexts[claim.page - 1] ?? "");
    if (!claim.contains.every((token) => page.includes(normalized(token)))) {
      throw new Error(`Evidência ${claim.field} ausente na página ${claim.page}; bloquear admissão.`);
    }
    return { ...claim, sourceUrl: document.documentUrl, checksumSha256: actualHash };
  });
  const { startPage, endPage, anchor } = recipe.programme;
  if (startPage < 1 || endPage < startPage || endPage > document.pageCount) throw new Error("Intervalo do programa inválido.");
  if (!normalized(document.pageTexts[startPage - 1]).includes(normalized(anchor))) throw new Error("Abertura do programa ausente.");
  const programmePages = document.pageTexts.slice(startPage - 1, endPage);
  const programmeHash = createHash("sha256").update(JSON.stringify(programmePages)).digest("hex");
  const extracted = extractOfficialSyllabusCandidates(programmePages, []);
  const programmeRequirements = (extracted.length ? extracted.map((candidate) => ({
    ...candidate,
    pageNumber: candidate.pageNumber + startPage - 1,
    sourceLocator: candidate.sourceLocator.replace(/p\. (\d+)/u, (_, page: string) => `p. ${Number(page) + startPage - 1}`),
  })) : extractLetteredProgrammeCandidates(programmePages, startPage)).map((candidate) => ({
    ...candidate,
    sourceDocumentChecksumSha256: actualHash,
    approved: false,
    legalMappingApplied: false,
  }));
  return {
    schemaVersion: 1,
    mode: "preview" as const,
    productSlug: recipe.productSlug,
    capturedAt,
    identity: { institution: recipe.institution, role: recipe.role, jurisdiction: recipe.jurisdiction, edition: recipe.edition, bankScope: recipe.bankScope },
    capture: { sourceUrl: document.documentUrl, sourceHost: document.sourceHost, checksumSha256: actualHash, byteLength: document.byteLength, pageCount: document.pageCount, parserVersion: document.parserVersion },
    programme: { ...recipe.programme, checksumSha256: programmeHash, pages: programmePages.map((text, index) => ({ page: startPage + index, text })) },
    programmeRequirements,
    evidence,
    proposedPreparationMode: "historical_training" as const,
    legislationPolicy: "current_official_version" as const,
    review: { approvalBasis: "owner_standing_authorization", approvalReference: OFFICIAL_COURSE_STANDING_REFERENCE, humanReview: false, applied: false },
    limitations: recipe.limitations,
    publicationAllowed: false,
    productsReleased: 0,
    databaseMutations: 0,
    admissionPending: ["opportunity_and_organizer_scope", "source_and_snapshot", "programme_requirements", "current_law_mapping", "product_association_and_mode", "previous_exam_links", "valid_original_question_minimum"],
  };
}
