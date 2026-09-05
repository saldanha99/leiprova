import { createHash } from "node:crypto";
import { z } from "zod";

import { localAuthoringBatchSchema, localSourceBundleSchema, validateLocalAuthoring } from "./local-authoring";
import { findMostSimilarQuestion, ORIGINALITY_REJECTION_THRESHOLD_BPS } from "./originality";
import { clauseEquivalenceSchema, verifyOfficialClause } from "./official-clause-equivalence";

export const LOCAL_IMPORT_VERSION = "local-subscription-drafts-v1";
const id = z.number().int().positive().safe();
const bindingSchema = z.object({
  sourceId: z.string().min(1).max(160), legalArticleId: id, legalVersionId: id,
  versionChecksum: z.string().regex(/^[a-f0-9]{64}$/u), subjectId: id, topicId: id,
}).strict();
export const localImportMappingSchema = z.discriminatedUnion("schemaVersion", [z.object({
  schemaVersion: z.literal(1), sourceBundleId: z.string().min(1).max(160),
  bindings: z.array(bindingSchema).min(1).max(250),
}).strict(), z.object({
  schemaVersion: z.literal(2),
  sourceBundleId: z.string().min(1).max(160),
  bindings: z.array(bindingSchema.extend({ equivalence: clauseEquivalenceSchema }).strict()).min(1).max(250),
}).strict()]);

export class LocalImportError extends Error {}
export const importFingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize = (value: string) => value.normalize("NFC").replace(/\s+/gu, " ").trim();

