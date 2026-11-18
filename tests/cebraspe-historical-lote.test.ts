import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("postgres", () => ({ default: state.connect }));

import { compositeBank, compositeCourseTarget, compositeProgrammeRequirements } from "@/lib/editorial/composite-course-admission";
import { extractDossierSubjectSections, NEXT_OFFICIAL_COURSE_RECIPES, type PreviewDocumentRecipe } from "@/lib/editorial/official-course-preview-candidates";
import { PROGRAMME_CLASSIFICATION_SCOPES, programmeCanonicalSubject, programmeLiteralHeadingName } from "@/lib/editorial/programme-subject-classification";
import { assertCebraspeHistoricalEvent, CEBRASPE_HISTORICAL_PREVIOUS_EXAMS } from "@/lib/exams/cebraspe-historical-previous-exams";
import { assertFgvHistoricalNoticeEvidence, fgvHistoricalPreviousExam, previewFgvHistoricalPreviousExam } from "@/lib/exams/fgv-historical-previous-exam-admission";
import { FGV_HISTORICAL_PREVIOUS_PAIRS, parsePreviousExamLinkCommand } from "@/lib/exams/previous-exam-link-command";
import { parseOfficialOpportunitySourceUrl } from "@/lib/opportunities/source-monitor-policy";

const recipeOf = (slug: string) => NEXT_OFFICIAL_COURSE_RECIPES.find((item) => item.productSlug === slug)!;
const capture = (doc: PreviewDocumentRecipe, pages: Record<number, string>) => ({
  documentUrl: doc.url, checksumSha256: "a".repeat(64),
  pageTexts: Array.from({ length: doc.pages }, (_, index) => pages[index + 1] ?? ""),
});
const fileName = (url: string) => url.split("/").at(-1)!;

describe("lote Cebraspe histórico — SEFAZ-RN", () => {
  const slug = "sefaz-rn-auditor-fiscal-reta-final";
  it("receita, alvo composto Cebraspe, categoria do catálogo, prova anterior e escopo", () => {
    const recipe = recipeOf(slug);
    const { target } = compositeCourseTarget(slug);
    expect(target).toMatchObject({ category: "fiscal-e-controle", career: "auditor-fiscal", bank: "cebraspe" });
    expect(compositeBank(target)).toMatchObject({ bankSlug: "cebraspe", sourceId: "cebraspe" });
    expect(recipe.documents[0].layout!.headings).toHaveLength(recipe.expectedSubjects);
    expect(parseOfficialOpportunitySourceUrl(recipe.documents[0].url)?.sourceId).toBe("cebraspe");
    const previous = fgvHistoricalPreviousExam(slug);
    expect(previous).toMatchObject({ bank: "cebraspe", cebraspeEventId: "SEFAZ_RN_25_AUDITOR", expectedQuestionCount: 80, examDate: recipe.examDate });
    expect(FGV_HISTORICAL_PREVIOUS_PAIRS[slug]).toBe(previous.editionPublicId);
    expect(PROGRAMME_CLASSIFICATION_SCOPES[target.slug as keyof typeof PROGRAMME_CLASSIFICATION_SCOPES]).toBe(recipe.role);
    expect(parsePreviousExamLinkCommand(["--standing", `${slug}=${previous.editionPublicId}`]).standing).toBe(true);
    expect(() => parsePreviousExamLinkCommand(["--standing", `${slug}=outra-edicao`])).toThrow();
  });

  it("FGV continua o padrão da admissão composta", () => {
    expect(compositeBank(compositeCourseTarget("tj-go-juiz-de-direito-2026").target)).toMatchObject({ bankSlug: "fgv", sourceId: "fgv-conhecimento" });
  });

  it("título inline com dois-pontos abre a seção, inclusive sem espaço, e agrupa pelo número de primeiro nível", () => {
    const doc = recipeOf(slug).documents[0];
    const lines: string[] = ["13.2.2 CONHECIMENTOS GERAIS"];
    doc.layout!.headings.forEach((heading, index) => {
      lines.push(index === 12 ? `${heading.line}:1 Tema ${index}. 1.1 Sub.` : `${heading.line}: 1 Tema ${index}. 1.1 Sub. 2 Outro`, `tema ${index}.`);
    });
    lines.push("IRANILDO GERMANO DOS SANTOS", "Secretário de Estado da Administração");
    const sections = extractDossierSubjectSections(doc, capture(doc, { 31: lines.join("\n") }));
    expect(sections.map((section) => section.subject)).toEqual(doc.layout!.headings.map((heading) => heading.subject));
    const requirements = compositeProgrammeRequirements(sections, [], true);
    const civil = requirements.filter((item) => item.sourceLocator.includes("· Direito Civil ·")).map((item) => item.requirementText);
    expect(civil).toEqual(["1 Tema 4. 1.1 Sub.", "2 Outro tema 4."]);
    expect(requirements.find((item) => item.sourceLocator.includes("· Tecnologia da Informação ·"))!.requirementText).toBe("1 Tema 12. 1.1 Sub. tema 12.");
    expect(requirements.some((item) => /IRANILDO|DIREITO CIVIL/u.test(item.requirementText))).toBe(false);
  });

  it("título com ponto (FGV) continua exigindo espaço", () => {
    const doc = recipeOf("tj-ms-cartorios-reta-final").documents[0];
    expect(doc.layout!.headings.every((heading) => heading.inlineSeparator === undefined)).toBe(true);
  });

  it("nome literal do título inline com dois-pontos", () => {
    expect(programmeCanonicalSubject(programmeLiteralHeadingName("DIREITO CONSTITUCIONAL: 1 Aplicabilidade e interpretação das normas constitucionais."))).toBe("Direito Constitucional");
    expect(programmeLiteralHeadingName("DIREITO TRIBUTÁRIO I - GERAL: 1 Sistema Tributário Nacional.")).toBe("DIREITO TRIBUTÁRIO I - GERAL");
    expect(programmeCanonicalSubject(programmeLiteralHeadingName("DIREITO COMERCIAL: 1 O estabelecimento"))).toBeNull();
  });
});

