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

  it("mantém quatro alternativas distintas e um gabarito coerente por questão", () => {
    for (const question of DEMO_QUESTIONS) {
      const ids = question.options.map((option) => option.id);
      expect(new Set(ids).size, question.articleRef).toBe(ids.length);
      expect(ids).toHaveLength(4);

      const correct = question.options.find((option) => option.id === question.correctOptionId);
      expect(correct, `${question.articleRef}: correctOptionId sem alternativa`).toBeDefined();
      // A alternativa correta é a literal; nenhuma outra pode reivindicar isso.
      expect(correct?.mutationKind, question.articleRef).toBe("literal");
      for (const option of question.options) {
        if (option.id === question.correctOptionId) continue;
        expect(option.mutationKind, `${question.articleRef}/${option.id}`).not.toBe("literal");
      }
    }
  });

  it("garante que nenhum distrator repita o texto literal", () => {
    for (const question of DEMO_QUESTIONS) {
      const distratores = question.options.filter((option) => option.id !== question.correctOptionId);
      for (const option of distratores) {
        // Distrator idêntico ao gabarito daria duas respostas certas.
        expect(option.text.trim(), `${question.articleRef}/${option.id}`).not.toBe(
          question.literalText.trim(),
        );
      }
      expect(new Set(question.options.map((option) => option.text.trim())).size, question.articleRef).toBe(4);
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
