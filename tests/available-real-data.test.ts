import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AVAILABLE_REAL_EXAM_EDITIONS,
  validateAvailableRealExamEditions,
  type AvailableExamEdition,
} from "@/lib/exams/available-real-data";
import { isOfficialExamUrl } from "@/lib/official-sources/exam-registry";

const historical: readonly AvailableExamEdition[] = AVAILABLE_REAL_EXAM_EDITIONS.filter(
  (edition) => edition.status === "published",
);

describe("carga de dados reais disponíveis", () => {
  it("mantém treze edições atuais vinculáveis e vinte e quatro históricas oficiais", () => {
    expect(validateAvailableRealExamEditions()).toHaveLength(37);

    const scheduled: readonly AvailableExamEdition[] = AVAILABLE_REAL_EXAM_EDITIONS.filter(
      (edition) => edition.status === "scheduled",
    );
    const published = AVAILABLE_REAL_EXAM_EDITIONS.filter((edition) => edition.status === "published");

    expect(scheduled.map((edition) => [edition.publicId, edition.examDate])).toEqual([
      ["enac-2026-2", "2026-11-22"],
      ["enam-2026-2", "2026-11-29"],
      ["pc-pr-2026", "2026-10-11"],
      ["pgm-manaus-2026", "2026-09-20"],
      ["trf-5-juiz-federal-2026", "2026-12-20"],
      ["tj-rs-juiz-2026", "2026-12-13"],
      ["pc-al-2026", "2026-12-06"],
      ["pc-ma-delegado-2026", "2026-11-01"],
      ["pc-ma-investigador-2026", "2026-12-06"],
      ["seap-ma-inspetor-2026", "2026-12-13"],
      ["sefaz-al-auditor-fiscal-2026", "2026-12-20"],
      ["tce-ma-2026", "2026-11-22"],
      ["tc-df-analista-2026", "2026-11-22"],
    ]);
    expect(scheduled.every((edition) => edition.opportunitySlug && edition.productSlugs?.length)).toBe(true);
    expect(published).toHaveLength(24);
    expect(published.every((edition) => edition.documents.length === 2)).toBe(true);
  });

  it("registra cada prova histórica com um caderno contado e um gabarito definitivo", () => {
    for (const edition of historical) {
      const booklets = edition.documents.filter((document) => document.documentType === "question_booklet");
      const answerKeys = edition.documents.filter((document) => document.documentType === "answer_key");

      expect(booklets).toHaveLength(1);
      expect(booklets[0].expectedQuestionCount).toBeGreaterThan(0);
      expect(answerKeys).toHaveLength(1);
      expect(answerKeys[0].title).toMatch(/definitivo/iu);
      // Toda prova histórica já foi aplicada antes do levantamento de 27/09/2026.
      expect(edition.examDate < "2026-09-27").toBe(true);
      expect(edition.productSlugs).toBeUndefined();
    }
  });

  it("recusa jurisdição, sigla ou prova histórica fora das regras do banco", () => {
    const base = historical[0];

    expect(() => validateAvailableRealExamEditions([{ ...base, jurisdictionCode: "XX" }])).toThrow("Jurisdição");
    expect(() => validateAvailableRealExamEditions([{ ...base, institutionAcronym: "tj-ba" }])).toThrow("Sigla");
    expect(() =>
      validateAvailableRealExamEditions([{ ...base, documents: base.documents.slice(0, 1) }]),
    ).toThrow("caderno e gabarito");
  });

  it("aceita somente fontes oficiais HTTPS das bancas e não incorpora conteúdo", () => {
    for (const edition of AVAILABLE_REAL_EXAM_EDITIONS) {
      expect(isOfficialExamUrl(edition.bankSlug, edition.officialUrl)).toBe(true);
      for (const document of edition.documents) {
        expect(isOfficialExamUrl(edition.bankSlug, document.sourceUrl)).toBe(true);
        expect(Object.keys(document)).not.toContain("content");
        expect(Object.keys(document)).not.toContain("storageKey");
        expect(Object.keys(document)).not.toContain("license");
      }
    }
  });

  it("cadastra as provas anteriores da Cebraspe pela parte de conhecimentos específicos", () => {
    const byId = new Map(historical.map((edition) => [edition.publicId, edition]));
    const expected = [
      ["pc-al-agente-2021", "policia-civil", "2021-08-29", 120],
      ["pc-ma-investigador-2018", "policia-civil", "2018-01-28", 40],
      ["sefaz-al-auditor-fiscal-2021", "auditor-fiscal", "2021-10-23", 160],
      ["tc-df-analista-2023", "controle-externo", "2023-11-19", 70],
    ] as const;
    for (const [publicId, careerSlug, examDate, count] of expected) {
      const edition = byId.get(publicId);
      expect(edition).toMatchObject({ bankSlug: "cebraspe", careerSlug, examDate, status: "published" });
      const [booklet, answerKey] = edition!.documents;
      expect(booklet).toMatchObject({ documentType: "question_booklet", expectedQuestionCount: count });
      // Gabarito separado por parte: o título diz qual parte ele cobre.
      expect(answerKey.title).toMatch(/gabarito definitivo/iu);
      expect(answerKey.sourceUrl.startsWith(`https://cdn.cebraspe.org.br/concursos/${edition!.sourceExternalId}/arquivos/`)).toBe(true);
    }
  });

  it("preserva os bloqueios editoriais e comerciais no comando de aplicação", () => {
    const script = readFileSync(join(process.cwd(), "scripts", "feed-available-real-data.ts"), "utf8");

    expect(script).toContain("metadata_only");
    expect(script).toContain("pending_review");
    expect(script).toContain("productsReleased: 0");
    expect(script).not.toContain("sourceRights: \"licensed\"");
    expect(script).not.toContain("status='released'");
    // Reaplicar a carga não falha nem mexe no produto já liberado deste edital.
    expect(script).toContain('if (!product.opportunityId && product.status !== "draft")');
  });
});
