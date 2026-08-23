import { describe, expect, it } from "vitest";

import {
  calculateQuizDeadline,
  calculateQuizResult,
  emptyQuizReason,
  formatQuizQuestionSource,
  normalizeQuizDurationMs,
} from "@/lib/quiz/response";

describe("respostas da API de quiz", () => {
  const verifiedAt = new Date("2026-08-16T12:00:00Z");

  it("normaliza a duração do navegador para o inteiro aceito pela API", () => {
    expect(normalizeQuizDurationMs(1_000.25, 2_234.8)).toBe(1_235);
    expect(normalizeQuizDurationMs(2_000, 1_000)).toBe(0);
    expect(normalizeQuizDurationMs(Number.NaN, 1_000)).toBe(0);
    expect(normalizeQuizDurationMs(0, 3_000_000)).toBe(1_800_000);
  });

  it("não chama conteúdo sem licença de prova anterior", () => {
    expect(emptyQuizReason("previous_exam")).toEqual({
      reason: "no_licensed_previous_exam",
      message: "Ainda não há questões anteriores licenciadas para esta seleção.",
    });
    expect(() =>
      formatQuizQuestionSource({
        mode: "previous_exam",
        sourceTitle: null,
        sourceUrl: null,
        verifiedAt,
        legalActTitle: null,
        officialLegalUrl: null,
        styleBankName: "FGV",
      }),
    ).toThrow("procedência completa");
  });

  it("rotula lei seca com a fonte legal oficial", () => {
    expect(
      formatQuizQuestionSource({
        mode: "dry_law",
        sourceTitle: "Questão autoral",
        sourceUrl: null,
        verifiedAt,
        legalActTitle: "Constituição Federal",
        officialLegalUrl: "https://www.planalto.gov.br/",
        styleBankName: null,
      }),
    ).toEqual({
      kind: "official_law",
      label: "Constituição Federal",
      url: "https://www.planalto.gov.br/",
      verifiedAt: "2026-08-16",
    });
  });

  it("calcula o resultado sobre todas as questões, inclusive não respondidas", () => {
    expect(calculateQuizResult(5, [true, false, true, null, null])).toEqual({
      total: 5,
      answered: 3,
      correct: 2,
      scorePercent: 40,
    });
  });

  it("define prazo cronometrado pela edição ou por 90 segundos por questão", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    expect(
      calculateQuizDeadline(now, { timed: true, count: 10 })?.toISOString(),
    ).toBe("2026-08-16T12:15:00.000Z");
    expect(
      calculateQuizDeadline(now, {
        timed: true,
        count: 10,
        editionDurationMinutes: 240,
      })?.toISOString(),
    ).toBe("2026-08-16T16:00:00.000Z");
    expect(
      calculateQuizDeadline(now, { timed: false, count: 10 }),
    ).toBeNull();
  });
});
