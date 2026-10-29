import { describe, expect, it, vi, afterEach } from "vitest";

const state = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("postgres", () => ({ default: state.connect }));

import { compositeCourseTarget, compositeProgrammeRequirements, COMPOSITE_ADMISSION_TARGETS } from "@/lib/editorial/composite-course-admission";
import { extractDossierSubjectSections, NEXT_OFFICIAL_COURSE_RECIPES, previousExamAdmissionBlocker, type PreviewDocumentRecipe } from "@/lib/editorial/official-course-preview-candidates";
import { officialFormatEvidenceMatches } from "@/lib/editorial/official-question-contract";
import { assertFgvHistoricalAnchors, assertFgvHistoricalNoticeEvidence, assertFgvRegistrationRequest, fgvHistoricalPreviousExam, FGV_HISTORICAL_PREVIOUS_EXAMS, previewFgvHistoricalPreviousExam } from "@/lib/exams/fgv-historical-previous-exam-admission";
import { FGV_HISTORICAL_PREVIOUS_PAIRS, parsePreviousExamLinkCommand } from "@/lib/exams/previous-exam-link-command";
import { parseOfficialOpportunitySourceUrl } from "@/lib/opportunities/source-monitor-policy";
import { parseFgvHistoricalPreviousExamArgs } from "../scripts/register-fgv-historical-previous-exam-links";

const LOTE = ["tj-pr-juiz-de-direito-2025-2026", "tj-ba-juiz-de-direito-2026", "tj-pe-juiz-de-direito-2026", "mpe-go-promotor-de-justica-2025"];
const recipeOf = (slug: string) => NEXT_OFFICIAL_COURSE_RECIPES.find((item) => item.productSlug === slug)!;
const capture = (doc: PreviewDocumentRecipe, pages: Record<number, string>) => ({
  documentUrl: doc.url, checksumSha256: "a".repeat(64),
  pageTexts: Array.from({ length: doc.pages }, (_, index) => pages[index + 1] ?? ""),
});

/** Programa sintético com os títulos literais do layout, ruído e continuações reais. */
function syntheticProgramme(doc: PreviewDocumentRecipe, noise: readonly string[]) {
  const [start] = doc.programmePages!;
  const lines = doc.layout!.headings.flatMap((heading, index) => [
    ...noise, heading.line, ...(heading.continuation ? [heading.continuation] : []), `1. Tema ${index} da disciplina.`, `continuação do tema ${index}.`,
  ]);
  return { [start]: lines.join("\n") };
}

afterEach(() => { vi.clearAllMocks(); });

