import { describe, expect, it } from "vitest";

import { quizSessionRequestSchema, resolveCatalogSelection } from "@/lib/quiz/session-contract";

describe("contrato da API de quiz", () => {
  it("aceita seleção por carreira e aplica padrões seguros", () => {
    const parsed = quizSessionRequestSchema.parse({
      path: "career",
      careerSlug: "policia-federal",
      subjectSlug: "direito-constitucional",
      mode: "dry_law",
      count: 10,
    });

    expect(parsed).toMatchObject({
      experience: "training",
      timed: false,
      examScope: "latest",
    });
    expect(resolveCatalogSelection(parsed).career?.featured).toBe(true);
  });

  it("aceita simulado da última edição por carreira sem banca fixa", () => {
    const parsed = quizSessionRequestSchema.parse({
      path: "career",
      careerSlug: "magistratura",
      specializationSlug: "estadual",
      mode: "previous_exam",
      count: 20,
      experience: "exam",
      timed: true,
      examScope: "latest",
    });

    expect(parsed.bankSlug).toBeUndefined();
    expect(parsed.specializationSlug).toBe("estadual");
  });

  it("exige banca no caminho por banca e em questões inéditas", () => {
    expect(
      quizSessionRequestSchema.safeParse({ path: "bank", mode: "dry_law", count: 5 }).success,
    ).toBe(false);
    expect(
      quizSessionRequestSchema.safeParse({
        path: "career",
        careerSlug: "delegado",
        mode: "original_style",
        count: 5,
      }).success,
    ).toBe(false);
  });

  it("mantém no servidor os recortes obrigatórios exibidos pelo construtor", () => {
    expect(
      quizSessionRequestSchema.safeParse({
        path: "bank",
        bankSlug: "vunesp",
        mode: "dry_law",
        count: 5,
      }).success,
    ).toBe(false);
    expect(
      quizSessionRequestSchema.safeParse({
        path: "career",
        careerSlug: "magistratura",
        mode: "previous_exam",
        count: 20,
        examScope: "latest",
      }).success,
    ).toBe(false);
    expect(
      quizSessionRequestSchema.safeParse({
        path: "career",
        careerSlug: "delegado",
        mode: "dry_law",
        count: 5,
      }).success,
    ).toBe(false);
  });

  it("rejeita tópico fora da matéria e edição fora de questões anteriores", () => {
    expect(
      quizSessionRequestSchema.safeParse({
        path: "bank",
        bankSlug: "vunesp",
        subjectSlug: "direito-civil",
        topicSlug: "inquerito-policial",
        mode: "dry_law",
        count: 5,
      }).success,
    ).toBe(false);
    expect(
      quizSessionRequestSchema.safeParse({
        path: "bank",
        bankSlug: "fgv",
        subjectSlug: "direito-constitucional",
        mode: "dry_law",
        count: 5,
        examEditionId: "edicao-2026",
      }).success,
    ).toBe(false);
  });
});