describe("lote Cebraspe histórico — prova anterior pela API oficial do evento", () => {
  const target = CEBRASPE_HISTORICAL_PREVIOUS_EXAMS[0];
  const payload = () => ({
    eventoURL: target.cebraspeEventId, eventoNomeCompleto: `${target.portalHeading} `,
    arquivosEdital: [{ nomeArquivo: fileName(target.portalNotice.url), descricaoArquivo: `${target.portalNotice.label} `, dataArquivoObj: "2025-12-19T10:00:00", isGuid: false }],
    arquivosGabarito: target.documents.map((doc) => ({ nomeArquivo: fileName(doc.url), descricaoArquivo: doc.label, dataArquivoObj: `${doc.publishedOn}T19:00:00`, isGuid: false })),
  });

  it("confere evento, edital, descrição e data de cada documento", () => {
    expect(() => assertCebraspeHistoricalEvent(target, payload())).not.toThrow();
    const changes: ((value: ReturnType<typeof payload>) => void)[] = [
      (value) => { value.eventoURL = "OUTRO_EVENTO_25"; },
      (value) => { value.eventoNomeCompleto = "TCE RN 25"; },
      (value) => { value.arquivosEdital[0].descricaoArquivo = "Edital nº 2 – Retificação"; },
      (value) => { value.arquivosGabarito[1].descricaoArquivo = "GABARITO PRELIMINAR – CONHECIMENTOS ESPECÍFICOS (P3)"; },
      (value) => { value.arquivosGabarito[0].dataArquivoObj = "2026-01-01T00:00:00"; },
      (value) => { value.arquivosGabarito.push({ ...value.arquivosGabarito[0] }); },
      (value) => { value.arquivosGabarito = []; },
    ];
    for (const change of changes) { const value = payload(); change(value); expect(() => assertCebraspeHistoricalEvent(target, value)).toThrow(); }
  });

  it("documento de outro evento é recusado", () => {
    const other = { ...target, documents: [{ ...target.documents[0], url: target.documents[0].url.replace("sefaz_rn_25_auditor", "tce_rn_25") }, target.documents[1]] };
    expect(() => assertCebraspeHistoricalEvent(other, payload())).toThrow();
  });

  it("prévia usa robots do portal, API JSON e verificador de assinatura, sem banco", async () => {
    const verifier = vi.fn(async (_bank: string, url: string) => ({ httpStatus: 200, isPdf: true, finalUrl: url, checkedAt: new Date(), contentType: "application/pdf", pageTitle: null }));
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const robots = String(url).endsWith("robots.txt");
      const response = new Response(robots ? "User-agent: *\nDisallow:" : JSON.stringify(payload()), { status: 200, headers: { "content-type": robots ? "text/plain" : "application/json; charset=utf-8" } });
      Object.defineProperty(response, "url", { value: String(url) });
      return response;
    });
    const result = await previewFgvHistoricalPreviousExam(target, { fetcher: fetcher as typeof fetch, verifier });
    expect(state.connect).not.toHaveBeenCalled();
    expect(verifier.mock.calls.every(([bank]) => bank === "cebraspe")).toBe(true);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(["https://www.cebraspe.org.br/robots.txt", "https://apis.cebraspe.org.br/cebraspe/eventos/SEFAZ_RN_25_AUDITOR"]);
    expect(result).toMatchObject({ databaseWrites: 0, questionsImported: 0, productsReleased: 0, humanReview: false, publicationAllowed: false });
  });

  it("edital aprovado precisa de hash, páginas e trechos de formato e data", () => {
    const pageTexts = Array.from({ length: target.noticePageCount }, () => "");
    pageTexts[20] = "Prova objetiva de\nconhecimentos específicos (P3)\nDireito tributário I - Geral 20\nProcesso administrativo tributário 10\n8.6 As questões das provas objetivas serão do tipo múltipla escolha, com cinco opções (A, B, C, D e E), sendo";
    pageTexts[37] = "Aplicação das provas objetivas 21 e 22/3/2026";
    const valid = { checksum: target.noticeSha256, pages: target.noticePageCount, pageTexts };
    expect(() => assertFgvHistoricalNoticeEvidence(target, valid)).not.toThrow();
    for (const patch of [{ checksum: "b".repeat(64) }, { pageTexts: pageTexts.map((text, index) => index === 37 ? "Aplicação das provas objetivas 4/4/2026" : text) },
      { pageTexts: pageTexts.map((text, index) => index === 20 ? text.replace("cinco opções", "quatro opções") : text) }]) expect(() => assertFgvHistoricalNoticeEvidence(target, { ...valid, ...patch })).toThrow();
  });
});
