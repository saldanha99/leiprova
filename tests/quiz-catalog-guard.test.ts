import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = (path: string) => readFileSync(path, "utf8");

describe("quiz e simulados: login antes da consulta pesada", () => {
  it.each(["src/app/(platform)/app/quiz/page.tsx", "src/app/(platform)/app/simulados/page.tsx"])(
    "%s chama requireUser antes de listar edições",
    (path) => {
      const source = page(path);
      const guard = source.indexOf("await requireUser(");
      const query = source.indexOf("listEligibleQuizExamEditions(new Date()");
      expect(guard).toBeGreaterThan(-1);
      expect(query).toBeGreaterThan(guard);
    },
  );

  it("as duas listas rodam com limite próprio e cache curto", () => {
    const source = page("src/lib/db/quiz-exam-editions.ts");
    expect(source).toContain("set local statement_timeout");
    expect(source).toContain("QUIZ_CATALOG_CACHE_TTL_MS = 5 * 60_000");
    expect(source).toContain("staleWhileRevalidate(loadOriginalStyleSimulationCoverage");
    expect(page("src/instrumentation.ts")).toContain("warmQuizCatalogCaches");
  });
});
