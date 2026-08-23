import { describe, expect, it } from "vitest";

import { DEMO_CONTENT_PROVENANCE, DEMO_QUESTIONS } from "@/lib/demo-content";

describe("demo editorial content", () => {
  it("mantém slugs únicos e exatamente uma alternativa literal", () => {
    expect(new Set(DEMO_QUESTIONS.map((question) => question.slug)).size).toBe(DEMO_QUESTIONS.length);
    for (const question of DEMO_QUESTIONS) {
      expect(question.options.filter((option) => option.mutationKind === "literal")).toHaveLength(1);
      expect(question.options.find((option) => option.id === question.correctOptionId)?.text).toBe(question.literalText);
    }
  });

  it("atribui fonte oficial e data de verificação a todo item", () => {
    for (const question of DEMO_QUESTIONS) {
      expect(question.officialUrl).toMatch(/^https:\/\/www\.planalto\.gov\.br\//);
      expect(question.verifiedAt).toBe("2026-08-16");
    }
  });

  it("declara corretamente a assistência por IA e a revisão humana pendente", () => {
    expect(DEMO_CONTENT_PROVENANCE).toMatchObject({
      authorshipMethod: "ai_assisted",
      generatorModel: "OpenAI Codex",
      humanReviewRecorded: false,
      publicationStage: "beta",
    });
  });
});
