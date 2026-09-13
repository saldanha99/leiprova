import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("gates comerciais e de entrega de provas reais", () => {
  it("não deixa o Master contornar o vínculo de produto liberado no quiz", () => {
    const source = readFileSync(
      "src/app/api/quiz/session/route.ts",
      "utf8",
    );
    expect(source).toContain(
      "approvedReleasedProductPreviousExamQuestionExists(",
    );
    expect(source).toContain("entitlement.accessEndsAt.toISOString()");
  });

  it("retira todas as questões reais da compra avulsa se o caderno ficar incompleto", () => {
    const source = readFileSync("src/lib/study/entitlement.ts", "utf8");
    expect(source).toContain("licensedPreviousExamContentSatisfied(");
    expect(source.indexOf("licensedPreviousExamContentSatisfied(")).toBeLessThan(
      source.indexOf("approvedProductPreviousExamQuestionExists("),
    );
  });

  it("revalida a prova antes de revelar correção e gabarito de sessão existente", () => {
    const answer = readFileSync(
      "src/app/api/quiz/answer/route.ts",
      "utf8",
    );
    const finish = readFileSync(
      "src/app/api/quiz/finish/route.ts",
      "utf8",
    );
    expect(answer).toContain(
      "approvedReleasedProductPreviousExamQuestionExists(",
    );
    expect(answer.lastIndexOf("approvedReleasedProductPreviousExamQuestionExists(")).toBeLessThan(
      answer.indexOf("NextResponse.json(correctionResponse(context"),
    );
    expect(finish.match(/approvedReleasedProductPreviousExamQuestionExists\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(finish).toContain('error: "question_content_unavailable"');
    expect(finish.indexOf("previousExamGoverned")).toBeLessThan(
      finish.indexOf("explanation: answer.explanation"),
    );
  });

  it("serializa enunciado e gabarito com a revogação da edição", () => {
    const session = readFileSync("src/app/api/quiz/session/route.ts", "utf8");
    const answer = readFileSync("src/app/api/quiz/answer/route.ts", "utf8");
    const finish = readFileSync("src/app/api/quiz/finish/route.ts", "utf8");
    const admin = readFileSync(
      "src/app/admin/provas-anteriores/actions.ts",
      "utf8",
    );

    expect(session.indexOf("const candidateQuestionRows")).toBeLessThan(
      session.indexOf("prompt: questions.prompt"),
    );
    expect(session.indexOf("lock_exam_document_review_edition")).toBeLessThan(
      session.indexOf("prompt: questions.prompt"),
    );
    expect(answer.indexOf("lock_exam_document_review_edition")).toBeLessThan(
      answer.indexOf("explanation: questions.explanation"),
    );
    expect(finish.indexOf("lock_exam_document_review_edition")).toBeLessThan(
      finish.indexOf("const answerRows = await tx"),
    );

    const revokeReference = admin.indexOf(
      "export async function revokeProductExamReferenceAction",
    );
    const editionLock = admin.indexOf(
      "lock_exam_document_review_edition",
      revokeReference,
    );
    const productLock = admin.indexOf(
      "lock_product_binding_review_product",
      revokeReference,
    );
    expect(editionLock).toBeGreaterThan(revokeReference);
    expect(editionLock).toBeLessThan(productLock);
  });

  it("revalida todos os produtos do Master antes de reservar e retomar cobrança", () => {
    const source = readFileSync(
      "src/app/api/stripe/checkout/route.ts",
      "utf8",
    );
    expect(source.match(/getMasterCatalogCoverageStatus\(/g)).toHaveLength(2);
    expect(source).toContain("isMasterCatalogCoverageReady(coverage)");
    expect(source.indexOf("getMasterCatalogCoverageStatus(")).toBeLessThan(
      source.indexOf("stripe.checkout.sessions.create("),
    );

    const webhook = readFileSync(
      "src/lib/stripe/master-subscription.ts",
      "utf8",
    );
    expect(webhook).toContain("getMasterCatalogCoverageStatus(end, tx)");
    expect(webhook).toContain("isMasterCatalogCoverageReady(coverage)");
    expect(webhook.indexOf("getMasterCatalogCoverageStatus(end, tx)")).toBeLessThan(
      webhook.indexOf("tx.insert(subscriptions)"),
    );
  });

  it("revalida o fim do plano de concurso antes da sessão e do acesso recorrente", () => {
    const checkout = readFileSync(
      "src/app/api/stripe/contest-checkout/route.ts",
      "utf8",
    );
    const webhook = readFileSync(
      "src/lib/commerce/subscription-webhook.ts",
      "utf8",
    );
    expect(checkout).toContain("accessEndsAt(latestActivationAt, line.months)");
    expect(checkout.match(/contentCoverageIsReady\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(webhook).toContain("period.end,\n          tx,");
    expect(webhook.indexOf("hasSellableContestProductCoverage(")).toBeLessThan(
      webhook.indexOf(".insert(contestPurchases)"),
    );
  });
});
