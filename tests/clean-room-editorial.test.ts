import { describe, expect, it } from "vitest";

import {
  generatedDraftBatchClaimSchema,
  generatedDraftClaimSchema,
  isGeneratedAuthorshipMethod,
  originalQuestionBatchReviewSchema,
  originalQuestionDraftSchema,
  validateHumanReview,
} from "../src/lib/editorial/clean-room";
import {
  ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
  ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
  ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
  ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
  ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
  ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
  PILOT_ORIGINAL_QUESTIONS,
} from "../src/lib/editorial/pilot-questions";
import {
  ORIGINALITY_REJECTION_THRESHOLD_BPS,
  textualSimilarityBps,
} from "../src/lib/editorial/originality";
import { STYLE_PROFILE_SEEDS } from "../src/lib/editorial/style-profiles";
import { DEMO_QUESTIONS } from "../src/lib/demo-content";

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

  it("permite a revisão humana pelo responsável depois do envio", () => {
    expect(
      validateHumanReview({
        status: "pending_review",
        creatorUserId: 10,
        cleanRoomAttestedAt: new Date(),
      }).allowed,
    ).toBe(true);

    expect(
      validateHumanReview({
        status: "pending_review",
        creatorUserId: null,
        cleanRoomAttestedAt: new Date(),
      }).allowed,
    ).toBe(false);
  });

  it("mantém perfis abstratos com limites explícitos e sem material de terceiros", () => {
    expect(new Set(STYLE_PROFILE_SEEDS.map((profile) => profile.bankSlug)).size).toBe(
      STYLE_PROFILE_SEEDS.length,
    );
    expect(STYLE_PROFILE_SEEDS.every((profile) => profile.prohibitedPatterns.length >= 3)).toBe(true);
    expect(STYLE_PROFILE_SEEDS.every((profile) => profile.disclaimer.includes("Não contém"))).toBe(true);
  });

  it("exige declaração clean-room para assumir um rascunho gerado", () => {
    const publicId = PILOT_ORIGINAL_QUESTIONS[0].publicId;
    expect(generatedDraftClaimSchema.safeParse({ publicId, cleanRoomAttestation: false }).success).toBe(false);
    expect(generatedDraftClaimSchema.safeParse({ publicId, cleanRoomAttestation: true }).success).toBe(true);
  });

  it("reconhece rascunhos assistidos e determinísticos sem abrir autoria manual", () => {
    expect(isGeneratedAuthorshipMethod("ai_assisted")).toBe(true);
    expect(isGeneratedAuthorshipMethod("rule_based")).toBe(true);
    expect(isGeneratedAuthorshipMethod("human")).toBe(false);
    expect(
      originalQuestionDraftSchema.safeParse({
        ...validDraft(),
        authorshipMethod: "rule_based",
        generatorModel: "entrada-adulterada",
        promptVersion: "v1",
      }).success,
    ).toBe(false);
  });

  it("exige declarações humanas explícitas nas duas etapas em lote", () => {
    expect(generatedDraftBatchClaimSchema.safeParse({ cleanRoomAttestation: false }).success).toBe(false);
    expect(generatedDraftBatchClaimSchema.safeParse({ cleanRoomAttestation: true }).success).toBe(true);
    expect(
      originalQuestionBatchReviewSchema.safeParse({ reviewAttestation: false, notes: "" }).success,
    ).toBe(false);
    expect(
      originalQuestionBatchReviewSchema.safeParse({ reviewAttestation: true, notes: "Lote conferido." }).success,
    ).toBe(true);
  });

  it("mantém o lote piloto equilibrado, válido e compatível com cada perfil", () => {
    expect(PILOT_ORIGINAL_QUESTIONS).toHaveLength(72);
    expect(new Set(PILOT_ORIGINAL_QUESTIONS.map((item) => item.publicId)).size).toBe(72);
    expect(new Set(PILOT_ORIGINAL_QUESTIONS.map((item) => item.articleRef)).size).toBe(12);
    expect(
      PILOT_ORIGINAL_QUESTIONS.filter(
        (item) => item.promptVersion === ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V1,
      ),
    ).toHaveLength(12);
    expect(
      PILOT_ORIGINAL_QUESTIONS.filter(
        (item) => item.promptVersion === ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V2,
      ),
    ).toHaveLength(12);
    expect(
      PILOT_ORIGINAL_QUESTIONS.filter(
        (item) => item.promptVersion === ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V3,
      ),
    ).toHaveLength(12);
    expect(
      PILOT_ORIGINAL_QUESTIONS.filter(
        (item) => item.promptVersion === ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V4,
      ),
    ).toHaveLength(12);
    expect(
      PILOT_ORIGINAL_QUESTIONS.filter(
        (item) => item.promptVersion === ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V5,
      ),
    ).toHaveLength(12);
    expect(
      PILOT_ORIGINAL_QUESTIONS.filter(
        (item) => item.promptVersion === ORIGINAL_STYLE_PILOT_PROMPT_VERSION_V6,
      ),
    ).toHaveLength(12);

    for (const articleRef of new Set(PILOT_ORIGINAL_QUESTIONS.map((item) => item.articleRef))) {
      expect(PILOT_ORIGINAL_QUESTIONS.filter((item) => item.articleRef === articleRef)).toHaveLength(6);
    }

    for (const profile of STYLE_PROFILE_SEEDS) {
      expect(PILOT_ORIGINAL_QUESTIONS.filter((item) => item.bankSlug === profile.bankSlug)).toHaveLength(18);
    }

    for (const item of PILOT_ORIGINAL_QUESTIONS) {
      const profile = STYLE_PROFILE_SEEDS.find((candidate) => candidate.bankSlug === item.bankSlug);
      const expectedKeys = item.type === "true_false" ? ["C", "E"] : ["A", "B", "C", "D", "E"];

      expect(profile?.format).toBe(item.type);
      expect(item.options.map((option) => option.key)).toEqual(expectedKeys);
      expect(item.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
  });

  it("mantém os enunciados piloto abaixo do limite de similaridade interna", () => {
    const comparisons = PILOT_ORIGINAL_QUESTIONS.flatMap((item, index) => [
      ...DEMO_QUESTIONS.map((existing) => textualSimilarityBps(item.prompt, existing.prompt)),
      ...PILOT_ORIGINAL_QUESTIONS.slice(0, index).map((existing) =>
        textualSimilarityBps(item.prompt, existing.prompt),
      ),
    ]);

    expect(Math.max(...comparisons)).toBeLessThan(ORIGINALITY_REJECTION_THRESHOLD_BPS);
  });
});
