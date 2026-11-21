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
    expect(source).toContain("QUIZ_CATALOG_CACHE_TTL_MS = 15 * 60_000");
    expect(source).toContain("staleWhileRevalidate(loadOriginalStyleSimulationCoverage");
    expect(source).toContain("__leiprovaQuizCatalog");
    expect(page("src/instrumentation.ts")).toContain("warmQuizCatalogCaches");
  });
});

describe("treino: elegibilidade em cache com reconferência", () => {
  it("a rota escolhe candidatas pela lista em cache e reconfere o filtro completo antes de entregar", () => {
    const route = page("src/app/api/study/session/route.ts");
    expect(route).toContain("await eligibleStudyCondition()");
    expect(route).toContain("await keepCurrentlyEligible(questionRows, 10)");
    expect(route).not.toContain("authorialStudyRightsConditions(),");
    const pool = page("src/lib/study/eligible-question-pool.ts");
    expect(pool).toContain("authorialStudyRightsConditions()");
    expect(pool).toContain("__leiprovaStudyPool");
  });
});

describe("aquecimento da vitrine e reavaliação diária de SEO", () => {
  it("a lista de produtos à venda fica no processo inteiro e é aquecida primeiro na partida", () => {
    const store = page("src/lib/commerce/store.ts");
    expect(store).toContain("__leiprovaReleasedProducts");
    expect(store).toContain("export async function warmReleasedContestProducts");
    const boot = page("src/instrumentation.ts");
    expect(boot.indexOf("warmReleasedContestProducts()")).toBeGreaterThan(-1);
    expect(boot.indexOf("warmReleasedContestProducts()")).toBeLessThan(boot.indexOf("warmQuizCatalogCaches()"));
  });

  it("o job diário usa os valores do .env do app com os padrões do compose e roda 1 vez por dia", () => {
    const job = page("deploy/seo-page-state.sh");
    expect(job).toContain('WAVE="${WAVE:-off}"');
    expect(job).toContain('DIRECT="${DIRECT:-1}"');
    expect(job).toContain("scripts/seo/refresh-page-state.ts $MODE");
    expect(page("docker-compose.yml")).toContain("SEO_WAVE: ${SEO_WAVE:-off}");
    expect(page("docker-compose.yml")).toContain("SEO_DIRECT_ANSWER_REQUIRED: ${SEO_DIRECT_ANSWER_REQUIRED:-1}");
    const timer = page("deploy/systemd/leiprova-seo-page-state.timer");
    expect(timer).toContain("OnCalendar=*-*-* 04:30:00 America/Sao_Paulo");
    expect(page("deploy/systemd/leiprova-seo-page-state.service")).toContain("flock -n");
  });
});
