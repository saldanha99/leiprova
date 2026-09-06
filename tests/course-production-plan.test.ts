import { describe, expect, it } from "vitest";

import { CONTEST_CATALOG } from "../src/lib/commerce/catalog";
import research75 from "../src/lib/editorial/course-source-research.json";
import {
  buildCourseProductionPlan,
  courseResearchSchema,
  isOfficialCourseResearchUrl,
  parseCourseResearch,
  type CourseResearchItem,
} from "../src/lib/editorial/course-production-plan";

const checkedAt = "2026-09-06T16:00:00Z";
const officialUrl = "https://conhecimento.fgv.br/concursos/tjrsjuiz26";
const noticeUrl = "https://conhecimento.fgv.br/sites/default/files/concursos/edital-de-abertura-0031-2026-dmag.pdf";
const oneCatalog = [CONTEST_CATALOG[0]];
function item(changes: Partial<CourseResearchItem> = {}): CourseResearchItem {
  return {
    productSlug: oneCatalog[0].slug,
    status: "official_edition_found",
    editionDescription: "Fixture de identidade para teste; não é dossiê real.",
    examStage: "Objetiva futura nesta fixture.",
    bankNames: ["FGV"],
    officialUrls: [officialUrl, noticeUrl],
    syllabusNotes: "Programa de Constitucional conferido na fixture.",
    requirementLocator: "Anexo II, Direito Constitucional, item 1.",
    constraints: ["Revisão humana pendente."],
    evidence: [{ url: noticeUrl, title: "Edital sintético de teste", kind: "notice",
      observedFacts: "PDF oficial lido e conferido: programa no Anexo II.", checkedAt }],
    humanReview: "pending",
    publicationAllowed: false,
    ...changes,
  };
}
const dossier = (items = [item()]) => ({ schemaVersion: 1, checkedAt, items });
const step = (value: CourseResearchItem) => buildCourseProductionPlan(dossier([value]), oneCatalog)[0].nextStep;

describe("contrato estrito da pesquisa por produto", () => {
  it("valida o dossiê real dos 75 sem publicar nem omitir pendências", () => {
    const parsed = parseCourseResearch(research75);
    const orders = buildCourseProductionPlan(parsed);
    expect(orders).toHaveLength(75);
    expect(orders.map((order) => order.productSlug)).toEqual(CONTEST_CATALOG.map((contest) => contest.slug));
    expect(orders.every((order) => order.minimum68 === 68 && order.publicationAllowed === false &&
      order.humanReview === "pending" && order.research.publicationAllowed === false)).toBe(true);
    expect(orders.some((order) => order.nextStep === "verify_official_source")).toBe(true);
    expect(orders.some((order) => order.nextStep === "resolve_identity")).toBe(true);
  });

  it("produz a mesma ordem do catálogo mesmo se o JSON vem invertido", () => {
    const reversed = { ...research75, items: [...research75.items].reverse() };
    expect(buildCourseProductionPlan(reversed)).toEqual(buildCourseProductionPlan(research75));
  });

  it("não muta o documento de entrada e conserva as restrições de cada produto", () => {
    const raw = dossier();
    const before = structuredClone(raw);
    const orders = buildCourseProductionPlan(raw, oneCatalog);
    expect(raw).toEqual(before);
    expect(orders[0].research.constraints).toEqual(raw.items[0].constraints);
    orders[0].research.constraints.push("Alteração apenas na cópia validada.");
    expect(raw).toEqual(before);
  });

  it.each([
    { name: "omissão", items: research75.items.slice(1) },
    { name: "duplicação", items: [...research75.items.slice(1), research75.items[1]] },
    { name: "slug desconhecido", items: [{ ...research75.items[0], productSlug: "curso-inventado-2026" }, ...research75.items.slice(1)] },
    { name: "associação por órgão", items: [{ ...research75.items[0], productSlug: "pc-ba" }, ...research75.items.slice(1)] },
  ])("rejeita $name sem contar somente o número de registros", ({ items }) => {
    expect(() => parseCourseResearch({ ...research75, items })).toThrow();
  });

  it("rejeita um catálogo alternativo duplicado ou vazio", () => {
    expect(() => parseCourseResearch(dossier(), [])).toThrow();
    expect(() => parseCourseResearch(dossier(), [oneCatalog[0], oneCatalog[0]])).toThrow();
  });

  it.each([
    { humanReview: "approved" }, { publicationAllowed: true }, { status: "approved" },
    { productSlug: ` ${oneCatalog[0].slug}` }, { requirementLocator: "  " },
    { unknownAction: "publish" },
  ])("não aceita promoções ou campos inesperados: %j", (changes) => {
    expect(() => parseCourseResearch(dossier([{ ...item(), ...changes } as CourseResearchItem]), oneCatalog)).toThrow();
  });

  it("rejeita propriedades desconhecidas na raiz e na evidência", () => {
    expect(courseResearchSchema.safeParse({ ...dossier(), approved: true }).success).toBe(false);
    const raw = dossier();
    expect(courseResearchSchema.safeParse({ ...raw, items: [{ ...raw.items[0],
      evidence: [{ ...raw.items[0].evidence[0], reviewed: true }] }] }).success).toBe(false);
  });

  it("exige datas ISO válidas e consolidação posterior às evidências", () => {
    expect(() => parseCourseResearch({ ...dossier(), checkedAt: "06/09/2026" }, oneCatalog)).toThrow();
    expect(() => parseCourseResearch({ ...dossier(), checkedAt: "2026-09-05T00:00:00Z" }, oneCatalog)).toThrow();
  });

  it("exige que cada evidência pertença às fontes do próprio produto", () => {
    expect(() => parseCourseResearch(dossier([item({ officialUrls: [officialUrl] })]), oneCatalog)).toThrow();
    expect(() => parseCourseResearch(dossier([item({ officialUrls: [officialUrl, noticeUrl, noticeUrl] })]), oneCatalog)).toThrow();
  });
});

