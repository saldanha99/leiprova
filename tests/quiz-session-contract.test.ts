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

  it("aceita simulado de uma edição por carreira e deriva a banca no servidor", () => {
    const parsed = quizSessionRequestSchema.parse({
      path: "career",
      careerSlug: "magistratura",
      specializationSlug: "estadual",
      mode: "previous_exam",
      examEditionId: "tjsp-2026-juiz-substituto",
      count: 20,
      experience: "exam",
      timed: true,
      examScope: "latest",
    });

    expect(parsed.bankSlug).toBeUndefined();
    expect(parsed.specializationSlug).toBe("estadual");
  });

  it("exige banca no caminho por banca e edição no estilo original por carreira", () => {
    expect(
      quizSessionRequestSchema.safeParse({ path: "bank", mode: "dry_law", count: 5 }).success,
    ).toBe(false);
    expect(
      quizSessionRequestSchema.safeParse({
        path: "career",
        careerSlug: "delegado",
        subjectSlug: "direito-penal",
        mode: "original_style",
        count: 5,
      }).success,
    ).toBe(false);
    expect(
      quizSessionRequestSchema.safeParse({
        path: "career",
        careerSlug: "delegado",
        subjectSlug: "direito-penal",
        mode: "original_style",
        examEditionId: "pc-sp-delegado-2026",
        count: 5,
      }).success,
    ).toBe(true);
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
        specializationSlug: "estadual",
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

  it("rejeita tópico fora da matéria e edição adulterada no caminho por banca", () => {
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
        mode: "previous_exam",
        count: 5,
        examEditionId: "edicao-2026",
      }).success,
    ).toBe(false);
  });

  it("rejeita banca enviada livremente no caminho por carreira", () => {
    const result = quizSessionRequestSchema.safeParse({
      path: "career",
      careerSlug: "delegado",
      bankSlug: "fgv",
      subjectSlug: "direito-penal",
      mode: "dry_law",
      count: 5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["bankSlug"] }),
      );
    }
  });

  it("aceita edição como contexto jurídico em lei seca sem aceitar escopo todas", () => {
    expect(
      quizSessionRequestSchema.safeParse({
        path: "career",
        careerSlug: "delegado",
        subjectSlug: "direito-penal",
        mode: "dry_law",
        count: 5,
        examEditionId: "pc-sp-delegado-2026",
      }).success,
    ).toBe(true);
    expect(
      quizSessionRequestSchema.safeParse({
        path: "career",
        careerSlug: "delegado",
        subjectSlug: "direito-penal",
        mode: "dry_law",
        count: 5,
        examEditionId: "pc-sp-delegado-2026",
        examScope: "all",
      }).success,
    ).toBe(false);
  });
});
