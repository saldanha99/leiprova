import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const dailyPlan = readFileSync(join(process.cwd(), "src", "lib", "db", "daily-plan.ts"), "utf8");
const simulations = readFileSync(join(process.cwd(), "src", "lib", "db", "quiz-exam-editions.ts"), "utf8");

describe("alimentação do estudo com conteúdo real revisado", () => {
  it("permite ao plano diário usar lei seca e questões autorais revisadas", () => {
    expect(dailyPlan).toContain('["dry_law", "original_style"]');
    expect(dailyPlan).toContain('eq(questions.editorialStatus, "reviewed")');
  });

  it("só anuncia simulados quando há autoria, revisão e base legal oficial atual", () => {
    expect(simulations).toContain('eq(questions.quizMode, "original_style")');
    expect(simulations).toContain('eq(questions.sourceRights, "original_authorial")');
    expect(simulations).toContain('eq(questions.editorialStatus, "reviewed")');
    expect(simulations).toContain('eq(legalArticles.sourceRights, "official_text")');
    expect(simulations).toContain('eq(legalVersions.status, "current")');
  });
});
