import { describe, expect, it, vi } from "vitest";

vi.mock("postgres", () => ({ default: vi.fn() }));

import { compositeCourseTarget, compositeProgrammeRequirements } from "@/lib/editorial/composite-course-admission";
import { extractDossierSubjectSections, NEXT_OFFICIAL_COURSE_RECIPES, previousExamAdmissionBlocker, type PreviewDocumentRecipe } from "@/lib/editorial/official-course-preview-candidates";
import { PROGRAMME_CLASSIFICATION_SCOPES } from "@/lib/editorial/programme-subject-classification";
import { assertFgvHistoricalNoticeEvidence, fgvHistoricalPreviousExam } from "@/lib/exams/fgv-historical-previous-exam-admission";
import { FGV_HISTORICAL_PREVIOUS_PAIRS } from "@/lib/exams/previous-exam-link-command";
import { parseOfficialOpportunitySourceUrl } from "@/lib/opportunities/source-monitor-policy";

const LOTE2 = ["tj-go-juiz-de-direito-2026", "trf-2-juiz-federal-2-regiao"];
const recipeOf = (slug: string) => NEXT_OFFICIAL_COURSE_RECIPES.find((item) => item.productSlug === slug)!;
const capture = (doc: PreviewDocumentRecipe, pages: Record<number, string>) => ({
  documentUrl: doc.url, checksumSha256: "a".repeat(64),
  pageTexts: Array.from({ length: doc.pages }, (_, index) => pages[index + 1] ?? ""),
});

describe("lote 2 FGV histórico — TJGO e TRF-2", () => {
  it("tem receita com layout, alvo composto, origens oficiais exatas e escopo", () => {
    for (const slug of LOTE2) {
      const { target, recipe } = compositeCourseTarget(slug);
      expect(recipe.proposedMode).toBe("historical_training");
      expect(recipe.documents[0].layout!.headings).toHaveLength(recipe.expectedSubjects);
      for (const url of [...recipe.documents.map((doc) => doc.url), ...target.stages.map((stage) => stage.url)]) expect(parseOfficialOpportunitySourceUrl(url, "fgv-conhecimento").url).toBe(url);
      expect(previousExamAdmissionBlocker(recipe.previousExam)).toBeNull();
      expect(FGV_HISTORICAL_PREVIOUS_PAIRS[slug]).toBe(fgvHistoricalPreviousExam(slug).editionPublicId);
      expect((PROGRAMME_CLASSIFICATION_SCOPES as Record<string, string>)[fgvHistoricalPreviousExam(slug).opportunitySlug]).toBe(recipe.role);
    }
    // TRF-2 é tribunal regional; os demais alvos continuam estaduais.
    expect(compositeCourseTarget("trf-2-juiz-federal-2-regiao").target).toMatchObject({ scope: "regional", cycleYear: 2025 });
    expect("scope" in compositeCourseTarget("tj-go-juiz-de-direito-2026").target).toBe(false);
  });

  it("TRF-2: título conjunto, subtítulos A)–H) e notas de resolução não viram requisitos", () => {
    const doc = recipeOf("trf-2-juiz-federal-2-regiao").documents[0];
    const lines: string[] = [];
    for (const [index, heading] of doc.layout!.headings.entries()) {
      if (heading.line === "DIREITO FINANCEIRO") lines.push("DIREITO FINANCEIRO E TRIBUTÁRIO");
      lines.push("Edital 154 (1438979) SEI 0026204-71.2025.4.02.8000 / pg. 44", heading.line);
      if (heading.line.startsWith("NOÇÕES")) lines.push("A) SOCIOLOGIA DO DIREITO", "F) DIREITO DIGITAL (incluído pela Resolução n. 423, de 5.10.2021).",
        "G) PRAGMATISMO, ANÁLISE ECONÔMICA DO DIREITO E ECONOMIA COMPORTAMENTAL", "(incluído pela Resolução n. 423, de 5.10.2021).");
      if (heading.line === "DIREITOS HUMANOS") lines.push("(Resolução n. 496, de 3.4.2023)");
      lines.push(`${index + 1}. Tema ${index} da disciplina.`, `continuação do tema ${index}.`);
    }
    const sections = extractDossierSubjectSections(doc, capture(doc, { 30: lines.join("\n") }));
    expect(sections.map((section) => section.subject)).toEqual(doc.layout!.headings.map((heading) => heading.subject));
    const requirements = compositeProgrammeRequirements(sections);
    expect(requirements).toHaveLength(doc.layout!.headings.length);
    expect(requirements.every((item) => /^\d+\. Tema \d+ da disciplina\. continuação do tema \d+\.$/u.test(item.requirementText))).toBe(true);
  });

  it("TJGO: cabeçalho numerado da página e blocos são descartados", () => {
    const doc = recipeOf("tj-go-juiz-de-direito-2026").documents[0];
    const lines = doc.layout!.headings.flatMap((heading, index) => ["44TRIBUNAL DE JUSTIÇA DO ESTADO DE GOIÁS", "BLOCO II", heading.line, `${index + 1}. Tema ${index}.`]);
    const sections = extractDossierSubjectSections(doc, capture(doc, { 43: lines.join("\n") }));
    expect(sections.flatMap((section) => section.fragments.map((fragment) => fragment.text)).some((text) => /TRIBUNAL|BLOCO/u.test(text))).toBe(false);
  });

  it("evidência do edital exige hash, páginas e trechos exatos", () => {
    const target = fgvHistoricalPreviousExam("tj-go-juiz-de-direito-2026");
    const pageTexts = Array.from({ length: target.noticePageCount }, () => "");
    pageTexts[0] = "59º CONCURSO DE JUIZ SUBSTITUTO DO ESTADO DE GOIÁS";
    pageTexts[18] = "12.1 A Prova Objetiva Seletiva ... está prevista para o dia 29 de\nmarço de 2026 ... 12.5 A Prova Objetiva Seletiva será composta por 100 (cem) questões de múltipla escolha,\nnumeradas sequencialmente, com 05 (cinco) alternativas e apenas uma resposta correta.";
    expect(() => assertFgvHistoricalNoticeEvidence(target, { checksum: target.noticeSha256, pages: target.noticePageCount, pageTexts })).not.toThrow();
    expect(() => assertFgvHistoricalNoticeEvidence(target, { checksum: "b".repeat(64), pages: target.noticePageCount, pageTexts })).toThrow();
    pageTexts[18] = pageTexts[18].replace("29 de\nmarço", "30 de março");
    expect(() => assertFgvHistoricalNoticeEvidence(target, { checksum: target.noticeSha256, pages: target.noticePageCount, pageTexts })).toThrow();
  });
});
