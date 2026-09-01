import { describe, expect, it } from "vitest";

import { isQuizConfigReady, type QuizConfig } from "@/components/quiz/types";
import type { QuizExamEditionOption } from "@/lib/quiz/exam-edition-catalog";

const edition: QuizExamEditionOption = {
  publicId: "tjsp-2025-juiz-substituto",
  title: "TJSP — Juiz Substituto",
  examDate: "2025-09-14",
  examYear: 2025,
  organizer: "Tribunal de Justiça de São Paulo",
  jurisdiction: "São Paulo",
  careerSlug: "magistratura",
  specializationSlug: "estadual",
  bank: {
    slug: "vunesp",
    name: "VUNESP",
  },
};

const baseConfig: QuizConfig = {
  path: "career",
  careerSlug: "magistratura",
  specializationSlug: "estadual",
  subjectSlug: "direito-constitucional",
  mode: "dry_law",
  count: 10,
  experience: "training",
  timed: false,
  examScope: "latest",
};

describe("configuração temporal do construtor de quiz", () => {
  it("mantém lei seca disponível sem inventar uma banca", () => {
    expect(isQuizConfigReady(baseConfig, [])).toBe(true);
  });

  it("exige uma edição elegível para prova anterior e estilo da banca", () => {
    expect(isQuizConfigReady({ ...baseConfig, mode: "previous_exam" }, [edition])).toBe(false);
    expect(
      isQuizConfigReady(
        {
          ...baseConfig,
          mode: "previous_exam",
          examYear: edition.examYear,
          examEditionId: edition.publicId,
        },
        [edition],
      ),
    ).toBe(true);
    expect(
      isQuizConfigReady(
        {
          ...baseConfig,
          mode: "original_style",
          examYear: edition.examYear,
          examEditionId: edition.publicId,
        },
        [edition],
      ),
    ).toBe(true);
  });

  it("rejeita banca livre e edição de outro recorte", () => {
    expect(isQuizConfigReady({ ...baseConfig, bankSlug: "fgv" }, [edition])).toBe(false);
    expect(
      isQuizConfigReady(
        {
          ...baseConfig,
          specializationSlug: "federal",
          mode: "previous_exam",
          examYear: edition.examYear,
          examEditionId: edition.publicId,
        },
        [edition],
      ),
    ).toBe(false);
  });
});
