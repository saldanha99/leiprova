import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { MINIMUM_COURSE_QUESTION_COUNT, approvedProductQuestionCount,
  hasMinimumCourseQuestionCount, minimumCourseContentSatisfied } from "../src/lib/commerce/minimum-course-content";
import { CONTEST_CATALOG, catalogContestPath } from "../src/lib/commerce/catalog";
import { findExactProductForOpportunityPage } from "../src/lib/commerce/product-page-association";

describe("piso editorial por produto", () => {
  it.each([[0, false], [1, false], [67, false], [68, true], [69, true], [NaN, false],
    [Infinity, false], [68.5, false], [-1, false]])("avalia %s questões distintas como %s", (count, expected) => {
    expect(hasMinimumCourseQuestionCount(Number(count))).toBe(expected);
  });
  it("mantém piso explícito de 68 por cada um dos 75 produtos", () => {
    expect(MINIMUM_COURSE_QUESTION_COUNT).toBe(68);
    expect(CONTEST_CATALOG.length * MINIMUM_COURSE_QUESTION_COUNT).toBe(5100);
  });
  it("conta DISTINCT question_id, preservando o predicado completo de evidências e o produto", () => {
    const query = new PgDialect().sqlToQuery(approvedProductQuestionCount(sql`${"concurso-x"}`, sql`${123}`));
    expect(query.sql).toContain("count(distinct content_binding.question_id)");
    expect(query.sql).toContain("content_binding.status = 'approved'");
    expect(query.sql).toContain("binding.status = 'approved'");
    expect(query.sql).toContain("q.editorial_status = 'reviewed'");
    expect(query.sql).toContain("requirement.editorial_status = 'reviewed'");
    expect(query.sql).toContain("version.status = 'current'");
    expect(query.sql).toContain("binding.evidence->'questionContent'");
    expect(query.sql).toContain("product.opportunity_id = binding.opportunity_id");
    expect(query.params).toContain("concurso-x");
    expect(query.params).toContain(123);
    const gate = new PgDialect().sqlToQuery(minimumCourseContentSatisfied(sql`${"concurso-x"}`));
    expect(gate.params.at(-1)).toBe(68);
  });
});

describe("associação exata de página e produto", () => {
  const candidates = CONTEST_CATALOG.filter((item) => item.acronym === "PC-BA");
  const products = candidates.map((item) => ({ slug: item.slug, opportunityPublicId: "mesma-oportunidade" }));
  const inputFor = (slug: string) => {
    const catalog = CONTEST_CATALOG.find((item) => item.slug === slug)!;
    const [, , categorySlug, jurisdictionSlug] = catalogContestPath(catalog).split("/");
    return { productSlug: slug, categorySlug, jurisdictionSlug, opportunityPublicId: "mesma-oportunidade" };
  };
  it("não escolhe o primeiro produto de uma oportunidade com vários cargos", () => {
    expect(products).toHaveLength(2);
    expect(findExactProductForOpportunityPage(products, inputFor(products[1].slug))).toBe(products[1]);
    expect(findExactProductForOpportunityPage([products[0]], inputFor(products[1].slug))).toBeUndefined();
  });
  it("não associa uma rota oficial genérica, outro estado, outra categoria ou outra edição", () => {
    const input = inputFor(products[0].slug);
    for (const change of [{ productSlug: "pc-ba-2026" }, { jurisdictionSlug: "sao-paulo" },
      { categorySlug: "tribunais" }, { opportunityPublicId: "outra-edicao" }]) {
      expect(findExactProductForOpportunityPage(products, { ...input, ...change })).toBeUndefined();
    }
  });
  it("preserva associação canônica exata para as 75 rotas planejadas", () => {
    for (const contest of CONTEST_CATALOG) {
      const product = { slug: contest.slug, opportunityPublicId: "mesma-oportunidade" };
      expect(findExactProductForOpportunityPage([product], inputFor(contest.slug))).toBe(product);
    }
  });
});
