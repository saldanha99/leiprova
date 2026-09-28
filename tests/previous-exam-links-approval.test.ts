import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const script = readFileSync(
  new URL("../scripts/approve-previous-exam-links.ts", import.meta.url),
  "utf8",
);
const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

describe("aprovação de links oficiais de prova anterior por comando", () => {
  it("usa as mesmas consultas e a mesma política do painel", () => {
    expect(script).toContain('from "../src/lib/exams/previous-exam-review"');
    expect(script).toContain("validateExamReferenceScope(scope, todayIso, { requireLicense: false })");
    expect(script).toContain("verifyOfficialExamUrl(candidate.bankSlug, candidate.sourceUrl)");
    expect(script).toContain("lock_exam_document_review_edition");
    expect(script).toContain("lock_product_binding_review_product");
    expect(script).toContain('isolationLevel: "serializable"');
  });

  it("desfaz a prévia e não libera produto nem conteúdo licenciado", () => {
    expect(script).toContain("if (!apply) throw new PreviewRollback");
    expect(script).toContain("productsReleased: 0");
    expect(script).not.toMatch(/licensed_content|sourceRights|status: "released"/u);
    expect(packageJson).toContain(
      '"exams:links:approve": "tsx --env-file-if-exists=.env scripts/approve-previous-exam-links.ts"',
    );
  });
});
