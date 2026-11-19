import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("postgres", () => ({ default: state.connect }));

import { compositeBank, compositeCourseTarget, compositeProgrammeRequirements } from "@/lib/editorial/composite-course-admission";
import { extractDossierSubjectSections, NEXT_OFFICIAL_COURSE_RECIPES, type PreviewDocumentRecipe } from "@/lib/editorial/official-course-preview-candidates";
import { CEBRASPE_PROGRAMME_SCOPES, PROGRAMME_CLASSIFICATION_SCOPES, programmeCanonicalSubject, programmeLiteralHeadingName } from "@/lib/editorial/programme-subject-classification";
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
    // A classificação confere o edital aprovado contra a origem Cebraspe, não FGV.
    expect(CEBRASPE_PROGRAMME_SCOPES.has(target.slug)).toBe(true);
    expect(CEBRASPE_PROGRAMME_SCOPES.has("tjgo-juiz-substituto-59-2025-historico-objetiva")).toBe(false);
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

describe("lote Cebraspe histórico — TCE-RN Cargo 9", () => {
  const slug = "tce-rn-auditor-2026";
  it("receita do cargo exato, alvo de controle externo e prova anterior P2 Certo/Errado", () => {
    const recipe = recipeOf(slug);
    const { target } = compositeCourseTarget(slug);
    expect(target).toMatchObject({ category: "fiscal-e-controle", career: "controle-externo", bank: "cebraspe" });
    expect(recipe.documents[0].layout).toMatchObject({ startLine: "CARGO 9: AUDITOR DE CONTROLE EXTERNO – ESPECIALIDADE: DIREITO" });
    expect(fgvHistoricalPreviousExam(slug)).toMatchObject({ cebraspeEventId: "TCE_RN_25", expectedQuestionCount: 70, examDate: "2026-04-11" });
    expect(CEBRASPE_PROGRAMME_SCOPES.has(target.slug)).toBe(true);
  });

  it("título igual em outro cargo antes da linha inicial é ignorado; linha inicial e final são obrigatórias", () => {
    const doc = recipeOf(slug).documents[0];
    const layout = doc.layout!;
    const body = layout.headings.map((heading, index) => `${heading.line}: 1 Tema ${index}.`);
    // Cargo 8 também tem "AUDITORIA DO SETOR PÚBLICO:" na mesma página, antes do Cargo 9.
    const page = ["AUDITORIA DO SETOR PÚBLICO: 1 Tema do cargo 8.", layout.startLine!, ...body, layout.stopLine!, "OBRAS DE EDIFICAÇÕES: 1 Outro cargo."].join("\n");
    const sections = extractDossierSubjectSections(doc, capture(doc, { 57: page }));
    expect(sections).toHaveLength(9);
    const requirements = compositeProgrammeRequirements(sections, [], true);
    expect(requirements.some((item) => /cargo 8|Outro cargo/u.test(item.requirementText))).toBe(false);
    expect(() => extractDossierSubjectSections(doc, capture(doc, { 57: [...body, layout.stopLine!].join("\n") }))).toThrow(/Linha inicial/u);
    expect(() => extractDossierSubjectSections(doc, capture(doc, { 57: [layout.startLine!, ...body].join("\n") }))).toThrow(/Linha final/u);
  });
});

describe("lote Cebraspe histórico — TJ-MT Cartórios (provimento) e TRT-10 Cargo 12", () => {
  it("TJ-MT: provimento, 100 questões A–E, título inline com dois-pontos e assinatura fora do programa", () => {
    const slug = "tj-mt-cartorios-reta-final";
    const { target } = compositeCourseTarget(slug);
    expect(target).toMatchObject({ category: "cartorios", career: "cartorios", bank: "cebraspe" });
    expect(fgvHistoricalPreviousExam(slug)).toMatchObject({ cebraspeEventId: "tj_mt_25_notarios", expectedQuestionCount: 100, examDate: "2026-09-05" });
    expect(CEBRASPE_PROGRAMME_SCOPES.has(target.slug)).toBe(true);
    const doc = recipeOf(slug).documents[0];
    const body = doc.layout!.headings.map((heading, index) => `${heading.line}: 1 Tema ${index}.`);
    const sections = extractDossierSubjectSections(doc, capture(doc, { 49: ["20 DOS OBJETOS DE AVALIAÇÃO", ...body, "JOSÉ ZUQUIM NOGUEIRA", "Presidente do Tribunal de Justiça do Estado de Mato Grosso"].join("\n") }));
    expect(sections).toHaveLength(10);
    expect(compositeProgrammeRequirements(sections, [], true).some((item) => /ZUQUIM|Presidente/u.test(item.requirementText))).toBe(false);
  });

  it("TRT-10: só o Cargo 12, entre a linha do cargo e a do Cargo 13", () => {
    const slug = "trt-10-analista-e-tecnico-df-to";
    const { target } = compositeCourseTarget(slug);
    expect(target).toMatchObject({ category: "trabalhistas", career: "analista", bank: "cebraspe" });
    expect(fgvHistoricalPreviousExam(slug)).toMatchObject({ cebraspeEventId: "TRT10_24", expectedQuestionCount: 70, examDate: "2025-03-16" });
    const layout = recipeOf(slug).documents[0].layout!;
    expect(layout).toMatchObject({ startLine: "CARGO 12: ANALISTA JUDICIÁRIO – ÁREA: JUDICIÁRIA" });
    const doc = recipeOf(slug).documents[0];
    const body = layout.headings.map((heading, index) => `${heading.line}: 1 Tema ${index}.`);
    const page = ["DIREITO CIVIL: 1 Tema do cargo 11.", layout.startLine!, ...body, layout.stopLine!, "DIREITO CIVIL: 1 Tema do cargo 13."].join("\n");
    const requirements = compositeProgrammeRequirements(extractDossierSubjectSections(doc, capture(doc, { 73: page })), [], true);
    expect(requirements.some((item) => /cargo 1[13]/u.test(item.requirementText))).toBe(false);
  });

  it("nome de arquivo com acento na URL confere com o nome literal da API do evento", () => {
    const target = fgvHistoricalPreviousExam("trt-10-analista-e-tecnico-df-to");
    const file = (url: string, descricaoArquivo: string) => ({ nomeArquivo: decodeURIComponent(url.split("/").at(-1)!), descricaoArquivo, dataArquivoObj: "2025-04-14T17:00:00", isGuid: false });
    const payload = { eventoURL: "TRT10_24", eventoNomeCompleto: "Tribunal Regional do Trabalho da 10ª Região",
      arquivosEdital: [file(target.portalNotice.url, target.portalNotice.label)],
      arquivosGabarito: target.documents.map((document) => ({ ...file(document.url, document.label), dataArquivoObj: `${document.publishedOn}T10:00:00` })) };
    expect(payload.arquivosEdital[0].nomeArquivo).toBe("Ed_1_2024_TRT_10_Abertura_atualizado_até_ret_6.pdf");
    expect(() => assertCebraspeHistoricalEvent(target, payload)).not.toThrow();
  });
});