describe("lote FGV histórico — receitas e layout do anexo", () => {
  it("cada produto do lote tem receita com layout, alvo composto e origens oficiais exatas", () => {
    for (const slug of LOTE) {
      const { target, recipe } = compositeCourseTarget(slug);
      expect(recipe.proposedMode).toBe("historical_training");
      expect(recipe.documents.every((doc) => doc.layout && doc.programmePages)).toBe(true);
      expect(recipe.documents[0].layout!.headings).toHaveLength(recipe.expectedSubjects);
      expect(target.stages.length).toBeGreaterThan(0);
      for (const url of [...recipe.documents.map((doc) => doc.url), ...target.stages.map((stage) => stage.url)]) expect(parseOfficialOpportunitySourceUrl(url, "fgv-conhecimento").url).toBe(url);
    }
    expect(COMPOSITE_ADMISSION_TARGETS.find((item) => item.productSlug === "tj-pr-juiz-de-direito-2025-2026")).toMatchObject({ cycleYear: 2025, lifecycleStatus: "result_published" });
    expect(COMPOSITE_ADMISSION_TARGETS.find((item) => item.productSlug === "tj-pe-juiz-de-direito-2026")).toMatchObject({ cycleYear: 2026, lifecycleStatus: "exam_held" });
    // Alvos já admitidos mantêm os valores que o operador gravava antes.
    for (const slug of ["mpe-rj-promotor-de-justica-2026", "pge-ac-procurador-do-estado-reta-final"]) expect(compositeCourseTarget(slug).target).toMatchObject({ cycleYear: 2026, lifecycleStatus: "result_published" });
    expect(() => compositeCourseTarget("tce-ma-analista-e-tecnico-2026")).toThrow();
  });

  it("extrai disciplinas pelos títulos literais, descartando cabeçalhos e rodapés", () => {
    const doc = recipeOf("tj-pr-juiz-de-direito-2025-2026").documents[0];
    const noise = ["TRIBUNAL DE JUSTIÇA DO ESTADO DO PARANÁ | CONCURSO PÚBLICO 2025 75", "BLOCO II"];
    const sections = extractDossierSubjectSections(doc, capture(doc, syntheticProgramme(doc, noise)));
    expect(sections.map((section) => section.subject)).toEqual(doc.layout!.headings.map((heading) => heading.subject));
    expect(sections.flatMap((section) => section.fragments.map((fragment) => fragment.text)).some((text) => /TRIBUNAL|BLOCO|ESTADUAL Nº/u.test(text))).toBe(false);
    expect(sections[10].subject).toBe("Código de Organização e Divisão Judiciárias do Estado do Paraná");
  });

  it("título ausente, repetido, fora de ordem ou continuação divergente bloqueiam a composição", () => {
    const doc = recipeOf("tj-pr-juiz-de-direito-2025-2026").documents[0];
    const [start] = doc.programmePages!;
    const valid = syntheticProgramme(doc, [])[start];
    const variants = [
      valid.replace("DIREITO AMBIENTAL\n", ""),
      valid.replace("DIREITO CIVIL\n1. Tema 0 da disciplina.", "DIREITO PROCESSUAL CIVIL\n1. Tema 0 da disciplina."),
      valid.replace("ESTADUAL Nº 14.277/2003)", "ESTADUAL Nº 99.999/2003)"),
      valid.replace("DIREITOS HUMANOS\n1. Tema 17 da disciplina.\ncontinuação do tema 17.", "DIREITOS HUMANOS"),
    ];
    for (const text of variants) expect(() => extractDossierSubjectSections(doc, capture(doc, { [start]: text }))).toThrow();
  });

  it("programa em prosa separa itens numerados da mesma linha e o número isolado no fim", () => {
    const doc = recipeOf("tj-ba-juiz-de-direito-2026").documents[0];
    const [start] = doc.programmePages!;
    const body = doc.layout!.headings.map((heading, index) => index === 0 ? `${heading.line}\n1. Primeiro tema. 2. Segundo tema. 3.\nTerceiro tema.` : `${heading.line}\n1. Tema próprio ${index}.`).join("\n");
    const sections = extractDossierSubjectSections(doc, capture(doc, { [start]: body }));
    expect(sections[0].fragments.map((fragment) => fragment.text)).toEqual(["1. Primeiro tema.", "2. Segundo tema.", "3. Terceiro tema."]);
    const requirements = compositeProgrammeRequirements(sections);
    expect(requirements.filter((item) => item.sourceLocator.includes("Direito Civil")).map((item) => item.requirementText)).toEqual(["1. Primeiro tema.", "2. Segundo tema.", "3. Terceiro tema."]);
  });

  it("só repete requisito literal entre disciplinas quando a receita o declara", () => {
    const generic = "17. Súmulas, jurisprudência dos Tribunais Superiores e legislação relacionada com os temas.";
    const sections = ["Direito Penal", "Direito Civil"].map((subject) => ({ subject, documentKey: "mpgo-notice", sourceUrl: "https://x", checksumSha256: "a".repeat(64), fragments: [{ page: 49, text: `1. Tema de ${subject}.` }, { page: 49, text: generic }] }));
    expect(() => compositeProgrammeRequirements(sections)).toThrow(/duplicado/u);
    const requirements = compositeProgrammeRequirements(sections, recipeOf("mpe-go-promotor-de-justica-2025").repeatableRequirements);
    expect(requirements.filter((item) => item.requirementText === generic)).toHaveLength(1);
    expect(requirements).toHaveLength(3);
  });

  it("TJPE sem gabarito definitivo fica com prova anterior bloqueada e fora do cadastro", () => {
    expect(previousExamAdmissionBlocker(recipeOf("tj-pe-juiz-de-direito-2026").previousExam)).toMatch(/missing answer_key/u);
    for (const slug of LOTE.filter((slug) => slug !== "tj-pe-juiz-de-direito-2026")) expect(previousExamAdmissionBlocker(recipeOf(slug).previousExam)).toBeNull();
    expect(() => fgvHistoricalPreviousExam("tj-pe-juiz-de-direito-2026")).toThrow();
  });
});

