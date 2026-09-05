import { describe, expect, it } from "vitest";

import { sourceBundle as sources, cebraspeBatch as cebraspe } from "./fixtures/local-authoring";
import { importFingerprint, localQuestionUuid, parseLocalImport, prepareLocalImport, type LocalImportContext } from "@/lib/editorial/local-import-plan";
import { requireLocalImportTarget } from "@/lib/editorial/local-import-target";

function fixture() {
  const bindings = sources.sources.map((source, index) => ({
    sourceId: source.id, legalArticleId: index + 1, legalVersionId: 1,
    versionChecksum: "a".repeat(64), subjectId: 1, topicId: 1,
  }));
  const mapping = { schemaVersion: 1, sourceBundleId: sources.id, bindings };
  const input = parseLocalImport(sources, [cebraspe], mapping);
  const context: LocalImportContext = {
    articles: sources.sources.map((source, index) => ({
      id: index + 1, versionId: 1, versionChecksum: "a".repeat(64), articleRef: source.articleRef,
      literalText: source.text, articleStatus: "reviewed", sourceRights: "official_text",
      versionStatus: "current", sourceUrl: sources.officialUrl, officialUrl: sources.officialUrl,
      actIsActive: true, verifiedAt: new Date("2026-09-05T12:00:00Z"),
    })),
    topics: [{ id: 1, subjectId: 1, name: "Tópico sintético", isActive: true, subjectIsActive: true }],
    banks: [{ id: 1, slug: "cebraspe", isActive: true, profileIsActive: true, format: "true_false", version: 1 }],
  };
  return { input, mapping, context };
}

describe("plano de importação local — sem acesso a banco", () => {
  it("mapeia os 40 itens, preserva proveniência e gera UUIDs estáveis sem aprovar", () => {
    const { input, context } = fixture();
    const plan = prepareLocalImport(input, context);
    expect(plan.totalQuestions).toBe(40);
    expect(plan.publicationAllowed).toBe(false);
    expect(plan.prepared[0].values.authorshipMethod).toBe("ai_assisted");
    expect(plan.prepared[0].receipt.supportingQuote).toBe(cebraspe.questions[0].supportingQuote);
    expect(plan.prepared[0].publicId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    expect(prepareLocalImport(input, context)).toEqual(plan);
  });

  it("identidade não muda com o conteúdo, mas a impressão muda", () => {
    const { input, context } = fixture();
    const first = prepareLocalImport(input, context);
    input.batches[0].questions[0].explanation += " Outra redação editorial.";
    const second = prepareLocalImport(input, context);
    expect(first.prepared[0].publicId).toBe(second.prepared[0].publicId);
    expect(first.fingerprint).not.toBe(second.fingerprint);
    expect(localQuestionUuid("outro-pacote", "item")).not.toBe(localQuestionUuid("pacote", "item"));
  });

  it("recusa mapeamento parcial, repetido ou de outro pacote", () => {
    const { mapping } = fixture();
    expect(() => parseLocalImport(sources, [cebraspe], { ...mapping, bindings: mapping.bindings.slice(1) })).toThrow();
    expect(() => parseLocalImport(sources, [cebraspe], { ...mapping, sourceBundleId: "outro" })).toThrow();
    mapping.bindings[1] = mapping.bindings[0];
    expect(() => parseLocalImport(sources, [cebraspe], mapping)).toThrow();
  });

  it.each([
    ["articleStatus", "pending_review"], ["versionStatus", "revoked"], ["sourceRights", "licensed"],
    ["articleRef", "Artigo de outra norma"], ["literalText", "Texto diferente do recorte oficial"],
    ["versionChecksum", "b".repeat(64)], ["sourceUrl", "https://example.invalid"],
    ["officialUrl", "https://example.invalid"], ["actIsActive", false], ["versionId", 999],
  ] as const)("recusa fonte incompatível no campo %s", (key, value) => {
    const { input, context } = fixture();
    const changed = { ...context, articles: [{ ...context.articles[0], [key]: value }, ...context.articles.slice(1)] };
    expect(() => prepareLocalImport(input, changed)).toThrow("dispositivo exato");
  });

  it("recusa classificação cruzada, catálogo inativo e formato de banca divergente", () => {
    const { input, context } = fixture();
    for (const override of [{ subjectId: 2 }, { isActive: false }, { subjectIsActive: false }]) {
      expect(() => prepareLocalImport(input, { ...context, topics: [{ ...context.topics[0], ...override }] })).toThrow("Matéria/tópico");
    }
    for (const override of [{ isActive: false }, { profileIsActive: false }, { format: "multiple_choice" }]) {
      expect(() => prepareLocalImport(input, { ...context, banks: [{ ...context.banks[0], ...override }] })).toThrow("Perfil de banca");
    }
  });

  it("recusa campos extras de aprovação e fingerprint não determinístico", () => {
    const { mapping } = fixture();
    expect(() => parseLocalImport(sources, [cebraspe], { ...mapping, reviewedByUserId: 1 })).toThrow();
    expect(importFingerprint(mapping)).toBe(importFingerprint(structuredClone(mapping)));
  });

  it("não aceita produção, outro banco/projeto, parâmetros de host nem fallback de conexão", () => {
    expect(requireLocalImportTarget("postgres://qa@127.0.0.1:55439/leiprova_automation_test").database).toBe("leiprova_automation_test");
    expect(requireLocalImportTarget("postgres://editor@127.0.0.1:55440/leiprova_editorial_local").database).toBe("leiprova_editorial_local");
    for (const value of [undefined, "postgres://qa@remote.example:55439/leiprova_automation_test",
      "postgres://qa@127.0.0.1:5432/leiprova_automation_test", "postgres://qa@127.0.0.1:55439/outro-projeto",
      "postgres://qa@127.0.0.1:55439/leiprova_automation_test?host=remote.example", "https://qa@127.0.0.1:55439/leiprova_automation_test"]) {
      expect(() => requireLocalImportTarget(value)).toThrow();
    }
  });
});
