import { describe, expect, it } from "vitest";

import {
  originalQuestionDraftSchema,
  validateIndependentReview,
} from "../src/lib/editorial/clean-room";
import { STYLE_PROFILE_SEEDS } from "../src/lib/editorial/style-profiles";

function validDraft() {
  return {
    styleBankId: 1,
    legalArticleId: 2,
    subjectId: 3,
    topicId: 4,
    type: "multiple_choice",
    learningObjective: "Identificar o requisito legal aplicável ao caso inédito.",
    prompt: "Em uma situação inteiramente nova, assinale a alternativa compatível com a norma selecionada.",
    explanation: "A alternativa correta reproduz a consequência jurídica prevista na fonte oficial selecionada.",
    difficulty: 2,
    authorshipMethod: "human",
    generatorModel: "",
    promptVersion: "",
    cleanRoomAttestation: true,
    options: [
      { key: "A", text: "Alternativa correta", isCorrect: true, rationale: "" },
      { key: "B", text: "Alternativa incorreta B", isCorrect: false, rationale: "" },
      { key: "C", text: "Alternativa incorreta C", isCorrect: false, rationale: "" },
      { key: "D", text: "Alternativa incorreta D", isCorrect: false, rationale: "" },
      { key: "E", text: "Alternativa incorreta E", isCorrect: false, rationale: "" },
    ],
  };
}

describe("fábrica autoral clean-room", () => {
  it("aceita uma questão inédita completa e com uma única resposta correta", () => {
    expect(originalQuestionDraftSchema.safeParse(validDraft()).success).toBe(true);
  });

  it("bloqueia envio sem declaração clean-room", () => {
    expect(
      originalQuestionDraftSchema.safeParse({ ...validDraft(), cleanRoomAttestation: false }).success,
    ).toBe(false);
  });

  it("exige rastreabilidade quando a autoria é assistida por IA", () => {
    expect(
      originalQuestionDraftSchema.safeParse({ ...validDraft(), authorshipMethod: "ai_assisted" }).success,
    ).toBe(false);
    expect(
      originalQuestionDraftSchema.safeParse({
        ...validDraft(),
        authorshipMethod: "ai_assisted",
        generatorModel: "modelo-interno",
        promptVersion: "clean-room-v1",
      }).success,
    ).toBe(true);
  });

  it("impede o autor de revisar o próprio item", () => {
    expect(
      validateIndependentReview({
        status: "pending_review",
        creatorUserId: 10,
        reviewerUserId: 10,
        cleanRoomAttestedAt: new Date(),
      }),
    ).toEqual({ allowed: false, reason: "A revisão precisa ser feita por outra pessoa." });

    expect(
      validateIndependentReview({
        status: "pending_review",
        creatorUserId: 10,
        reviewerUserId: 11,
        cleanRoomAttestedAt: new Date(),
      }).allowed,
    ).toBe(true);
  });

  it("mantém perfis abstratos com limites explícitos e sem material de terceiros", () => {
    expect(new Set(STYLE_PROFILE_SEEDS.map((profile) => profile.bankSlug)).size).toBe(
      STYLE_PROFILE_SEEDS.length,
    );
    expect(STYLE_PROFILE_SEEDS.every((profile) => profile.prohibitedPatterns.length >= 3)).toBe(true);
    expect(STYLE_PROFILE_SEEDS.every((profile) => profile.disclaimer.includes("Não contém"))).toBe(true);
  });
});
