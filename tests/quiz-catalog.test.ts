import { describe, expect, it } from "vitest";

import {
  getCareerBySlug,
  getSubjectsForCareer,
  quizBanks,
  quizCareerTracks,
  quizModes,
  quizSubjects,
} from "@/lib/quiz/catalog";

describe("catálogo de quizzes", () => {
  it("mantém as quatro bancas canônicas", () => {
    expect(quizBanks.map((bank) => bank.slug)).toEqual(["vunesp", "fgv", "fcc", "cebraspe"]);
  });

  it("cobre todas as carreiras solicitadas e destaca Polícia Federal", () => {
    expect(quizCareerTracks.map((career) => career.slug)).toEqual(
      expect.arrayContaining([
        "defensor-publico",
        "analista",
        "analista-juridico",
        "promotor-justica",
        "magistratura",
        "tecnico-judiciario",
        "delegado",
        "policia-civil",
        "policia-federal",
        "oab",
        "oficial-promotoria",
        "oficial-justica",
        "escrivao-policia-civil",
      ]),
    );
    expect(getCareerBySlug("policia-federal")?.featured).toBe(true);
  });

  it("separa as três magistraturas sem fixar banca na carreira", () => {
    const magistratura = getCareerBySlug("magistratura");
    expect(magistratura?.specializations.map((item) => item.slug)).toEqual([
      "federal",
      "estadual",
      "trabalho",
    ]);
    expect(magistratura).not.toHaveProperty("bankSlug");
  });

  it("oferece Direito Civil com o capítulo de Obrigações", () => {
    const civil = quizSubjects.find((subject) => subject.slug === "direito-civil");
    expect(civil?.topics).toContainEqual({ slug: "obrigacoes", name: "Obrigações" });
    expect(getSubjectsForCareer("oab").some((subject) => subject.slug === "direito-civil")).toBe(true);
    expect(getSubjectsForCareer("inexistente")).toEqual([]);
  });

  it("expõe os três modos sem representar questão anterior como inédita", () => {
    expect(quizModes.map((mode) => mode.slug)).toEqual([
      "dry_law",
      "previous_exam",
      "original_style",
    ]);
  });
});
