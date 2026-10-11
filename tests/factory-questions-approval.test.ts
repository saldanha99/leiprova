import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseFactoryApprovalArgs } from "../scripts/approve-factory-questions";

const script = readFileSync(new URL("../scripts/approve-factory-questions.ts", import.meta.url), "utf8");
const reviewScript = readFileSync(new URL("../scripts/review-bound-opportunity-requirements.ts", import.meta.url), "utf8");

describe("aprovação em massa das inéditas por autorização do proprietário", () => {
  it("exige um concurso e só grava com --apply", () => {
    expect(parseFactoryApprovalArgs(["--", "--contest=pc-ma-delegado-2026"])).toEqual({
      apply: false,
      contestSlug: "pc-ma-delegado-2026",
    });
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
    expect(script).toContain('itemBindingMode: "owner_bulk_authorization"');
    expect(script).toContain('approvalMode: "owner_authorization"');
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
});
