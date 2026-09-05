import { createHash } from "node:crypto";
import { z } from "zod";

import { getStyleProfileSeed } from "./style-profiles";
import { findMostSimilarQuestion, ORIGINALITY_REJECTION_THRESHOLD_BPS } from "./originality";
import { OFFICIAL_LEGAL_SOURCES } from "../official-sources/legal-registry";

const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(160);
const bank = z.enum(["fgv", "fcc", "vunesp", "cebraspe"]);
const normalize = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const localSourceBundleSchema = z.object({
  schemaVersion: z.literal(1),
  id: identifier,
  title: z.string().min(10).max(300),
  officialUrl: z.string().refine((url) => OFFICIAL_LEGAL_SOURCES.some((source) => source.officialUrl === url),
    "A fonte precisa ser um endereço oficial exato do registro do projeto."),
  retrievedOn: z.iso.date(),
  captureMethod: z.string().min(20).max(1000),
  reviewStatus: z.literal("pending_human_review"),
  scope: z.string().min(30).max(1500),
  articleContext: z.string().min(30).max(5000),
  sources: z.array(z.object({
    id: identifier,
    articleRef: z.string().min(5).max(120),
    text: z.string().min(20).max(12000),
  }).strict()).min(1).max(250),
}).strict().superRefine((bundle, context) => {
  if (new Set(bundle.sources.map((source) => source.id)).size !== bundle.sources.length ||
      new Set(bundle.sources.map((source) => source.articleRef)).size !== bundle.sources.length) {
    context.addIssue({ code: "custom", path: ["sources"], message: "Fontes com identidade duplicada." });
  }
});

export const localAuthoredQuestionSchema = z.object({
  id: identifier,
  sourceId: identifier,
  type: z.enum(["multiple_choice", "true_false"]),
  prompt: z.string().trim().min(30).max(4000),
  explanation: z.string().trim().min(40).max(5000),
  learningObjective: z.string().trim().min(15).max(500),
  difficulty: z.number().int().min(1).max(5),
  supportingQuote: z.string().trim().min(15).max(12000),
  options: z.array(z.object({
    key: z.enum(["A", "B", "C", "D", "E"]),
    text: z.string().trim().min(3).max(2000),
    isCorrect: z.boolean(),
    rationale: z.string().trim().min(15).max(2500),
  }).strict()).min(2).max(5),
}).strict().superRefine((question, context) => {
  const expectedKeys = question.type === "true_false" ? "C,E" : "A,B,C,D,E";
  if (question.options.map((option) => option.key).join(",") !== expectedKeys) {
    context.addIssue({ code: "custom", path: ["options"], message: `Alternativas exigidas: ${expectedKeys}.` });
  }
  if (question.options.filter((option) => option.isCorrect).length !== 1) {
    context.addIssue({ code: "custom", path: ["options"], message: "Exatamente um gabarito é obrigatório." });
  }
  if (new Set(question.options.map((option) => normalize(option.text).toLowerCase())).size !== question.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Alternativas textualmente duplicadas." });
  }
  if (question.type === "true_false" && question.options.map((option) => option.text).join(",") !== "Certo,Errado") {
    context.addIssue({ code: "custom", path: ["options"], message: "Certo/errado exige os dois rótulos padronizados." });
  }
});

export const localAuthoringBatchSchema = z.object({
  schemaVersion: z.literal(1),
  batchId: identifier,
  bankSlug: bank,
  editorialStatus: z.literal("draft"),
  humanReview: z.literal("pending"),
  generator: z.object({
    agentName: z.string().min(2).max(120),
    model: z.string().min(2).max(120),
    runtime: z.enum(["maestri-interactive", "codex-desktop"]),
    generatedOn: z.iso.date(),
  }).strict(),
  questions: z.array(localAuthoredQuestionSchema).min(1).max(250),
}).strict();

export type LocalSourceBundle = z.infer<typeof localSourceBundleSchema>;
export type LocalAuthoringBatch = z.infer<typeof localAuthoringBatchSchema>;
export type LocalAuthoredQuestion = z.infer<typeof localAuthoredQuestionSchema>;

