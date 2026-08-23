import { describe, expect, it } from "vitest";

import { scheduleReview } from "@/lib/study/review";

describe("scheduleReview", () => {
  const now = new Date("2026-08-16T12:00:00Z");

  it("avança um estágio quando o aluno acerta com confiança", () => {
    const result = scheduleReview({ currentStage: 1, isCorrect: true, confidence: "sure", now });
    expect(result.nextStage).toBe(2);
    expect(result.intervalDays).toBe(7);
    expect(result.nextReviewAt.toISOString()).toBe("2026-08-23T12:00:00.000Z");
  });

  it("mantém o estágio em acerto de baixa confiança", () => {
    const result = scheduleReview({ currentStage: 2, isCorrect: true, confidence: "guess", now });
    expect(result.nextStage).toBe(2);
    expect(result.intervalDays).toBe(7);
  });

  it("reinicia a curva após erro", () => {
    const result = scheduleReview({ currentStage: 5, isCorrect: false, confidence: "sure", now });
    expect(result.nextStage).toBe(0);
    expect(result.intervalDays).toBe(1);
  });
});
