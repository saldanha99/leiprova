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

  it("aceita três pendentes apenas quando a edição declara evidência composta", () => {
    expect(script).toContain(
      "const compositeEvidence = requiresAnswerKeyMaintenanceAct(edition.answerKeyFinality)",
    );
    expect(script).toContain("const expectedPending = compositeEvidence ? 3 : 2");
    expect(script).toContain(
      "pending.length !== expectedPending || Boolean(answerKeyDecision) !== compositeEvidence",
    );
    expect(script).toContain(
      'pending.find((document) => document.documentType === "answer_key_decision")',
    );
    // O terceiro slot é gravado, com o tipo explícito, e fica nulo nas demais.
    expect(script).toContain("answerKeyDecisionDocumentId: scope.answerKeyDecisionDocumentId ?? null");
    expect(script).toContain(
      'answerKeyDecisionDocumentType: scope.answerKeyDecisionDocumentId ? "answer_key_decision" : null',
    );
    expect(script).toContain("answerKeyDecisionDocumentPublicId: answerKeyDecision.publicId");
    // A decisão continua passando pela mesma política, sem licença.
    expect(script).toContain(
      "validateExamReferenceScope(scope, todayIso, { requireLicense: false })",
    );
    expect(script).toContain("documentsApproved: pendingDocuments.length");
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
