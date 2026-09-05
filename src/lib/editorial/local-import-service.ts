import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema";
import { lockApprovalScope, type ApprovalExecutor } from "./approval-lock";
import {
  checkImportOriginality, importFingerprint, LocalImportError, localQuestionUuid,
  parseLocalImport, prepareLocalImport, type LocalImportInput,
} from "./local-import-plan";

const IMPORT_ACTION = "editorial.local_draft.imported";
type Db = PostgresJsDatabase<typeof schema>;

export async function readLocalImportContext(transaction: ApprovalExecutor, input: LocalImportInput) {
  const articles = await transaction.select({
    id: schema.legalArticles.id, versionId: schema.legalVersions.id, versionChecksum: schema.legalVersions.checksumSha256,
    articleRef: schema.legalArticles.articleRef, literalText: schema.legalArticles.literalText,
    articleStatus: schema.legalArticles.editorialStatus, sourceRights: schema.legalArticles.sourceRights,
    versionStatus: schema.legalVersions.status, sourceUrl: schema.legalVersions.sourceUrl,
    officialUrl: schema.legalActs.officialUrl, actIsActive: schema.legalActs.isActive, verifiedAt: schema.legalVersions.verifiedAt,
  }).from(schema.legalArticles)
    .innerJoin(schema.legalVersions, eq(schema.legalArticles.legalVersionId, schema.legalVersions.id))
    .innerJoin(schema.legalActs, eq(schema.legalVersions.legalActId, schema.legalActs.id))
    .where(inArray(schema.legalArticles.id, input.mapping.bindings.map((binding) => binding.legalArticleId)));
  const topics = await transaction.select({
    id: schema.quizTopics.id, subjectId: schema.quizTopics.subjectId, name: schema.quizTopics.name,
    isActive: schema.quizTopics.isActive, subjectIsActive: schema.quizSubjects.isActive,
  }).from(schema.quizTopics).innerJoin(schema.quizSubjects, eq(schema.quizTopics.subjectId, schema.quizSubjects.id))
    .where(inArray(schema.quizTopics.id, input.mapping.bindings.map((binding) => binding.topicId)));
  const banks = await transaction.select({
    id: schema.quizBanks.id, slug: schema.quizBanks.slug, isActive: schema.quizBanks.isActive,
    profileIsActive: schema.questionStyleProfiles.isActive, format: schema.questionStyleProfiles.format,
    version: schema.questionStyleProfiles.version,
  }).from(schema.quizBanks).innerJoin(schema.questionStyleProfiles, eq(schema.questionStyleProfiles.quizBankId, schema.quizBanks.id))
    .where(inArray(schema.quizBanks.slug, input.batches.map((batch) => batch.bankSlug)));
  return { articles, topics, banks };
}

async function actor(transaction: ApprovalExecutor, publicId: string) {
  const [user] = await transaction.select({ id: schema.users.id, role: schema.users.role }).from(schema.users)
    .where(eq(schema.users.publicId, publicId)).limit(1);
  if (!user || !["admin", "editor"].includes(user.role)) throw new LocalImportError("Operador editorial não encontrado ou sem papel autorizado.");
  return user.id;
}

export async function readLocalImportCorpus(transaction: ApprovalExecutor) {
  const corpus = await transaction.select({ publicId: schema.questions.publicId, prompt: schema.questions.prompt })
    // Uma cópia de questão licenciada também não pode entrar como criação autoral.
    .from(schema.questions).limit(10001);
  if (corpus.length > 10000) throw new LocalImportError("O acervo excede o limite deste importador. Amplie a estratégia de similaridade antes de importar.");
  return corpus;
}

export async function checkExistingLocalImport(transaction: ApprovalExecutor, item: ReturnType<typeof prepareLocalImport>["prepared"][number]) {
  const [existing] = await transaction.select().from(schema.questions).where(eq(schema.questions.publicId, item.publicId));
  if (!existing) return null;
  const options = await transaction.select({
    optionKey: schema.questionOptions.optionKey, text: schema.questionOptions.text, isCorrect: schema.questionOptions.isCorrect,
    rationale: schema.questionOptions.rationale, sortOrder: schema.questionOptions.sortOrder,
  }).from(schema.questionOptions).where(eq(schema.questionOptions.questionId, existing.id)).orderBy(asc(schema.questionOptions.sortOrder));
  const receipts = await transaction.select({ metadata: schema.auditLogs.metadata }).from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.action, IMPORT_ACTION), eq(schema.auditLogs.entityType, "question"), eq(schema.auditLogs.entityId, item.publicId)));
  const sameValues = Object.entries(item.values).every(([key, value]) => existing[key as keyof typeof existing] === value);
  if (!sameValues || importFingerprint(options) !== importFingerprint(item.options) || receipts.length !== 1 ||
      receipts[0].metadata.contentFingerprint !== item.receipt.contentFingerprint) {
    throw new LocalImportError(`Conflito de identidade/conteúdo em ${item.publicId}. O item existente foi preservado.`);
  }
  // Uma reexecução não reabre, aprova nem rebaixa o item que já passou pelo fluxo humano.
  return existing.id;
}