describe("origens públicas oficiais, sem credenciais ou login", () => {
  it.each([
    officialUrl, noticeUrl, "https://hdl.handle.net/20.500.14782/629",
    "https://www.fundatec.org.br/portal/concursos/index_concursos.php?concurso=1092",
    `${noticeUrl}#page=37`,
  ])("aceita a referência pública %s", (url) => expect(isOfficialCourseResearchUrl(url)).toBe(true));

  it.each([
    "http://conhecimento.fgv.br/concursos/tjrsjuiz26",
    "https://conhecimento.fgv.br.evil.example/edital.pdf",
    "https://evil-conhecimento.fgv.br/edital.pdf",
    "https://outra.fgv.br/edital.pdf",
    "https://www.decorandoaleiseca.com.br/reta-final/curso",
    "https://localhost/edital.pdf", "https://127.0.0.1/edital.pdf",
    "https://user:password@conhecimento.fgv.br/edital.pdf",
    "https://conhecimento.fgv.br:8443/edital.pdf",
    "https://conhecimento.fgv.br/login", "https://conhecimento.fgv.br/%6cogin",
    "https://conhecimento.fgv.br/%256cogin",
    "https://conhecimento.fgv.br/dashboard/apikeys", "https://conhecimento.fgv.br/auth/callback",
    `${officialUrl}?access_token=secret`, `${officialUrl}?key=secret`,
    `${officialUrl}?next=https://evil.example`, `${officialUrl}?id=secret`,
    `${officialUrl}?page=1&page=2`, `${officialUrl}#access_token=secret`,
    "https://hdl.handle.net/another-institution/123", "https://hdl.handle.net/20.500.14782/629/redirect",
    ` ${officialUrl}`, "https://conhecimento.fgv.br/arquivo%GG.pdf",
  ])("rejeita %s", (url) => {
    expect(isOfficialCourseResearchUrl(url)).toBe(false);
    expect(() => parseCourseResearch(dossier([item({ officialUrls: [url] })]), oneCatalog)).toThrow();
  });
});

describe("próximos passos não são aprovações", () => {
  it.each([
    ["not_confirmed", "verify_official_source"],
    ["needs_identity_review", "resolve_identity"],
    ["pre_notice_only", "wait_official_notice"],
    ["historical_edition", "review_historical_edition"],
  ] as const)("mantém %s no passo %s mesmo com localizador", (status, expected) => {
    expect(step(item({ status }))).toBe(expected);
  });

  it("edição localizada sem evidência não avança", () => {
    expect(step(item({ evidence: [] }))).toBe("verify_official_source");
  });

  it.each([
    "PDF localizado em busca oficial; conteúdo ainda não conferido.",
    "Documento não foi lido nesta etapa.",
    "Tentativa de navegação retornou 403; não foi possível conferir o edital.",
    "Página com desafio WAF: conteúdo não conferido.",
  ])("mera descoberta/bloqueio exige fonte: %s", (observedFacts) => {
    const value = item();
    value.evidence[0].observedFacts = observedFacts;
    expect(step(value)).toBe("verify_official_source");
  });

  it.each([null, "Programa ainda não localizado.", "Anexo programático pendente."])("localizador %s não libera escopo", (requirementLocator) => {
    expect(step(item({ requirementLocator }))).toBe("verify_syllabus");
  });

  it("notícia lida com suposto localizador não substitui programa do edital", () => {
    const value = item();
    value.evidence[0].kind = "organ";
    expect(step(value)).toBe("verify_syllabus");
  });

  it("edital lido e localizador permitem somente revisão de escopo", () => {
    expect(step(item())).toBe("review_draft_scope");
    const [order] = buildCourseProductionPlan(dossier(), oneCatalog);
    expect(order.humanReview).toBe("pending");
    expect(order.publicationAllowed).toBe(false);
    expect(order).not.toHaveProperty("approvedQuestionCount");
    expect(order).not.toHaveProperty("publicationReady");
  });

  it("não confunde evitar provas de terceiros com não conferir edital", () => {
    const value = item();
    value.evidence[0].observedFacts = "HTML oficial conferido: programa item 23.2. Não foram consultadas questões de prova.";
    expect(step(value)).toBe("review_draft_scope");
  });

  it("não compartilha prontidão entre cargos da mesma oportunidade ou banca", () => {
    const catalog = CONTEST_CATALOG.filter((contest) => contest.acronym === "PC-BA");
    expect(catalog).toHaveLength(2);
    const raw = dossier([item({ productSlug: catalog[0].slug }),
      item({ productSlug: catalog[1].slug, evidence: [], requirementLocator: null })]);
    const orders = buildCourseProductionPlan(raw, catalog);
    expect(orders.map((order) => order.nextStep)).toEqual(["review_draft_scope", "verify_official_source"]);
  });
});