/** UUID v5: a identidade não muda quando alguém altera o conteúdo do mesmo item. */
export function localQuestionUuid(bundleId: string, questionId: string) {
  const namespace = Buffer.from("20ebaf0c8d684685a87ab1e74b05b318", "hex");
  const bytes = createHash("sha1").update(namespace).update(JSON.stringify([LOCAL_IMPORT_VERSION, bundleId, questionId])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function parseLocalImport(rawSources: unknown, rawBatches: readonly unknown[], rawMapping: unknown) {
  const sources = localSourceBundleSchema.parse(rawSources);
  const batches = rawBatches.map((value) => localAuthoringBatchSchema.parse(value));
  const mapping = localImportMappingSchema.parse(rawMapping);
  if (batches.reduce((sum, batch) => sum + batch.questions.length, 0) > 250) {
    throw new LocalImportError("Uma importação comporta no máximo 250 questões.");
  }
  const validation = validateLocalAuthoring(sources, batches);
  if (!validation.valid) throw new LocalImportError("O pacote falhou na validação editorial local.");
  if (mapping.sourceBundleId !== sources.id || mapping.bindings.length !== sources.sources.length ||
      new Set(mapping.bindings.map((binding) => binding.sourceId)).size !== mapping.bindings.length ||
      new Set(mapping.bindings.map((binding) => "equivalence" in binding
        ? `${binding.legalArticleId}:${binding.equivalence.inciso}` : String(binding.legalArticleId))).size !== mapping.bindings.length ||
      sources.sources.some((source) => !mapping.bindings.some((binding) => binding.sourceId === source.id))) {
    throw new LocalImportError("Mapeamento incompleto, duplicado ou pertencente a outro pacote.");
  }
  return { sources, batches, mapping, validation };
}

export type LocalImportInput = ReturnType<typeof parseLocalImport>;
export type LocalImportContext = {
  articles: readonly {
    id: number; versionId: number; versionChecksum: string; articleRef: string; literalText: string;
    articleStatus: string; sourceRights: string; versionStatus: string; sourceUrl: string;
    officialUrl: string; actIsActive: boolean; verifiedAt: Date;
  }[];
  topics: readonly { id: number; subjectId: number; name: string; isActive: boolean; subjectIsActive: boolean }[];
  banks: readonly { id: number; slug: string; isActive: boolean; profileIsActive: boolean; format: string; version: number }[];
};

/** Mapeamento explícito: nunca escolhe artigo por aproximação textual, ano ou banca. */
export function prepareLocalImport(input: LocalImportInput, context: LocalImportContext) {
  const prepared = input.batches.flatMap((batch) => batch.questions.map((question) => {
    const binding = input.mapping.bindings.find((candidate) => candidate.sourceId === question.sourceId)!;
    const source = input.sources.sources.find((candidate) => candidate.id === question.sourceId)!;
    const article = context.articles.find((candidate) => candidate.id === binding.legalArticleId);
    const topic = context.topics.find((candidate) => candidate.id === binding.topicId);
    const bank = context.banks.find((candidate) => candidate.slug === batch.bankSlug);
    if (!article || article.versionId !== binding.legalVersionId || article.versionChecksum !== binding.versionChecksum ||
        article.articleStatus !== "reviewed" || article.sourceRights !== "official_text" ||
        article.versionStatus !== "current" || !article.actIsActive) {
      throw new LocalImportError(`A fonte ${source.id} não corresponde a um dispositivo exato, vigente e revisado no banco.`);
    }
    let sourceEvidence: ReturnType<typeof verifyOfficialClause> | undefined;
    if ("equivalence" in binding) {
      try { sourceEvidence = verifyOfficialClause({ equivalence: clauseEquivalenceSchema.parse(binding.equivalence), source, bundle: input.sources, article }); }
      catch { throw new LocalImportError(`Equivalência oficial inválida para ${source.id}; confira o inciso completo e o caput.`); }
    } else if (article.articleRef !== source.articleRef || normalize(article.literalText) !== normalize(source.text) ||
        article.sourceUrl !== input.sources.officialUrl || article.officialUrl !== input.sources.officialUrl) {
      throw new LocalImportError(`A fonte ${source.id} não corresponde a um dispositivo exato, vigente e revisado no banco.`);
    }
    if (!topic || topic.subjectId !== binding.subjectId || !topic.isActive || !topic.subjectIsActive) {
      throw new LocalImportError(`Matéria/tópico inválido para ${source.id}.`);
    }
    if (!bank || !bank.isActive || !bank.profileIsActive || bank.format !== question.type) {
      throw new LocalImportError(`Perfil de banca indisponível: ${batch.bankSlug}.`);
    }
    const publicId = localQuestionUuid(input.sources.id, question.id);
    const values = {
      publicId, legalArticleId: article.id, subjectId: binding.subjectId, topicId: topic.id,
      quizMode: "original_style", styleBankId: bank.id, examEditionId: null,
      type: question.type, prompt: question.prompt, explanation: question.explanation,
      learningObjective: question.learningObjective, topic: topic.name, difficulty: question.difficulty,
      sourceRights: "original_authorial", sourceTitle: `${input.sources.title} — ${source.articleRef}`,
      sourceUrl: input.sources.officialUrl, authorshipMethod: "ai_assisted",
      generatorModel: batch.generator.model, promptVersion: LOCAL_IMPORT_VERSION, examBoardStyle: batch.bankSlug,
    };
    const options = question.options.map((option, sortOrder) => ({
      optionKey: option.key, text: option.text, isCorrect: option.isCorrect, rationale: option.rationale, sortOrder,
    }));
    const receipt = {
      sourceBundleId: input.sources.id, localQuestionId: question.id, sourceId: source.id,
      sourcesSha256: input.validation.sourcesSha256,
      contentFingerprint: importFingerprint([question, batch.generator, input.validation.sourcesSha256, binding]),
      supportingQuote: question.supportingQuote, generator: batch.generator,
      legalVersionId: article.versionId, versionChecksum: article.versionChecksum,
      profileVersion: bank.version, publicationAllowed: false,
      ...(sourceEvidence ? { sourceEvidence } : {}),
    };
    return { publicId, values, options, receipt, sourceVerifiedAt: article.verifiedAt };
  }));
  return {
    prepared,
    fingerprint: importFingerprint(prepared),
    totalQuestions: prepared.length,
    publicationAllowed: false as const,
  };
}

export function checkImportOriginality(publicId: string, prompt: string, corpus: readonly { publicId: string; prompt: string }[]) {
  const similarity = findMostSimilarQuestion(prompt, corpus.filter((item) => item.publicId !== publicId));
  if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
    throw new LocalImportError("Há um enunciado muito semelhante no acervo. Nenhuma questão foi importada.");
  }
  return similarity;
}
