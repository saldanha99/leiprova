import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const policy = readFileSync(join(process.cwd(), "src", "lib", "commerce", "previous-exam-content.ts"), "utf8");
const query = readFileSync(join(process.cwd(), "src", "lib", "db", "xray-queries.ts"), "utf8");

describe("Raio-X histórico por banca", () => {
  it("não confunde histórico licenciado com a última prova de um produto", () => {
    expect(policy).toContain("approvedHistoricalPreviousExamQuestionExists");
    expect(query).toContain("approvedHistoricalPreviousExamQuestionExists(questions.id)");
    expect(query).not.toContain("approvedReleasedProductPreviousExamQuestionExists(questions.id)");
  });

  it("limita a estatística aos últimos dez anos e às questões licenciadas e revisadas", () => {
    expect(query).toContain("interval '10 years'");
    expect(query).toContain('eq(questions.quizMode, "previous_exam")');
    expect(query).toContain('eq(questions.editorialStatus, "reviewed")');
    expect(query).toContain('eq(questions.sourceRights, "licensed")');
  });
});