/** CLI/serviço interno: as credenciais do banco pertencem ao operador, nunca ao pacote. */
export async function importLocalDrafts(db: Db, request: {
  sources: unknown; batches: readonly unknown[]; mapping: unknown; actorPublicId: string;
  mode: "preview" | "apply"; expectedFingerprint?: string;
}) {
  if (request.mode !== "preview" && request.mode !== "apply") throw new LocalImportError("Modo de importação inválido.");
  if (request.mode === "apply" && !/^[a-f0-9]{64}$/u.test(request.expectedFingerprint ?? "")) {
    throw new LocalImportError("Confira a simulação e informe sua impressão digital antes de aplicar.");
  }
  const input = parseLocalImport(request.sources, request.batches, request.mapping);
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`set local statement_timeout = '30s'`);
    await transaction.execute(sql`set local lock_timeout = '5s'`);
    if (request.mode === "apply") {
      // Serializa somente estes importadores; outros canais fazem sua própria revisão de similaridade.
      await transaction.execute(sql`select pg_advisory_xact_lock(1279873106, 1)`);
      const ids = input.batches.flatMap((batch) => batch.questions.map((question) => localQuestionUuid(input.sources.id, question.id)));
      const existing = await transaction.select({ id: schema.questions.id }).from(schema.questions).where(inArray(schema.questions.publicId, ids));
      await lockApprovalScope(transaction, { questionIds: existing.map((item) => item.id), legalArticleIds: [], styleBankIds: [] });
    }
    const actorUserId = await actor(transaction, request.actorPublicId);
    const plan = prepareLocalImport(input, await readLocalImportContext(transaction, input));
    if (request.mode === "apply" && plan.fingerprint !== request.expectedFingerprint) {
      throw new LocalImportError("O pacote ou seu contexto mudou depois da simulação. Confira novamente.");
    }
    const corpus = await readLocalImportCorpus(transaction);
    let created = 0;
    let reused = 0;
    const insertedIds: number[] = [];
    const now = new Date();
    for (const item of plan.prepared) {
      const existingId = await checkExistingLocalImport(transaction, item);
      const similarity = checkImportOriginality(item.publicId, item.values.prompt, corpus);
      if (existingId !== null) { reused += 1; continue; }
      corpus.push({ publicId: item.publicId, prompt: item.values.prompt });
      created += 1;
      if (request.mode === "preview") continue;
      const [question] = await transaction.insert(schema.questions).values({
        ...item.values, editorialStatus: "draft", createdByUserId: null, reviewedByUserId: null,
        cleanRoomAttestedAt: null, submittedAt: null, reviewNotes: null,
        similarityMaxBps: similarity.scoreBps, similarityReferencePublicId: similarity.referencePublicId,
        originalityCheckedAt: now, verifiedAt: item.sourceVerifiedAt,
      }).returning({ id: schema.questions.id });
      insertedIds.push(question.id);
      await transaction.insert(schema.questionOptions).values(item.options.map((option) => ({ ...option, questionId: question.id })));
      await transaction.insert(schema.auditLogs).values({
        actorUserId, action: IMPORT_ACTION, entityType: "question", entityId: item.publicId, metadata: item.receipt,
      });
    }
    if (request.mode === "apply") {
      // Revalida fontes/perfis sob os mesmos locks usados pelo fluxo humano. Qualquer falha desfaz o lote inteiro.
      await lockApprovalScope(transaction, { questionIds: insertedIds, legalArticleIds: [], styleBankIds: [] });
      const finalPlan = prepareLocalImport(input, await readLocalImportContext(transaction, input));
      if (finalPlan.fingerprint !== plan.fingerprint) throw new LocalImportError("O contexto editorial mudou durante a importação.");
      await actor(transaction, request.actorPublicId);
    }
    return { mode: request.mode, fingerprint: plan.fingerprint, totalQuestions: plan.totalQuestions,
      created: request.mode === "apply" ? created : 0, wouldCreate: created, reused, publicationAllowed: false as const };
  }, request.mode === "preview" ? { accessMode: "read only", isolationLevel: "repeatable read" } : undefined);
}
