import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseFactoryApprovalArgs } from "../scripts/approve-factory-questions";

const script = readFileSync(new URL("../scripts/approve-factory-questions.ts", import.meta.url), "utf8");
const reviewScript = readFileSync(new URL("../scripts/review-bound-opportunity-requirements.ts", import.meta.url), "utf8");
const bindingReviewScript = readFileSync(new URL("../scripts/review-current-product-bindings.ts", import.meta.url), "utf8");

describe("aprovação em massa das inéditas por autorização do proprietário", () => {
  it("exige um concurso e só grava com --apply", () => {
    expect(parseFactoryApprovalArgs(["--", "--contest=pc-ma-delegado-2026"])).toEqual({
      apply: false,
      standing: false,
      contestSlug: "pc-ma-delegado-2026",
    });
    expect(parseFactoryApprovalArgs(["--apply", "--standing", "--contest=enac-2026-2"]).standing).toBe(true);
    expect(parseFactoryApprovalArgs(["--apply", "--contest=enac-2026-2"]).apply).toBe(true);
    expect(() => parseFactoryApprovalArgs([])).toThrow(/--contest/u);
    expect(() => parseFactoryApprovalArgs(["--contest=../x"])).toThrow(/--contest/u);
    expect(() => parseFactoryApprovalArgs(["--contest=a", "--contest=b"])).toThrow(/--contest/u);
  });

  it("aplica as checagens do painel e registra a autorização, sem vincular nem liberar", () => {
    expect(script).toContain("evaluateOriginalQuestionApproval({");
    expect(script).toContain("findMostSimilarQuestion(");
    expect(script).toContain("currentLegalSourceExists()");
    expect(script).toContain("lockApprovalScope(transaction");
    expect(script).toContain('itemBindingMode: standing ? "owner_standing_authorization" : "owner_bulk_authorization"');
    // A trilha diz quando ninguém conferiu o item.
    expect(script).toContain("humanItemReview: !standing");
    expect(script).toContain('approvalMode: standing ? "owner_standing_authorization" : "owner_authorization"');
    expect(script).toContain("if (!apply) throw new PreviewRollback");
    expect(script).not.toMatch(/contest_product_question_bindings|contestStoreProducts/u);
  });

  it("revisão do requisito grava o conjunto de artigos do item, com matéria única", () => {
    expect(reviewScript).toContain('mode() within group (order by binding.legal_article_id::integer) as "primaryArticleId"');
    expect(reviewScript).toContain("candidate.subjectIds.length !== 1");
    // Tópico vazio não vira NaN no driver: conta à parte e grava null.
    expect(reviewScript).toContain("filter (where question.topic_id is not null), '{}') as \"topicIds\"");
    expect(reviewScript).toContain("topic_id=${candidate.topicIds[0] ?? null}");
    expect(reviewScript).toContain("insert into opportunity_requirement_articles(requirement_id,legal_article_id)");
  });

  it("aprova vínculos novos também de produto já liberado", () => {
    expect(bindingReviewScript).toContain("product.status in ('draft','released')");
  });
});

describe("conferência posterior e linha automática (decisão de 11/10/2026)", () => {
  const chain = readFileSync(new URL("../deploy/editorial-release-chain.sh", import.meta.url), "utf8");

  it("suspende só com motivo e questões identificadas", async () => {
    const { parseSuspendArgs } = await import("../scripts/suspend-questions");
    const id = "074ff4e2-2be8-557f-9956-61fef7412ba2";
    expect(parseSuspendArgs(["--", `question=${id}`, "--reason=Gabarito contraria o art. 5º."])).toEqual({
      apply: false,
      reason: "Gabarito contraria o art. 5º.",
      publicIds: [id],
    });
    expect(() => parseSuspendArgs([`question=${id}`])).toThrow(/motivo/u);
    expect(() => parseSuspendArgs(["--reason=Motivo suficiente aqui."])).toThrow(/question/u);
    expect(() => parseSuspendArgs(["question=x", "--reason=Motivo suficiente aqui."])).toThrow(/inválido/u);
  });

  it("aprova em modo permanente e não toca em flag comercial", () => {
    expect(chain).toContain("editorial:questions:approve -- --apply --standing");
    expect(chain).toContain('REF="owner-standing-2026-10-11:aprovar-sozinho"');
    expect(chain).toContain('if [ "$status" = "draft" ]; then');
    expect(chain).toContain("flock -n 9");
    expect(chain).not.toMatch(/_ENABLED=|\.env\b|STRIPE_/u);
  });
});
