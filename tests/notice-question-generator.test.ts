import { describe, expect, it } from "vitest";

import {
  buildNoticeQuestionDraft,
  deterministicNoticeQuestionUuid,
} from "@/lib/editorial/notice-question-generator";

const baseInput = {
  bankSlug: "fgv",
  requirementText: "Direitos e garantias fundamentais",
  sourceLocator: "Anexo II · item 1",
  topicName: "Direitos fundamentais",
  actTitle: "Constituição Federal",
  articleRef: "Art. 5º",
  literalText:
    "Todos poderão reunir-se pacificamente, sem armas, em locais abertos ao público, independentemente de autorização, desde que não frustrem outra reunião anteriormente convocada para o mesmo local.",
} as const;

describe("gerador de questões ancorado no edital", () => {
  it("gera múltipla escolha com cinco alternativas e um único gabarito", () => {
    const result = buildNoticeQuestionDraft({ ...baseInput, format: "multiple_choice" });
    expect(result.type).toBe("multiple_choice");
    expect(result.prompt).toContain(baseInput.requirementText);
    expect(result.options.map((option) => option.key)).toEqual(["A", "B", "C", "D", "E"]);
    expect(result.options.filter((option) => option.isCorrect)).toHaveLength(1);
    expect(result.options.find((option) => option.isCorrect)?.text).toBe(baseInput.literalText);
    expect(result.explanation).toContain(baseInput.articleRef);
  });

  it("gera certo ou errado com duas opções e alteração controlada rastreável", () => {
    const result = buildNoticeQuestionDraft({ ...baseInput, bankSlug: "cebraspe", format: "true_false" });
    expect(result.type).toBe("true_false");
    expect(result.options.map((option) => option.key)).toEqual(["C", "E"]);
    expect(result.options.filter((option) => option.isCorrect)).toHaveLength(1);
    expect(["official_text_exact", "controlled_source_mutation"]).toContain(result.mutationKind);
  });

  it("produz identificador idempotente e UUID v5 para a mesma assinatura", () => {
    const first = deterministicNoticeQuestionUuid("requisito|artigo|banca");
    const second = deterministicNoticeQuestionUuid("requisito|artigo|banca");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deterministicNoticeQuestionUuid("outra assinatura")).not.toBe(first);
  });

  it("recusa artigo amplo demais para evitar uma questão ambígua", () => {
    expect(() =>
      buildNoticeQuestionDraft({
        ...baseInput,
        format: "multiple_choice",
        literalText: "texto oficial ".repeat(80),
      }),
    ).toThrow(/excede 900 caracteres/i);
  });
});