/** Checagens mecânicas: não atestam mérito jurídico, qualidade da banca ou aprovação humana. */
export function validateLocalAuthoring(
  rawSources: unknown,
  rawBatches: readonly unknown[],
  existingCorpus: readonly { publicId: string; prompt: string }[] = [],
) {
  const sources = localSourceBundleSchema.parse(rawSources);
  const batches = rawBatches.map((batch) => localAuthoringBatchSchema.parse(batch));
  const issues: string[] = [];
  const sourceMap = new Map(sources.sources.map((source) => [source.id, source]));
  // Identidade é independente de semelhança: conteúdo diferente não libera um ID já ocupado.
  const questionIds = new Set(existingCorpus.map((question) => question.publicId));
  const batchIds = new Set<string>();
  const seenBanks = new Set<string>();
  const corpus = [...existingCorpus];
  const coverage = new Map<string, number>();
  let maxSimilarityBps = 0;
  const summary = [];
  const qualityWarnings: string[] = [];

  if (!batches.length) issues.push("Nenhum lote fornecido.");
  for (const batch of batches) {
    if (batchIds.has(batch.batchId) || seenBanks.has(batch.bankSlug)) issues.push(`Lote/banca duplicado: ${batch.batchId}.`);
    batchIds.add(batch.batchId);
    seenBanks.add(batch.bankSlug);
    if (batch.batchId !== `${sources.id}-${batch.bankSlug}`) issues.push(`Identidade de lote incompatível: ${batch.batchId}.`);
    const format = getStyleProfileSeed(batch.bankSlug)?.format;
    const sourceIds = new Set<string>();
    const answerCounts: Record<string, number> = Object.fromEntries(
      (format === "true_false" ? ["C", "E"] : ["A", "B", "C", "D", "E"]).map((key) => [key, 0]),
    );
    const answerLengthSignal = { strictlyLongestCorrect: 0, strictlyShortestCorrect: 0, twiceLargestDistractor: 0 };
    for (const question of batch.questions) {
      if (questionIds.has(question.id)) issues.push(`Questão duplicada: ${question.id}.`);
      questionIds.add(question.id);
      if (question.id !== `${question.sourceId}-${batch.bankSlug}-v1`) issues.push(`Identidade incompatível: ${question.id}.`);
      if (sourceIds.has(question.sourceId)) issues.push(`Fonte repetida na mesma banca: ${question.id}.`);
      sourceIds.add(question.sourceId);
      if (question.type !== format) issues.push(`Formato incompatível com a banca: ${question.id}.`);
      const source = sourceMap.get(question.sourceId);
      if (!source) issues.push(`Fonte ausente: ${question.id}.`);
      else if (!normalize(source.text).includes(normalize(question.supportingQuote))) {
        issues.push(`Citação de apoio não consta da fonte: ${question.id}.`);
      }
      const similarity = findMostSimilarQuestion(question.prompt, corpus);
      maxSimilarityBps = Math.max(maxSimilarityBps, similarity.scoreBps);
      if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
        issues.push(`Similaridade excessiva: ${question.id} / ${similarity.referencePublicId}.`);
      }
      corpus.push({ publicId: question.id, prompt: question.prompt });
      coverage.set(question.sourceId, (coverage.get(question.sourceId) ?? 0) + 1);
      const correct = question.options.find((option) => option.isCorrect)!;
      answerCounts[correct.key] = (answerCounts[correct.key] ?? 0) + 1;
      if (question.type === "multiple_choice") {
        const wrongLengths = question.options.filter((option) => !option.isCorrect).map((option) => option.text.length);
        if (correct.text.length > Math.max(...wrongLengths)) answerLengthSignal.strictlyLongestCorrect += 1;
        if (correct.text.length < Math.min(...wrongLengths)) answerLengthSignal.strictlyShortestCorrect += 1;
        if (correct.text.length >= 2 * Math.max(...wrongLengths)) answerLengthSignal.twiceLargestDistractor += 1;
      }
    }
    // Cada rodada cobre seu recorte; ampliação do corpus não se confunde com duplicar o mesmo dispositivo.
    for (const sourceId of sourceMap.keys()) {
      if (!sourceIds.has(sourceId)) issues.push(`Cobertura ausente: ${batch.bankSlug} / ${sourceId}.`);
    }
    const counts = Object.values(answerCounts);
    if (Math.max(...counts) - Math.min(...counts) > 1) issues.push(`Gabaritos desequilibrados: ${batch.bankSlug}.`);
    if (format === "multiple_choice" && Math.max(answerLengthSignal.strictlyLongestCorrect, answerLengthSignal.strictlyShortestCorrect) > batch.questions.length / 2) {
      qualityWarnings.push(`${batch.bankSlug}: comprimento da alternativa correta oferece uma pista em mais da metade do lote; revisão pedagógica necessária.`);
    }
    summary.push({ bank: batch.bankSlug, questions: batch.questions.length, answerCounts, answerLengthSignal, sha256: fingerprint(batch) });
  }
  return {
    valid: issues.length === 0,
    issues,
    qualityWarnings,
    sourceBundleId: sources.id,
    sourcesSha256: fingerprint(sources),
    totalQuestions: batches.reduce((count, batch) => count + batch.questions.length, 0),
    coveredSources: [...coverage.keys()].filter((id) => sourceMap.has(id)).length,
    totalSources: sources.sources.length,
    banks: summary,
    maxSimilarityBps,
    editorialStatus: "draft" as const,
    humanReview: "pending" as const,
    publicationAllowed: false as const,
  };
}
