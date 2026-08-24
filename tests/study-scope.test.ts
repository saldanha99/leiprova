import { describe, expect, it } from "vitest";

import {
  normalizeArticleOrder,
  normalizeArticleRange,
  normalizeLegalActSlug,
  normalizeNotebookPublicId,
  normalizeStudyTopic,
} from "@/lib/study/scope";

describe("study scope", () => {
  it("normaliza tópicos e rejeita valores excessivos", () => {
    expect(normalizeStudyTopic("  Direitos fundamentais  ")).toBe("Direitos fundamentais");
    expect(normalizeStudyTopic("x".repeat(121))).toBeUndefined();
  });

  it("aceita somente slugs internos de atos legais", () => {
    expect(normalizeLegalActSlug("constituicao-federal")).toBe("constituicao-federal");
    expect(normalizeLegalActSlug("../constituicao")).toBeUndefined();
    expect(normalizeLegalActSlug("Constituição Federal")).toBeUndefined();
  });

  it("limita ordens de artigos a inteiros não negativos", () => {
    expect(normalizeArticleOrder("37")).toBe(37);
    expect(normalizeArticleOrder("-1")).toBeUndefined();
    expect(normalizeArticleOrder("2.5")).toBeUndefined();
    expect(normalizeArticleOrder("100001")).toBeUndefined();
  });

  it("corrige intervalos invertidos", () => {
    expect(normalizeArticleRange("5", "1")).toEqual({ start: 1, end: 5 });
    expect(normalizeArticleRange("1", "5")).toEqual({ start: 1, end: 5 });
  });

  it("valida identificadores públicos de caderno", () => {
    expect(normalizeNotebookPublicId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(normalizeNotebookPublicId("550e8400e29b41d4a716446655440000")).toBeUndefined();
  });
});
