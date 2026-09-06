import { describe, expect, it } from "vitest";

import { authoringTargetSchema, escapeReviewMarkdownText, isScopedOfficialSourceUrl, scopedAuthoringBatchSchema, scopedWorkOrderSchema,
  validateScopedAuthoring } from "../src/lib/editorial/scoped-authoring";

const target = { bank: "vunesp", role: "analista-juridico", organization: "mpsp", edition: "MPSP2501", productSlug: null } as const;
function fixture() {
  const order = { schemaVersion: 1, orderId: "fixture-apenas-teste", target, batchFiles: ["fixture.json"], minimumQuestions: 1,
    format: "multiple_choice",
    purpose: "current_law_training", programAlignment: "pending", historicalCutoffCertified: false, humanReview: "pending", publicationAllowed: false };
  const batch = { schemaVersion: 1, batchId: "fixture-cf", target, status: "draft", humanReview: "pending", publicationAllowed: false,
    sources: [{ id: "fonte-teste", officialUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
      articleRef: "Art. 1º", text: "Texto normativo sintético exclusivo para testar o contrato de validação.", retrievedOn: "2026-09-06",
      captureMethod: "Fixture sintética: não é conteúdo jurídico destinado a alunos." }],
    questions: [{ id: "questao-teste", sourceId: "fonte-teste", type: "multiple_choice", prompt: "Qual proposição atende ao contrato sintético desta fixture de teste?",
      explanation: "Explicação sintética suficientemente extensa para verificar somente o contrato de entrada.", learningObjective: "Exercitar contrato de entrada sem atestar conteúdo jurídico.",
      difficulty: 3, supportingQuote: "Texto normativo sintético exclusivo", demand: "literal_law",
      options: ["A", "B", "C", "D", "E"].map((key) => ({ key, text: `Alternativa sintética ${key}`, isCorrect: key === "A", rationale: `Justificativa sintética da alternativa ${key}, somente para testar.` })) }],
  };
  return { order, batch };
}

