import { describe, expect, it } from "vitest";

import { defaultQuizConfig, quizConfigFromSearchParams, quizPresetHref } from "@/components/quiz/preset-config";

describe("presets de simulados", () => {
  it("carrega um treino autoral por banca", () => {
    const config = quizConfigFromSearchParams({
      caminho: "banca",
      banca: "fgv",
      materia: "direito-constitucional",
      modo: "original_style",
      quantidade: "20",
      experiencia: "prova",
      cronometrado: "1",
    }, []);

    expect(config).toMatchObject({
      path: "bank",
      bankSlug: "fgv",
      subjectSlug: "direito-constitucional",
      mode: "original_style",
      count: 20,
      experience: "exam",
      timed: true,
    });
  });

  it("recusa combinações inválidas em vez de iniciar um quiz incorreto", () => {
    expect(quizConfigFromSearchParams({ caminho: "banca", banca: "inexistente", modo: "dry_law" }, []))
      .toEqual(defaultQuizConfig);
  });

  it("preserva o recorte em um link compartilhável", () => {
    expect(quizPresetHref({
      path: "career",
      careerSlug: "analista",
      subjectSlug: "direito-constitucional",
      mode: "dry_law",
      count: 10,
      experience: "training",
      timed: false,
      examScope: "latest",
    })).toBe("/app/quiz?caminho=carreira&carreira=analista&materia=direito-constitucional&modo=dry_law&quantidade=10&experiencia=treino&cronometrado=0&escopo=ultima");
  });
});
