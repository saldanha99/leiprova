import { describe, expect, it } from "vitest";
import { pilotSourceSpans, resolvePilotSourceSpan } from "@/lib/editorial/pilot-source-spans";
import type { WorkArticle } from "@/lib/editorial/agent-work-contract";

describe("citação selecionada pelo piloto", () => {
  const first = "§ 1º Texto oficial com condição e ressalva expressas.";
  const second = "II - Outro comando oficial para escolha delimitada.";
  const articles = [{ id: 42, text: `${first}\n${second}` }] as WorkArticle[];
  it("copia texto e artigo do corpus, sem concatenar parágrafos ou parafrasear", () => {
    const spans = pilotSourceSpans(articles);
    expect(resolvePilotSourceSpan(spans, 0)).toEqual({ articleId: 42, quote: first });
    expect(resolvePilotSourceSpan(spans, 1)).toEqual({ articleId: 42, quote: second });
    for (const span of spans) expect(articles[0].text).toContain(span.text);
  });
  it("recusa índice fora do corpus, fracionário ou inexato; sem fallback", () => {
    const spans = pilotSourceSpans(articles);
    for (const id of [-1, 2, 0.5, NaN]) expect(() => resolvePilotSourceSpan(spans, id)).toThrow();
  });
  it("não transforma texto curto ou linha extensa em citação artificial", () => {
    expect(() => pilotSourceSpans([{ id: 1, text: "curto" }] as WorkArticle[])).toThrow();
    expect(() => pilotSourceSpans([{ id: 1, text: "a".repeat(1801) }] as WorkArticle[])).toThrow();
  });
  it("mantém identidade de cada artigo ao combinar fontes", () => {
    const spans = pilotSourceSpans([...articles, { id: 7, text: "Regra distinta da segunda fonte oficial." } as WorkArticle]);
    expect(resolvePilotSourceSpan(spans, 2).articleId).toBe(7);
  });
});
