import { describe, expect, it } from "vitest";

import { existsSync, readFileSync } from "node:fs";
import { localAuthoringBatchSchema, localSourceBundleSchema, validateLocalAuthoring } from "@/lib/editorial/local-authoring";
import { PILOT_ORIGINAL_QUESTIONS } from "@/lib/editorial/pilot-questions";
import { DEMO_QUESTIONS } from "@/lib/demo-content";
import articleFixture from "./fixtures/cf88-art5-senado.json";
import { parseLocalImport, prepareLocalImport } from "@/lib/editorial/local-import-plan";

const directory = new URL("../content/editorial/cf-direitos-fundamentais-2026-09-05/", import.meta.url);
const files = ["claude-fgv.json", "prism-fcc.json", "radar-vunesp.json", "forge-cebraspe.json"];
const available = ["sources.json", ...files].every((file) => existsSync(new URL(file, directory)));
const sources = available ? localSourceBundleSchema.parse(JSON.parse(readFileSync(new URL("sources.json", directory), "utf8"))) : null;
const batches = available ? files.map((file) => localAuthoringBatchSchema.parse(JSON.parse(readFileSync(new URL(file, directory), "utf8")))) : [];
const vunesp = batches.find((batch) => batch.bankSlug === "vunesp");

describe.skipIf(!available)("pacote editorial privado — regressão mecânica, não revisão jurídica", () => {
  it("compatibiliza 40 incisos completos e caput com o artigo oficial integral, sem alterar o pacote", () => {
    const mapping = { schemaVersion: 2, sourceBundleId: sources!.id, bindings: sources!.sources.map((source) => ({
      sourceId: source.id, legalArticleId: 1, legalVersionId: 1, versionChecksum: "a".repeat(64), subjectId: 1, topicId: 1,
      equivalence: { strategy: "cf88-art5-inciso-v1", parentArticleRef: "Art. 5º", inciso: source.articleRef.split(", ")[1],
        targetSourceUrl: articleFixture.sourceUrl, parentTextSha256: articleFixture.parentTextSha256 },
    })) };
    const context = {
      articles: [{ id: 1, versionId: 1, versionChecksum: "a".repeat(64), articleRef: "Art. 5º", literalText: articleFixture.literalText,
        articleStatus: "reviewed", sourceRights: "official_text", versionStatus: "current", sourceUrl: articleFixture.sourceUrl,
        officialUrl: sources!.officialUrl, actIsActive: true, verifiedAt: new Date("2026-09-05T12:00:00Z") }],
      topics: [{ id: 1, subjectId: 1, name: "Direitos e garantias fundamentais", isActive: true, subjectIsActive: true }],
      banks: batches.map((batch, index) => ({ id: index + 1, slug: batch.bankSlug, isActive: true, profileIsActive: true, format: batch.questions[0].type, version: 1 })),
    };
    const plan = prepareLocalImport(parseLocalImport(sources, batches, mapping), context);
    expect(plan.totalQuestions).toBe(160);
    expect(new Set(plan.prepared.filter((item) => item.receipt.sourceEvidence?.typographicVariant).map((item) => item.receipt.sourceId)).size).toBe(3);
    expect(plan.prepared.every((item) => item.receipt.sourceEvidence?.targetClauseText)).toBe(true);
    mapping.bindings[1].equivalence.inciso = mapping.bindings[0].equivalence.inciso;
    expect(() => parseLocalImport(sources, batches, mapping)).toThrow("duplicado");
  });
  it.each(["fgv", "fcc", "vunesp", "cebraspe"])("valida as 40 questões do perfil %s", (bank) => {
    const batch = batches.find((candidate) => candidate.bankSlug === bank)!;
    const result = validateLocalAuthoring(sources, [batch]);
    expect(result.issues).toEqual([]);
    expect(result.totalQuestions).toBe(40);
    expect(result.coveredSources).toBe(40);
    expect(result.publicationAllowed).toBe(false);
  });

  it("mantém 160 identidades e citações válidas, sem duplicatas no corpus autoral em arquivos", () => {
    const result = validateLocalAuthoring(sources, batches, [
      ...PILOT_ORIGINAL_QUESTIONS,
      ...DEMO_QUESTIONS.map((question) => ({ publicId: question.slug, prompt: question.prompt })),
    ]);
    expect(result.issues).toEqual([]);
    expect(result.totalQuestions).toBe(160);
    expect(result.banks).toHaveLength(4);
    expect(result.maxSimilarityBps).toBeLessThan(8500);
    expect(result.humanReview).toBe("pending");
  });

  it("preserva a correção de escopo sobre coisa julgada e competência para indulto", () => {
    const retroactivity = vunesp!.questions.find((question) => question.id === "cf5-xl-vunesp-v1")!;
    const racism = vunesp!.questions.find((question) => question.id === "cf5-xlii-vunesp-v1")!;
    expect(JSON.stringify(retroactivity)).not.toMatch(/transitad|julgados definitivamente/iu);
    expect(JSON.stringify(racism)).not.toMatch(/indulto|Chefe do Executivo estadual|graça/iu);
  });
});
