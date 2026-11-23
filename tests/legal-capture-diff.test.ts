import { describe, expect, it } from "vitest";
import { legalCaptureDiff } from "@/lib/editorial/agent-work-preparation";

describe("diff de fotografias legais para o Guardião offline", () => {
  it("lista só parágrafos removidos e acrescentados, respeitando repetições", () => {
    const diff = legalCaptureDiff("Art. 1º A.\nArt. 2º B.\nParágrafo único.\nParágrafo único.", "Art. 1º A.\nArt. 2º B (nova redação).\nParágrafo único.\nArt. 2º-A Acrescido.");
    expect(diff.removed).toEqual(["Art. 2º B.", "Parágrafo único."]);
    expect(diff.added).toEqual(["Art. 2º B (nova redação).", "Art. 2º-A Acrescido."]);
    expect(diff.truncated).toBe(false);
  });
  it("ignora diferença só de espaços e marca truncamento no limite", () => {
    expect(legalCaptureDiff("Art. 1º  A.", "Art. 1º A.").added).toEqual([]);
    const big = legalCaptureDiff("", Array.from({ length: 50 }, (_, i) => `Art. ${i} ${"x".repeat(100)}`).join("\n"), 1_000);
    expect(big.truncated).toBe(true);
    expect(big.addedTotal).toBe(50);
    expect(big.added.join("").length).toBeLessThanOrEqual(1_000);
  });
});
