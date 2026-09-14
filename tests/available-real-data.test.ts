import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AVAILABLE_REAL_EXAM_EDITIONS,
  validateAvailableRealExamEditions,
} from "@/lib/exams/available-real-data";

describe("carga de dados reais disponíveis", () => {
  it("mantém quatro edições atuais vinculáveis e duas históricas oficiais", () => {
    expect(validateAvailableRealExamEditions()).toHaveLength(6);

    const scheduled = AVAILABLE_REAL_EXAM_EDITIONS.filter((edition) => edition.status === "scheduled");
    const published = AVAILABLE_REAL_EXAM_EDITIONS.filter((edition) => edition.status === "published");

    expect(scheduled.map((edition) => [edition.publicId, edition.examDate])).toEqual([
      ["enac-2026-2", "2026-11-22"],
      ["enam-2026-2", "2026-11-29"],
      ["pc-pr-2026", "2026-10-11"],
      ["pgm-manaus-2026", "2026-09-20"],
    ]);
    expect(scheduled.every((edition) => edition.opportunitySlug && edition.productSlugs?.length)).toBe(true);
    expect(published.map((edition) => edition.documents.length)).toEqual([2, 2]);
  });

  it("aceita somente fontes oficiais HTTPS da FGV e não incorpora conteúdo", () => {
    for (const edition of AVAILABLE_REAL_EXAM_EDITIONS) {
      expect(["conhecimento.fgv.br", "www.concursosfcc.com.br"]).toContain(new URL(edition.officialUrl).hostname);
      for (const document of edition.documents) {
        expect(new URL(document.sourceUrl).hostname).toBe("conhecimento.fgv.br");
        expect(Object.keys(document)).not.toContain("content");
        expect(Object.keys(document)).not.toContain("storageKey");
        expect(Object.keys(document)).not.toContain("license");
      }
    }
  });

  it("preserva os bloqueios editoriais e comerciais no comando de aplicação", () => {
    const script = readFileSync(join(process.cwd(), "scripts", "feed-available-real-data.ts"), "utf8");

    expect(script).toContain("metadata_only");
    expect(script).toContain("pending_review");
    expect(script).toContain("productsReleased: 0");
    expect(script).not.toContain("sourceRights: \"licensed\"");
    expect(script).not.toContain("status='released'");
  });
});
