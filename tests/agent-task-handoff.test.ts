import { describe, expect, it } from "vitest";
import { agentTaskHandoff } from "../src/lib/editorial/agent-task-handoff";
import type { AgentWorkPayload } from "../src/lib/editorial/agent-work-contract";

describe("reserved article handoff", () => {
  it("locates complete article texts despite a pending retrieval hint without exposing the corpus", () => {
    const text = "Texto oficial completo. ".repeat(500);
    const payload: AgentWorkPayload = {
      version: "editalume-agents-v1", title: "Ensaio", instructions: "Propor rascunho",
      context: { exactCitation: { status: "pending" }, humanReviewRequired: true },
      articles: [{ id: 7, act: "Lei", articleRef: "Art. 1º", versionId: 2,
        checksum: "a".repeat(64), text, url: "https://www.planalto.gov.br/lei" }],
      sourceUrls: [],
    };
    const before = JSON.stringify(payload);
    const handoff = agentTaskHandoff("authoring", payload);
    expect(handoff.articleTexts).toEqual([{ articleId: 7, path: "job.payload.articles[0].text", characters: text.length }]);
    expect(JSON.stringify(handoff)).not.toContain(text);
    expect(JSON.stringify(payload)).toBe(before);
    expect(handoff.instruction).toContain("Se nenhum artigo fornecido sustentar o requisito, registre blocked");
  });

  it("does not assign authorship to discovery or invent missing articles", () => {
    const handoff = agentTaskHandoff("discovery", {
      version: "editalume-agents-v1", title: "Radar", instructions: "Descoberta",
      context: {}, articles: [], sourceUrls: [],
    });
    expect(handoff.articleTexts).toEqual([]);
    expect(handoff.instruction).not.toContain("Sua entrega é rascunho");
  });
});