describe("lote FGV histórico — prova anterior por metadados", () => {
  const target = FGV_HISTORICAL_PREVIOUS_EXAMS[0];
  const html = `<h1>Concurso Público para o ${target.portalHeading}</h1><a href="${target.portalNotice.url}">${target.portalNotice.label}</a>${target.documents.map((doc) => `<div class="paragraph--type--texto-data"><time datetime="${doc.publishedOn}T12:00:00Z"></time>${(doc.blockIncludes ?? []).join(" ")} <a href="${doc.url}">${doc.label}</a></div>`).join("")}`;

  it("âncoras exigem órgão, edital, rótulo, data e bloco exatos", () => {
    expect(() => assertFgvHistoricalAnchors(target, html)).not.toThrow();
    // Script de CDN com token por requisição não muda o que foi conferido.
    expect(assertFgvHistoricalAnchors(target, html + "<script>token=1</script>")).toBe(assertFgvHistoricalAnchors(target, html + "<script>token=2</script>"));
    for (const changed of [html.replace(target.portalHeading, "Tribunal de outro Estado"), html.replace("Gabarito Definitivo", "Gabarito Preliminar"),
      html.replace(target.documents[0].publishedOn, "2026-01-01"), html.replace("Prova Objetiva Seletiva", "Prova Discursiva"),
      html.replace(target.portalNotice.label, "Edital"), html + `<a href="${target.documents[1].url}">${target.documents[1].label}</a>`]) expect(() => assertFgvHistoricalAnchors(target, changed)).toThrow();
  });

  it("prévia usa só robots, HTML e verificador de assinatura, sem banco", async () => {
    const verifier = vi.fn(async (_bank: string, url: string) => ({ httpStatus: 200, isPdf: true, finalUrl: url, checkedAt: new Date(), contentType: "application/pdf", pageTitle: null }));
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0]) => { const robots = String(url).endsWith("robots.txt"); const response = new Response(robots ? "User-agent: *\nDisallow: /search/" : html, { status: 200, headers: { "content-type": robots ? "text/plain" : "text/html" } }); Object.defineProperty(response, "url", { value: String(url) }); return response; });
    const result = await previewFgvHistoricalPreviousExam(target, { fetcher: fetcher as typeof fetch, verifier });
    expect(state.connect).not.toHaveBeenCalled();
    expect(result).toMatchObject({ databaseWrites: 0, questionsImported: 0, productsReleased: 0, humanReview: false, publicationAllowed: false });
    expect(result.documents.every((doc) => doc.sourceContentStored === false && doc.status === "pending_review")).toBe(true);
  });

  it("edital aprovado precisa do hash, páginas e trechos de formato/data", () => {
    const pageTexts = Array.from({ length: target.noticePageCount }, () => "");
    pageTexts[32] = "10.1 A Prova Objetiva Seletiva está prevista para o dia 22 de fevereiro de 2026.\n10.4 A Prova Objetiva Seletiva será composta por 100 (cem) questões de múltipla escolha, numeradas sequencialmente, com 5 (cinco) alternativas e apenas uma resposta correta.";
    pageTexts[0] = "provimento de 18 vagas para o cargo de Juiz Substituto";
    const valid = { checksum: target.noticeSha256, pages: target.noticePageCount, pageTexts };
    expect(() => assertFgvHistoricalNoticeEvidence(target, valid)).not.toThrow();
    // Quebra de linha do PDF dentro da cláusula não invalida a evidência.
    expect(() => assertFgvHistoricalNoticeEvidence(target, { ...valid, pageTexts: pageTexts.map((text, index) => index === 32 ? text.replace("múltipla escolha", "múltipla\nescolha") : text) })).not.toThrow();
    for (const patch of [{ checksum: "b".repeat(64) }, { pages: 117 }, { pageTexts: pageTexts.map((text, index) => index === 32 ? text.replace("5 (cinco)", "4 (quatro)") : text) },
      { pageTexts: pageTexts.map((text, index) => index === 32 ? text.replace("22 de fevereiro", "29 de março") : text) }]) expect(() => assertFgvHistoricalNoticeEvidence(target, { ...valid, ...patch })).toThrow();
  });

  it("apply exige produto do lote, oportunidade UUID, hash e fingerprint", () => {
    expect(parseFgvHistoricalPreviousExamArgs([`--product=${target.productSlug}`])).toMatchObject({ apply: false, databasePreview: false });
    const identity = [`--product=${target.productSlug}`, "--opportunity=0f7ba2b8-797e-4939-a86f-57077eea58a5", `--expected-notice-sha256=${target.noticeSha256}`];
    expect(parseFgvHistoricalPreviousExamArgs(identity)).toMatchObject({ apply: false, databasePreview: true });
    expect(parseFgvHistoricalPreviousExamArgs([...identity, "--apply", `--expected-fingerprint=${"a".repeat(64)}`]).apply).toBe(true);
    for (const args of [[], ["--product=tj-pe-juiz-de-direito-2026"], [...identity, "--apply"], [identity[0], "--opportunity=nao-uuid", identity[2]], [identity[0], identity[1], "--expected-notice-sha256=" + "c".repeat(64)], [identity[0], "--output=../../public"]]) expect(() => parseFgvHistoricalPreviousExamArgs(args)).toThrow();
    expect(() => assertFgvRegistrationRequest({ productSlug: target.productSlug, mode: "apply", opportunityPublicId: "0f7ba2b8-797e-4939-a86f-57077eea58a5", expectedNoticeSha256: target.noticeSha256 })).toThrow();
  });

  it("standing aceita só os pares exatos do lote, uma edição por vez", () => {
    for (const [product, edition] of Object.entries(FGV_HISTORICAL_PREVIOUS_PAIRS)) {
      expect(parsePreviousExamLinkCommand(["--standing", `${product}=${edition}`]).standing).toBe(true);
      expect(FGV_HISTORICAL_PREVIOUS_EXAMS.find((item) => item.productSlug === product)?.editionPublicId).toBe(edition);
    }
    expect(() => parsePreviousExamLinkCommand(["--standing", "tj-pr-juiz-de-direito-2025-2026=tjba-juiz-substituto-01-2026-objetiva"])).toThrow();
    expect(() => parsePreviousExamLinkCommand(["--standing", "tj-pe-juiz-de-direito-2026=tjpe-juiz-substituto-01-2026-objetiva"])).toThrow();
  });
});

describe("contrato de formato — cláusula do MPGO", () => {
  it("reconhece cinco alternativas com somente uma opção correta, sem aceitar variação", () => {
    const clause = "12.4. As questões de múltipla escolha conterão 5 (cinco) alternativas, com somente uma opção correta a ser marcada pela candidata ou candidato.";
    expect(officialFormatEvidenceMatches("multiple_choice", clause)).toBe(true);
    expect(officialFormatEvidenceMatches("multiple_choice", clause.replace("somente uma opção correta", "mais de uma opção correta"))).toBe(false);
    expect(officialFormatEvidenceMatches("true_false", clause)).toBe(false);
  });
});
