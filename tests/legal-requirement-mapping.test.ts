import { describe, expect, it } from "vitest";

import {
  suggestLegalRequirementMapping,
  type MappingArticle,
  type MappingInput,
} from "@/lib/editorial/legal-requirement-mapping";

// Dados sintéticos: não representam norma, edital ou verificação jurídica real.
const noticeUrl = "https://editais.example.invalid/edital.pdf";
const lawUrl = "https://leis.example.invalid/norma/99999/versao/1";
const source = { url: lawUrl, checksumSha256: "a".repeat(64), verifiedOn: "2026-09-06" };
const article: MappingArticle = {
  legalActId: 1,
  legalVersionId: 10,
  legalArticleId: 100,
  actType: "Lei",
  actNumber: "99.999",
  actYear: 2026,
  actTitle: "Lei fictícia para teste",
  jurisdiction: "federal",
  articleRef: "Art. 5º",
  literalText: "Texto exclusivamente sintético do artigo de teste.",
  source,
  uncertainties: [],
};
function input(text = "Lei nº 99.999/2026, art. 5º"): MappingInput {
  return {
    requirement: {
      id: 134,
      requirementText: text,
      sourceLocator: "Anexo I, item 2, página 3",
      source: { ...source, url: noticeUrl, checksumSha256: "b".repeat(64) },
    },
    articles: [article],
    officialSourceUrls: [noticeUrl, lawUrl],
  };
}

