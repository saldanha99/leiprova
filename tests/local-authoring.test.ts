import { describe, expect, it } from "vitest";

import { sourceBundle, cebraspeBatch } from "./fixtures/local-authoring";
import {
  localAuthoringBatchSchema, localSourceBundleSchema, validateLocalAuthoring,
} from "@/lib/editorial/local-authoring";

function fixture() {
  return {
    sources: { ...structuredClone(sourceBundle), sources: [structuredClone(sourceBundle.sources[0])] },
    batch: { ...structuredClone(cebraspeBatch), questions: [structuredClone(cebraspeBatch.questions[0])] },
  };
}

describe("autoria local pelas assinaturas — contrato de rascunhos", () => {
  it("valida o lote C/E completo, equilibrado, sem aprovar nem publicar", () => {
    const result = validateLocalAuthoring(sourceBundle, [cebraspeBatch]);
    expect(result.issues).toEqual([]);
    expect(result.totalQuestions).toBe(40);
    expect(result.coveredSources).toBe(40);
    expect(result.banks[0].answerCounts).toEqual({ C: 20, E: 20 });
    expect(result.publicationAllowed).toBe(false);
    expect(result.humanReview).toBe("pending");
    expect(result.editorialStatus).toBe("draft");
  });

  it("gera impressões estáveis e detecta alteração no dossiê", () => {
    const { sources, batch } = fixture();
    const first = validateLocalAuthoring(sources, [batch]);
    expect(validateLocalAuthoring(sources, [batch])).toEqual(first);
    batch.questions[0].explanation += " Texto adicional para revisão.";
    expect(validateLocalAuthoring(sources, [batch]).banks[0].sha256).not.toBe(first.banks[0].sha256);
    sources.sources[0].text += " Mudança fictícia.";
    expect(validateLocalAuthoring(sources, [batch]).sourcesSha256).not.toBe(first.sourcesSha256);
  });

  it("recusa promoção de estado e declarações humanas injetadas no JSON", () => {
    expect(localAuthoringBatchSchema.safeParse({ ...cebraspeBatch, editorialStatus: "reviewed" }).success).toBe(false);
    expect(localAuthoringBatchSchema.safeParse({ ...cebraspeBatch, humanReview: "approved" }).success).toBe(false);
    expect(localAuthoringBatchSchema.safeParse({ ...cebraspeBatch, reviewedByUserId: 1 }).success).toBe(false);
    expect(localSourceBundleSchema.safeParse({ ...sourceBundle, reviewStatus: "reviewed" }).success).toBe(false);
  });

  it("recusa campos extras de ferramentas/credenciais", () => {
    const { batch } = fixture();
    expect(localAuthoringBatchSchema.safeParse({ ...batch, apiKey: "segredo-ficticio" }).success).toBe(false);
    expect(localAuthoringBatchSchema.safeParse({ ...batch, questions: [{ ...batch.questions[0], command: "nao-executar" }] }).success).toBe(false);
  });

  it("só admite a URL oficial exata, sem redirecionador ou domínio parecido", () => {
    for (const url of ["https://www.planalto.gov.br.evil.invalid/", sourceBundle.officialUrl + "?redirect=evil", "http://127.0.0.1/"]) {
      expect(localSourceBundleSchema.safeParse({ ...sourceBundle, officialUrl: url }).success).toBe(false);
    }
  });

  it("recusa fontes duplicadas", () => {
    const { sources } = fixture();
    sources.sources.push(sources.sources[0]);
    expect(localSourceBundleSchema.safeParse(sources).success).toBe(false);
  });

  it("recusa dois gabaritos e alternativas sem justificativa específica", () => {
    const { batch } = fixture();
    batch.questions[0].options.forEach((option) => { option.isCorrect = true; });
    expect(localAuthoringBatchSchema.safeParse(batch).success).toBe(false);
    batch.questions[0].options[0].isCorrect = false;
    batch.questions[0].options[0].rationale = "errado";
    expect(localAuthoringBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("recusa rótulos C/E invertidos e alternativas duplicadas", () => {
    const { batch } = fixture();
    batch.questions[0].options[0].text = "Errado";
    expect(localAuthoringBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("recusa fonte inexistente, citação inventada e identidade divergente", () => {
    const { sources, batch } = fixture();
    batch.questions[0].supportingQuote = "Esta frase não se encontra no dispositivo oficial selecionado.";
    expect(validateLocalAuthoring(sources, [batch]).issues.some((issue) => issue.includes("Citação"))).toBe(true);
    batch.questions[0].sourceId = "fonte-inexistente";
    const result = validateLocalAuthoring(sources, [batch]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes("Fonte ausente"))).toBe(true);
    expect(result.issues.some((issue) => issue.includes("Identidade incompatível"))).toBe(true);
  });

  it("recusa pacote incompleto e repetição de banca", () => {
    const { batch } = fixture();
    expect(validateLocalAuthoring(sourceBundle, [batch]).valid).toBe(false);
    expect(validateLocalAuthoring(sourceBundle, [cebraspeBatch, cebraspeBatch]).valid).toBe(false);
    expect(validateLocalAuthoring(sourceBundle, []).valid).toBe(false);
  });

  it("recusa formato que contradiz o perfil de banca", () => {
    const { sources, batch } = fixture();
    batch.bankSlug = "fgv";
    batch.batchId = `${sources.id}-fgv`;
    batch.questions[0].id = `${batch.questions[0].sourceId}-fgv-v1`;
    expect(validateLocalAuthoring(sources, [batch]).issues.some((issue) => issue.includes("Formato"))).toBe(true);
  });

  it("recusa gabaritos concentrados em uma única opção", () => {
    const batch = structuredClone(cebraspeBatch);
    batch.questions.forEach((question) => question.options.forEach((option) => { option.isCorrect = option.key === "C"; }));
    expect(validateLocalAuthoring(sourceBundle, [batch]).issues.some((issue) => issue.includes("desequilibrados"))).toBe(true);
  });

  it("detecta cópia textual em corpus autoral anterior", () => {
    const { sources, batch } = fixture();
    const result = validateLocalAuthoring(sources, [batch], [{ publicId: "anterior", prompt: batch.questions[0].prompt }]);
    expect(result.maxSimilarityBps).toBe(10000);
    expect(result.issues.some((issue) => issue.includes("Similaridade excessiva"))).toBe(true);
  });

  it("recusa ID do acervo mesmo quando o novo enunciado é diferente", () => {
    const { sources, batch } = fixture();
    const result = validateLocalAuthoring(sources, [batch], [{
      publicId: batch.questions[0].id, prompt: "Texto sintético independente sobre geometria e astronomia.",
    }]);
    expect(result.maxSimilarityBps).toBeLessThan(8500);
    expect(result.issues).toContain(`Questão duplicada: ${batch.questions[0].id}.`);
  });

  it("sinaliza pistas pelo comprimento sem confundir qualidade com aprovação", () => {
    const { sources, batch } = fixture();
    for (const correctIsLongest of [true, false]) {
      const result = validateLocalAuthoring(sources, [{
        ...batch,
        bankSlug: "fgv",
        batchId: `${sources.id}-fgv`,
        questions: [{
          ...batch.questions[0],
          id: `${batch.questions[0].sourceId}-fgv-v1`,
          type: "multiple_choice",
          options: ["A", "B", "C", "D", "E"].map((key) => ({
            key,
            text: key === "A"
              ? (correctIsLongest ? "Alternativa sintética correta deliberadamente muito mais extensa que todas as demais opções." : "Sim")
              : `Alternativa sintética ${key}.`,
            isCorrect: key === "A",
            rationale: "Justificativa sintética suficiente para testar somente o contrato estrutural.",
          })),
        }],
      }]);
      expect(result.valid).toBe(true);
      expect(result.qualityWarnings).toHaveLength(1);
      expect(result.banks[0].answerLengthSignal).toEqual({
        strictlyLongestCorrect: correctIsLongest ? 1 : 0,
        strictlyShortestCorrect: correctIsLongest ? 0 : 1,
        twiceLargestDistractor: correctIsLongest ? 1 : 0,
      });
      expect(result.publicationAllowed).toBe(false);
      expect(result.humanReview).toBe("pending");
    }
  });
});
