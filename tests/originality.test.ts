import { describe, expect, it } from "vitest";

import { findMostSimilarQuestion, textualSimilarityBps } from "@/lib/editorial/originality";

describe("controle de originalidade", () => {
  it("considera texto equivalente mesmo com acentos e pontuação diferentes", () => {
    expect(textualSimilarityBps("A administração pública é direta.", "A ADMINISTRACAO PUBLICA e direta")).toBe(10_000);
  });

  it("encontra a questão interna mais próxima", () => {
    const result = findMostSimilarQuestion("Nos termos da lei, assinale a alternativa correta", [
      { publicId: "a", prompt: "Qual é o prazo previsto?" },
      { publicId: "b", prompt: "Nos termos da lei assinale a alternativa incorreta" },
    ]);
    expect(result.referencePublicId).toBe("b");
    expect(result.scoreBps).toBeGreaterThan(0);
  });
});