describe("sugestões puras de requisito para artigo", () => {
  it("sugere citação única com norma, número, artigo, versão e evidência rastreável", () => {
    const data = input();
    const result = suggestLegalRequirementMapping(data);
    expect(result.kind).toBe("suggestion");
    if (result.kind !== "suggestion") throw new Error("Sugestão esperada");
    expect(result.humanReviewRequired).toBe(true);
    expect(result.evidence).toMatchObject({
      requirementQuote: data.requirement.requirementText,
      sourceLocator: data.requirement.sourceLocator,
      requirementSource: data.requirement.source,
      legalQuote: article.literalText,
      legalSource: source,
      candidate: { actType: "Lei", actNumber: "99.999", articleRef: "Art. 5º", legalVersionId: 10 },
      confidence: { level: "exact_citation" },
    });
    expect(result.evidence.confidence.justification).toContain("não validade jurídica");
    expect(result.limitations.join(" ")).toContain("Vigência");
    expect(result).not.toHaveProperty("editorialStatus");
    expect(result).not.toHaveProperty("reviewedAt");
    expect(result).not.toHaveProperty("reviewedByUserId");
    expect(result).not.toHaveProperty("legalArticleId");
  });

  it.each([
    "Lei 99999/2026 art. 5",
    "ARTIGO 5° DA LEI Nº 99.999/2026.",
    "  Lei   nº 99.999/2026,  art. 5º  ",
  ])("normaliza apenas diferenças gráficas: %s", (text) => {
    expect(suggestLegalRequirementMapping(input(text)).kind).toBe("suggestion");
  });

  it("preserva sufixos dos artigos sem confundir 5, 5-A e 50", () => {
    const data = { ...input("Lei 99999/2026 art. 5-A"), articles: [article, { ...article, legalArticleId: 101, articleRef: "Art. 5º-A" }] };
    const result = suggestLegalRequirementMapping(data);
    expect(result.kind).toBe("suggestion");
    if (result.kind === "suggestion") expect(result.evidence.candidate.legalArticleId).toBe(101);
    expect(suggestLegalRequirementMapping(input("Lei 99999/2026 art. 50"))).toMatchObject({ kind: "pending", reason: "insufficient_evidence" });
  });

  it.each([
    "Lei 99999/2026, arts. 5 e 6",
    "Lei 99999/2026, artigos 5 a 9",
    "Lei 99999/2026, art. 5º e 6º",
    "Lei 99999/2026, art. 5-9",
    "Lei 99999/2026, art. 5; art. 6",
  ])("rejeita múltiplas referências mesmo com catálogo parcial: %s", (text) => {
    expect(suggestLegalRequirementMapping(input(text))).toMatchObject({ kind: "pending", reason: "ambiguous_reference", humanReviewRequired: true });
  });

  it.each([
    { ...article, legalArticleId: 101, legalVersionId: 11 },
    { ...article, legalArticleId: 101, jurisdiction: "estadual" },
    { ...article, legalArticleId: 101, source: { ...source, checksumSha256: "" } },
  ])("não escolhe entre versões, jurisdições ou candidato com evidência incompleta", (other) => {
    const data = { ...input(), articles: [article, other] };
    const result = suggestLegalRequirementMapping(data);
    expect(result).toMatchObject({ kind: "pending", reason: "ambiguous_reference" });
    if (result.kind === "pending") expect(result.candidates).toHaveLength(2);
    expect(result).toEqual(suggestLegalRequirementMapping({ ...data, articles: [...data.articles].reverse() }));
  });

  it.each([
    "Direitos e garantias fundamentais",
    "Art. 5º",
    "Lei 99999, art. 5",
    "Lei 99999/2026",
    "CF/88, art. 5º",
    "Lei 99999/2026, art. 5º, exceto inciso II",
    "Lei 99999/2026, art. 5º e demais disposições",
    "", "   ",
  ])("mantém pendente evidência fraca ou escopo não suportado: %s", (text) => {
    expect(suggestLegalRequirementMapping(input(text))).toMatchObject({ kind: "pending", reason: "insufficient_evidence" });
  });

  it.each([
    "Lei complementar 99999/2026, art. 5",
    "Lei 99999/2025, art. 5",
    "Lei 9999/2026, art. 5",
  ])("não confunde tipo, ano ou número: %s", (text) => {
    expect(suggestLegalRequirementMapping(input(text))).toMatchObject({ kind: "pending", reason: "insufficient_evidence", candidates: [] });
  });

  it.each([
    { ...article, literalText: " " },
    { ...article, legalVersionId: 0 },
    { ...article, actTitle: " " },
    { ...article, jurisdiction: " " },
    { ...article, source: { ...source, checksumSha256: "incorreto" } },
    { ...article, source: { ...source, url: "https://terceiro.example.invalid/lei" } },
    { ...article, source: { ...source, verifiedOn: "2026-02-30" } },
    { ...article, source: { ...source, verifiedOn: "" } },
    { ...article, uncertainties: ["Sem compilação monovigente pelo adaptador"] },
  ])("recusa trilha legal incompleta ou incerteza de versão", (candidate) => {
    expect(suggestLegalRequirementMapping({ ...input(), articles: [candidate] })).toMatchObject({ kind: "pending", reason: "insufficient_evidence" });
  });

  it("exige fonte e localização também para o requisito", () => {
    const data = input();
    for (const requirement of [
      { ...data.requirement, sourceLocator: "" },
      { ...data.requirement, source: { ...data.requirement.source, checksumSha256: "" } },
      { ...data.requirement, source: { ...data.requirement.source, url: lawUrl + "/desconhecido" } },
    ]) {
      expect(suggestLegalRequirementMapping({ ...data, requirement })).toMatchObject({ kind: "pending", reason: "insufficient_evidence" });
    }
  });

  it("recusa URL insegura mesmo incluída pelo chamador", () => {
    for (const url of ["http://leis.example.invalid/lei", "https://usuario:senha@example.invalid/lei", "invalida"]) {
      expect(suggestLegalRequirementMapping({ ...input(), articles: [{ ...article, source: { ...source, url } }], officialSourceUrls: [noticeUrl, url] })).toMatchObject({ kind: "pending", reason: "insufficient_evidence" });
    }
  });

  it("não altera entradas congeladas e não compartilha objetos de evidência", () => {
    const data = input();
    Object.freeze(data.requirement.source);
    Object.freeze(data.requirement);
    Object.freeze(article.source);
    Object.freeze(article.uncertainties);
    Object.freeze(article);
    Object.freeze(data.articles);
    Object.freeze(data.officialSourceUrls);
    Object.freeze(data);
    const before = JSON.stringify(data);
    const first = suggestLegalRequirementMapping(data);
    expect(first).toEqual(suggestLegalRequirementMapping(data));
    expect(JSON.stringify(data)).toBe(before);
    if (first.kind !== "suggestion") throw new Error("Sugestão esperada");
    expect(first.evidence.legalSource).not.toBe(article.source);
    expect(first.evidence.requirementSource).not.toBe(data.requirement.source);
  });

  it("catálogo vazio gera pendência, sem inventar artigo", () => {
    expect(suggestLegalRequirementMapping({ ...input(), articles: [] })).toMatchObject({ kind: "pending", reason: "insufficient_evidence", candidates: [] });
  });
});
