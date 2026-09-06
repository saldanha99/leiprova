import { createHash } from "node:crypto";
import { z } from "zod";

import { OFFICIAL_LEGAL_SOURCES, isAllowedOfficialLegalTextUrl } from "../official-sources/legal-registry";
import { localAuthoredQuestionSchema } from "./local-authoring";
import { findMostSimilarQuestion, ORIGINALITY_REJECTION_THRESHOLD_BPS } from "./originality";

const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(160);
const normalize = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** O conteúdo editorial é texto: não pode inserir HTML, imagens ou cabeçalhos no caderno. */
export function escapeReviewMarkdownText(text: string) {
  return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")
    .replace(/([\\`*_\[\]{}#|])/gu, "\\$1");
}

/** A origem permitida não prova que o texto foi capturado nem revisado. */
export function isScopedOfficialSourceUrl(value: string) {
  if (value !== value.trim()) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search) return false;
    if (url.hash && !/^#art[\w.-]+$/iu.test(url.hash)) return false;
    url.hash = "";
    if (isAllowedOfficialLegalTextUrl(url.href)) return true;
    // Compilação oficial conferida separadamente; não altera o registro ativo do banco.
    if (["https://www.planalto.gov.br/ccivil_03/constituicao/constituicaocompilado.htm",
      "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105compilada.htm"].includes(url.href)) return true;
    return OFFICIAL_LEGAL_SOURCES.some((source) => {
      const official = new URL(source.officialUrl);
      return official.hostname === url.hostname && official.pathname.toLowerCase() === url.pathname.toLowerCase();
    });
  } catch { return false; }
}

export const authoringTargetSchema = z.object({
  bank: z.enum(["vunesp", "fgv", "fcc", "cebraspe"]),
  role: identifier,
  organization: identifier,
  edition: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{2,79}$/u),
  // Sem produto confirmado, este contrato não permite associação comercial.
  productSlug: z.null(),
}).strict();

export const scopedWorkOrderSchema = z.object({
  schemaVersion: z.literal(1),
  orderId: identifier,
  target: authoringTargetSchema,
  batchFiles: z.array(z.string().regex(/^[a-z0-9-]+\.json$/u)).min(1).max(10),
  minimumQuestions: z.number().int().min(1).max(250),
  format: z.enum(["multiple_choice", "true_false"]),
  purpose: z.literal("current_law_training"),
  programAlignment: z.literal("pending"),
  historicalCutoffCertified: z.literal(false),
  humanReview: z.literal("pending"),
  publicationAllowed: z.literal(false),
}).strict().refine((order) => new Set(order.batchFiles).size === order.batchFiles.length,
  "Arquivo de lote repetido na ordem.");

const scopedSourceSchema = z.object({
  id: identifier,
  officialUrl: z.string().refine(isScopedOfficialSourceUrl, "Origem normativa não permitida."),
  articleRef: z.string().trim().min(3).max(200),
  text: z.string().trim().min(20).max(60_000),
  retrievedOn: z.iso.date(),
  captureMethod: z.string().trim().min(15).max(2000),
}).strict();

export const scopedAuthoringBatchSchema = z.object({
  schemaVersion: z.literal(1),
  batchId: identifier,
  target: authoringTargetSchema,
  status: z.literal("draft"),
  humanReview: z.literal("pending"),
  publicationAllowed: z.literal(false),
  sources: z.array(scopedSourceSchema).min(1).max(250),
  questions: z.array(localAuthoredQuestionSchema.safeExtend({
    demand: z.enum(["literal_law", "applied_law"]),
  })).min(1).max(250),
}).strict();

export type ScopedWorkOrder = z.infer<typeof scopedWorkOrderSchema>;
export type ScopedAuthoringBatch = z.infer<typeof scopedAuthoringBatchSchema>;

function sameTarget(left: z.infer<typeof authoringTargetSchema>, right: z.infer<typeof authoringTargetSchema>) {
  return left.bank === right.bank && left.role === right.role && left.organization === right.organization &&
    left.edition === right.edition && left.productSlug === right.productSlug;
}

/** Valida contrato e pistas mecânicas. Nunca valida mérito, vigência ou aprovação humana. */
export function validateScopedAuthoring(rawOrder: unknown, rawBatches: readonly unknown[],
  existingCorpus: readonly { publicId: string; prompt: string }[] = []) {
  const order = scopedWorkOrderSchema.parse(rawOrder);
  const batches = rawBatches.map((batch) => scopedAuthoringBatchSchema.parse(batch));
  const issues: string[] = [];
  const warnings: string[] = [];
  const batchIds = new Set<string>();
  const questionIds = new Set(existingCorpus.map((item) => item.publicId));
  const corpus = [...existingCorpus];
  const answers: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const demandCounts = { literal_law: 0, applied_law: 0 };
  let longestCorrect = 0;
  let shortestCorrect = 0;
  let maxSimilarityBps = 0;
  const totalQuestions = batches.reduce((sum, batch) => sum + batch.questions.length, 0);
  if (batches.length !== order.batchFiles.length) issues.push("Quantidade de lotes diferente da ordem.");
  if (totalQuestions < order.minimumQuestions || totalQuestions > 250) issues.push("Quantidade de questões fora da ordem autorizada.");
  for (const batch of batches) {
    if (!sameTarget(order.target, batch.target)) issues.push(`Cargo, órgão, banca ou edição divergente: ${batch.batchId}.`);
    if (batchIds.has(batch.batchId)) issues.push(`Lote repetido: ${batch.batchId}.`);
    batchIds.add(batch.batchId);
    const sources = new Map(batch.sources.map((source) => [source.id, source]));
    if (sources.size !== batch.sources.length) issues.push(`Identidade de fonte repetida: ${batch.batchId}.`);
    const usedSources = new Set<string>();
    for (const question of batch.questions) {
      if (questionIds.has(question.id)) issues.push(`Identidade de questão repetida: ${question.id}.`);
      questionIds.add(question.id);
      if (question.type !== order.format) issues.push(`Formato incompatível com a ordem do cargo: ${question.id}.`);
      const source = sources.get(question.sourceId);
      if (!source) issues.push(`Fonte ausente: ${question.id}.`);
      else if (!normalize(source.text).includes(normalize(question.supportingQuote))) {
        issues.push(`Citação não contida na fonte: ${question.id}.`);
      }
      usedSources.add(question.sourceId);
      const nearest = findMostSimilarQuestion(question.prompt, corpus);
      maxSimilarityBps = Math.max(maxSimilarityBps, nearest.scoreBps);
      if (nearest.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
        issues.push(`Enunciado muito semelhante: ${question.id} / ${nearest.referencePublicId}.`);
      }
      corpus.push({ publicId: question.id, prompt: question.prompt });
      demandCounts[question.demand] += 1;
      const correct = question.options.find((option) => option.isCorrect)!;
      answers[correct.key] = (answers[correct.key] ?? 0) + 1;
      if (question.type === "multiple_choice") {
        const lengths = question.options.filter((option) => !option.isCorrect).map((option) => option.text.length);
        longestCorrect += Number(correct.text.length > Math.max(...lengths));
        shortestCorrect += Number(correct.text.length < Math.min(...lengths));
      }
    }
    if (batch.sources.some((source) => !usedSources.has(source.id))) warnings.push(`Há fontes sem questão no lote ${batch.batchId}.`);
  }
  const answerCounts = order.format === "true_false" ? [answers.C ?? 0, answers.E ?? 0] : Object.values(answers);
  if (Math.max(...answerCounts) - Math.min(...answerCounts) > 1) warnings.push("Gabarito desequilibrado; revisar distribuição sem alterar mérito.");
  if (Math.max(longestCorrect, shortestCorrect) > totalQuestions / 2) warnings.push("O tamanho da resposta correta oferece pista em mais da metade do conjunto.");
  return {
    valid: issues.length === 0,
    validationScope: "contract_and_mechanical_checks_only" as const,
    orderId: order.orderId,
    target: order.target,
    totalQuestions,
    minimumQuestions: order.minimumQuestions,
    batches: batches.map((batch) => ({ batchId: batch.batchId, questions: batch.questions.length, sha256: fingerprint(batch) })),
    sources: batches.flatMap((batch) => batch.sources.map((source) => ({ batchId: batch.batchId, sourceId: source.id,
      officialUrl: source.officialUrl, articleRef: source.articleRef, retrievedOn: source.retrievedOn, textSha256: fingerprint(source.text) }))),
    demandCounts, answerCounts: answers, maxSimilarityBps,
    comparisonCorpusSize: existingCorpus.length,
    corpusComparisonPerformed: existingCorpus.length > 0,
    issues, warnings,
    fingerprint: fingerprint({ order, batches, existingCorpus }),
    humanReview: "pending" as const,
    programAlignment: "pending" as const,
    publicationAllowed: false as const,
    databaseImportAllowed: false as const,
    courseBindingsAllowed: false as const,
  };
}
