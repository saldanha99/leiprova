import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  type AuthoredQuestion,
  buildProposalPackage,
  parseProposeArgs,
  selectBindableQuestions,
} from "../scripts/propose-product-bindings";

const script = readFileSync(new URL("../scripts/propose-product-bindings.ts", import.meta.url), "utf8");

function row(
  requirementId: number,
  questionPublicId: string,
  legalArticleId: number,
  requirementArticleId: number | null = null,
  coveredArticleIds: number[] = [],
): AuthoredQuestion {
  return {
    requirementId,
    requirementText: "Aplicação da lei penal. 1.1 Princípios.",
    requirementLocator: "Conteúdo programático, p. 64 · NOÇÕES DE DIREITO PENAL · item 1",
    requirementArticleId,
    coveredArticleIds,
    opportunityPublicId: "11111111-1111-4111-8111-111111111111",
    opportunitySlug: "pc-ma-delegado-2026",
    questionPublicId,
    legalArticleId,
    articleRef: "Art. 1º",
    act: "Código Penal",
    literalText: "Art. 1º Não há crime sem lei anterior que o defina. Não há pena sem prévia cominação legal.",
  };
}

describe("propostas de vínculo a partir das inéditas revisadas", () => {
  it("lê só o produto, sem gravar nada", () => {
    expect(parseProposeArgs(["--", "--product=pc-ma-delegado-2026"])).toEqual({ productSlug: "pc-ma-delegado-2026" });
    expect(() => parseProposeArgs([])).toThrow(/--product/u);
    expect(() => parseProposeArgs(["--product=../x"])).toThrow(/--product/u);
    expect(script).toContain("set transaction read only");
    expect(script).toContain("question.editorial_status = 'reviewed'");
    expect(script).toContain("binding.status in ('pending_review', 'approved')");
    expect(script).not.toMatch(/\b(insert into|update |delete from)\b/iu);
  });

  it("leva todos os artigos do item sem mapeamento e só os revisados do item mapeado", () => {
    const selected = selectBindableQuestions([
      row(30, "q-f", 3), row(30, "q-g", 2),
      row(10, "q-c", 7), row(10, "q-a", 5), row(10, "q-b", 5),
      row(20, "q-d", 9, 8), row(20, "q-e", 8, 8), row(20, "q-h", 4, 8, [4]),
    ]);
    expect(selected.map((item) => [item.requirementId, item.questionPublicId])).toEqual([
      [10, "q-a"], [10, "q-b"], [10, "q-c"],
      // Requisito 20 já revisado: artigo 8 (principal) e 4 (adicional); o 9 fica fora.
      [20, "q-e"], [20, "q-h"],
      [30, "q-f"], [30, "q-g"],
    ]);
  });

  it("cita literalmente o requisito e o artigo e passa no contrato do importador", () => {
    const pack = buildProposalPackage("pc-ma-delegado-2026", [row(10, "q-a", 5)]);
    expect(pack.items).toHaveLength(1);
    expect(pack.items[0]).toMatchObject({
      productSlug: "pc-ma-delegado-2026",
      requirementId: 10,
      questionPublicId: "q-a",
      requirementQuote: "Aplicação da lei penal. 1.1 Princípios.",
      legalQuote: "Art. 1º Não há crime sem lei anterior que o defina. Não há pena sem prévia cominação legal.",
    });
    expect(pack.items[0].scopeNotes).toContain("Vínculo pendente de revisão humana");
  });
});