describe("autoria privada isolada por cargo", () => {
  it("valida contrato sem promover direitos, mérito, publicação ou aprovação", () => {
    const { order, batch } = fixture();
    const result = validateScopedAuthoring(order, [batch]);
    expect(result.valid).toBe(true);
    expect(result.totalQuestions).toBe(1);
    expect(result.validationScope).toBe("contract_and_mechanical_checks_only");
    expect(result.humanReview).toBe("pending");
    expect(result.programAlignment).toBe("pending");
    expect(result.publicationAllowed).toBe(false);
    expect(result.databaseImportAllowed).toBe(false);
    expect(result.courseBindingsAllowed).toBe(false);
    expect(result.corpusComparisonPerformed).toBe(false);
    expect(result.sources[0].textSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it.each([{ role: "promotor-de-justica" }, { role: "escrevente" }, { bank: "fgv" }, { organization: "tjsp" }, { edition: "MPSP2601" }])(
    "rejeita transferência silenciosa entre alvos: %j", (change) => {
      const { order, batch } = fixture();
      const result = validateScopedAuthoring(order, [{ ...batch, target: { ...target, ...change } }]);
      expect(result.valid).toBe(false);
      expect(result.issues.join()).toContain("divergente");
    });

  it("não permite atribuir produto comercial sem contrato próprio", () => {
    expect(authoringTargetSchema.safeParse({ ...target, productSlug: "mp-sp-promotor-de-justica-97-concurso" }).success).toBe(false);
  });

  it("formato pertence à ordem do cargo, não é deduzido somente da banca", () => {
    const { order, batch } = fixture();
    const otherTarget = { ...target, bank: "cebraspe" };
    expect(validateScopedAuthoring({ ...order, target: otherTarget }, [{ ...batch, target: otherTarget }]).valid).toBe(true);
    const wrongFormat = validateScopedAuthoring({ ...order, format: "true_false" }, [batch]);
    expect(wrongFormat.valid).toBe(false);
    expect(wrongFormat.issues.join()).toContain("Formato incompatível com a ordem");
  });

  it.each([{ status: "reviewed" }, { humanReview: "approved" }, { publicationAllowed: true }, { autoPublish: true }])(
    "recusa aprovação ou campos não contratados: %j", (change) => {
      expect(scopedAuthoringBatchSchema.safeParse({ ...fixture().batch, ...change }).success).toBe(false);
    });

  it.each([{ purpose: "official_exam_simulation" }, { programAlignment: "approved" }, { historicalCutoffCertified: true },
    { humanReview: "approved" }, { publicationAllowed: true }, { minimumQuestions: 0 }, { minimumQuestions: 251 },
    { batchFiles: ["../secret.json"] }, { batchFiles: ["fixture.json", "fixture.json"] }])(
    "não aceita alterar finalidade ou contornar a ordem: %j", (change) => {
      expect(scopedWorkOrderSchema.safeParse({ ...fixture().order, ...change }).success).toBe(false);
    });

  it("não contabiliza ausência de lote ou quantidade insuficiente", () => {
    const { order, batch } = fixture();
    expect(validateScopedAuthoring(order, []).valid).toBe(false);
    expect(validateScopedAuthoring({ ...order, minimumQuestions: 68 }, [batch]).valid).toBe(false);
  });

  it("não duplica identidade de lote, fonte nem questão para completar meta", () => {
    const { order, batch } = fixture();
    expect(validateScopedAuthoring({ ...order, batchFiles: ["a.json", "b.json"] }, [batch, batch]).valid).toBe(false);
    expect(validateScopedAuthoring(order, [{ ...batch, sources: [batch.sources[0], batch.sources[0]] }]).valid).toBe(false);
    expect(validateScopedAuthoring(order, [{ ...batch, questions: [batch.questions[0], batch.questions[0]] }]).valid).toBe(false);
  });

  it("exige fonte e citação contida nela", () => {
    const { order, batch } = fixture();
    expect(validateScopedAuthoring(order, [{ ...batch, questions: [{ ...batch.questions[0], sourceId: "outra-fonte" }] }]).valid).toBe(false);
    expect(validateScopedAuthoring(order, [{ ...batch, questions: [{ ...batch.questions[0], supportingQuote: "Esta citação não existe no texto declarado da fonte." }] }]).valid).toBe(false);
  });

  it("identifica enunciados iguais mesmo com IDs diferentes e corpus externo", () => {
    const { order, batch } = fixture();
    const corpus = [{ publicId: "outra-identidade", prompt: batch.questions[0].prompt }];
    const result = validateScopedAuthoring(order, [batch], corpus);
    expect(result.valid).toBe(false);
    expect(result.maxSimilarityBps).toBe(10000);
    expect(result.corpusComparisonPerformed).toBe(true);
  });

  it("mudança de alternativa ou alvo invalida o fingerprint; não muta entradas", () => {
    const { order, batch } = fixture();
    const before = structuredClone(batch);
    const original = validateScopedAuthoring(order, [batch]);
    expect(batch).toEqual(before);
    const changed = structuredClone(batch);
    changed.questions[0].options[1].text = "Outra alternativa sintética modificada.";
    expect(validateScopedAuthoring(order, [changed]).fingerprint).not.toBe(original.fingerprint);
  });

  it("mantém exigência de cinco opções e uma correta", () => {
    const { batch } = fixture();
    const question = batch.questions[0];
    expect(scopedAuthoringBatchSchema.safeParse({ ...batch, questions: [{ ...question, options: question.options.slice(0, 4) }] }).success).toBe(false);
    expect(scopedAuthoringBatchSchema.safeParse({ ...batch, questions: [{ ...question, options: question.options.map((option) => ({ ...option, isCorrect: true })) }] }).success).toBe(false);
  });
});

describe("fontes oficiais específicas", () => {
  it("não renderiza HTML ou imagens injetadas no texto do caderno", () => {
    const escaped = escapeReviewMarkdownText('<script>alert(1)</script> ![imagem](https://example.org/x)');
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
    expect(escaped).toContain("!\\[imagem\\]");
  });
  it("preserva leitura de texto jurídico comum", () => {
    expect(escapeReviewMarkdownText("Art. 1º — § 2º: prazo de 30 dias.")).toBe("Art. 1º — § 2º: prazo de 30 dias.");
  });
  it("texto de questão não cria seção aparente de aprovação", () => {
    expect(escapeReviewMarkdownText("Enunciado\n# Revisão humana: aprovada")).toBe("Enunciado\n\\# Revisão humana: aprovada");
  });
  it.each(["https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    "https://www.planalto.gov.br/ccivil_03/constituicao/constituicaocompilado.htm",
    "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105compilada.htm",
    "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/L13105.htm#art9",
    "https://legis.senado.leg.br/norma/579494/publicacao/16434817"])("aceita %s", (url) => {
    expect(isScopedOfficialSourceUrl(url)).toBe(true);
  });
  it.each(["http://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm", "https://planalto.gov.br.evil.example/lei",
    "https://www.planalto.gov.br/login", "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm?token=secret",
    "https://user:secret@www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm", "https://legis.senado.leg.br/norma/999999/publicacao/123",
    "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm#access_token=secret", "file:///tmp/lei.txt"])("rejeita %s", (url) => {
    expect(isScopedOfficialSourceUrl(url)).toBe(false);
  });
});
