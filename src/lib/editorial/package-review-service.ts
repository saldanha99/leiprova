import { and, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";

import * as schema from "../db/schema";
import { evaluateOriginalQuestionApproval } from "./approval-eligibility";
import { currentLegalSourceExists, lockApprovalScope } from "./approval-lock";
import { buildDossierFingerprint } from "./dossier-fingerprint";
import { checkImportOriginality, importFingerprint, LocalImportError, localQuestionUuid, parseLocalImport, prepareLocalImport } from "./local-import-plan";
import { checkExistingLocalImport, readLocalImportContext, readLocalImportCorpus } from "./local-import-service";

const sha = z.string().regex(/^[a-f0-9]{64}$/u);
export const packageReviewAuthorizationSchema = z.object({
  schemaVersion: z.literal(1), sourceBundleId: z.string().min(1).max(160), actorPublicId: z.uuid(),
  sourcesSha256: sha, mappingSha256: sha,
  banks: z.array(z.object({ bank: z.enum(["fgv", "fcc", "vunesp", "cebraspe"]), sha256: sha }).strict()).min(1).max(4),
  humanReviewConfirmed: z.literal(true), cleanRoomAttested: z.literal(true),
  reference: z.string().trim().min(10).max(250), notes: z.string().trim().min(10).max(1500),
}).strict();

/** Serviço interno do operador autorizado. O recibo não é autenticação pública:
 * nunca expor esta função como endpoint sem sessão e autorização próprias. */
export async function reviewImportedPackage(db: PostgresJsDatabase<typeof schema>, request: {
  sources: unknown; batches: readonly unknown[]; mapping: unknown; authorization: unknown;
  mode: "preview" | "apply"; expectedFingerprint?: string;
}) {
  if (!["preview", "apply"].includes(request.mode)) throw new LocalImportError("Modo editorial inválido.");
  const input = parseLocalImport(request.sources, request.batches, request.mapping);
  const parsed = packageReviewAuthorizationSchema.safeParse(request.authorization);
  if (!parsed.success) throw new LocalImportError("Falta a confirmação humana específica de revisão e responsabilidade editorial.");
  const authorization = parsed.data;
  if (authorization.sourceBundleId !== input.sources.id || authorization.sourcesSha256 !== input.validation.sourcesSha256 ||
      authorization.mappingSha256 !== importFingerprint(input.mapping) ||
      authorization.banks.length !== input.validation.banks.length || new Set(authorization.banks.map((bank) => bank.bank)).size !== authorization.banks.length ||
      input.validation.banks.some((bank) => !authorization.banks.some((confirmed) => confirmed.bank === bank.bank && confirmed.sha256 === bank.sha256))) {
    throw new LocalImportError("A confirmação humana não corresponde às versões exatas do pacote.");
  }
  if (request.mode === "apply" && !sha.safeParse(request.expectedFingerprint).success) {
    throw new LocalImportError("Confira a simulação de aprovação e informe sua impressão digital.");
  }
  const publicIds = input.batches.flatMap((batch) => batch.questions.map((question) => localQuestionUuid(input.sources.id, question.id)));
  const authorizationSha256 = importFingerprint(authorization);
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`set local statement_timeout = '30s'`);
    await transaction.execute(sql`set local lock_timeout = '5s'`);
    if (request.mode === "apply") {
      await transaction.execute(sql`select pg_advisory_xact_lock(1279873106, 1)`);
      const targets = await transaction.select({ id: schema.questions.id }).from(schema.questions).where(inArray(schema.questions.publicId, publicIds));
      await lockApprovalScope(transaction, { questionIds: targets.map((row) => row.id), legalArticleIds: [], styleBankIds: [] });
      // O papel do operador não pode mudar entre a leitura e a gravação.
      await transaction.execute(sql`select id from users where public_id = ${authorization.actorPublicId} for share`);
    }
    const [actor] = await transaction.select({ id: schema.users.id, role: schema.users.role }).from(schema.users)
      .where(eq(schema.users.publicId, authorization.actorPublicId));
    if (!actor || !["editor", "admin"].includes(actor.role)) throw new LocalImportError("Responsável editorial não encontrado ou sem papel autorizado.");
    const context = await readLocalImportContext(transaction, input);
    const plan = prepareLocalImport(input, context);
    const stored = await transaction.select().from(schema.questions).where(inArray(schema.questions.publicId, publicIds));
    if (stored.length !== plan.totalQuestions) throw new LocalImportError("O pacote precisa estar integralmente importado como rascunho.");
    const corpus = await readLocalImportCorpus(transaction);
    const now = new Date();
    const prepared = [];
    for (const item of plan.prepared) {
      await checkExistingLocalImport(transaction, item);
      const question = stored.find((row) => row.publicId === item.publicId)!;
      const article = context.articles.find((row) => row.id === question.legalArticleId)!;
      const bank = context.banks.find((row) => row.id === question.styleBankId)!;
      const similarity = checkImportOriginality(question.publicId, question.prompt, corpus);
      const dossierFingerprint = buildDossierFingerprint({ ...question, options: item.options,
        articleRef: article.articleRef, literalText: article.literalText, sourceUrl: article.sourceUrl, sourceVerifiedAt: article.verifiedAt });
      let reused = false;
      if (question.editorialStatus === "reviewed") {
        const receipts = await transaction.select({ metadata: schema.auditLogs.metadata }).from(schema.auditLogs)
          .where(and(eq(schema.auditLogs.entityId, item.publicId), eq(schema.auditLogs.entityType, "question"), eq(schema.auditLogs.action, "editorial.imported_package.approved")));
        if (question.createdByUserId !== actor.id || question.reviewedByUserId !== actor.id || !question.cleanRoomAttestedAt ||
            receipts.length !== 1 || receipts[0].metadata.authorizationSha256 !== authorizationSha256 || receipts[0].metadata.dossierFingerprint !== dossierFingerprint) {
          throw new LocalImportError("Questão já decidida por outro fluxo; a decisão existente foi preservada.");
        }
        reused = true;
      } else if (question.editorialStatus !== "draft" || question.createdByUserId || question.reviewedByUserId || question.cleanRoomAttestedAt || question.submittedAt) {
        throw new LocalImportError("O pacote contém item já assumido, suspenso ou pendente de outro fluxo.");
      }
      // A declaração explícita permite assumir o rascunho; a regra de aprovação
      // continua idêntica à da interface e é avaliada antes de qualquer commit.
      const approval = evaluateOriginalQuestionApproval({
        publicId: question.publicId, status: "pending_review", creatorUserId: actor.id, cleanRoomAttestedAt: question.cleanRoomAttestedAt ?? now,
        type: question.type, questionSourceRights: question.sourceRights, originalityCheckedAt: now, similarityMaxBps: similarity.scoreBps,
        articleStatus: article.articleStatus, articleSourceRights: article.sourceRights, versionStatus: article.versionStatus,
        sourceUrl: article.sourceUrl, actIsActive: article.actIsActive, profileFormat: bank.format,
        profileIsActive: bank.profileIsActive, bankIsActive: bank.isActive,
        optionTotal: item.options.length, optionCorrect: item.options.filter((option) => option.isCorrect).length,
      });
      if (!approval.allowed) throw new LocalImportError(approval.reason);
      prepared.push({ item, question, similarity, dossierFingerprint, reused });
    }
    const fingerprint = importFingerprint({ plan: plan.fingerprint, authorizationSha256,
      dossiers: prepared.map((row) => ({ publicId: row.item.publicId, fingerprint: row.dossierFingerprint })) });
    if (request.mode === "apply" && fingerprint !== request.expectedFingerprint) {
      throw new LocalImportError("O dossiê ou contexto mudou após a simulação de aprovação.");
    }
    let approved = 0;
    if (request.mode === "apply") for (const row of prepared) {
      if (row.reused) continue;
      const claimed = await transaction.update(schema.questions).set({ editorialStatus: "pending_review", createdByUserId: actor.id,
        cleanRoomAttestedAt: now, submittedAt: now, originalityCheckedAt: now, similarityMaxBps: row.similarity.scoreBps,
        similarityReferencePublicId: row.similarity.referencePublicId, updatedAt: now })
        .where(and(eq(schema.questions.id, row.question.id), eq(schema.questions.editorialStatus, "draft"))).returning({ id: schema.questions.id });
      if (claimed.length !== 1) throw new LocalImportError("O rascunho mudou durante a assunção editorial.");
      const updated = await transaction.update(schema.questions).set({ editorialStatus: "reviewed", reviewedByUserId: actor.id,
        reviewNotes: authorization.notes, verifiedAt: now, updatedAt: now })
        .where(and(eq(schema.questions.id, row.question.id), eq(schema.questions.editorialStatus, "pending_review"), currentLegalSourceExists()))
        .returning({ id: schema.questions.id });
      if (updated.length !== 1) throw new LocalImportError("A fonte ou o estado editorial mudou antes da aprovação.");
      await transaction.insert(schema.auditLogs).values([
        { actorUserId: actor.id, action: "editorial.generated_draft.claimed", entityType: "question", entityId: row.item.publicId,
          metadata: { authorizationSha256, reference: authorization.reference, cleanRoomAttested: true, authorshipMethod: "ai_assisted" } },
        { actorUserId: actor.id, action: "editorial.imported_package.approved", entityType: "question", entityId: row.item.publicId,
          metadata: { authorizationSha256, reference: authorization.reference, humanReviewConfirmed: true,
            sourceBundleId: input.sources.id, sourcesSha256: input.validation.sourcesSha256, contentFingerprint: row.item.receipt.contentFingerprint,
            mappingSha256: authorization.mappingSha256,
            dossierFingerprint: row.dossierFingerprint, sourceEvidence: row.item.receipt.sourceEvidence ?? null,
            reviewMode: "operator_records_explicit_human_confirmation", reviewerAlsoResponsible: true } },
      ]);
      approved += 1;
    }
    return { mode: request.mode, fingerprint, totalQuestions: prepared.length, approved,
      wouldApprove: prepared.filter((row) => !row.reused).length, reused: prepared.filter((row) => row.reused).length,
      publicationAllowed: request.mode === "apply", dossiers: prepared.map((row) => ({ publicId: row.item.publicId, fingerprint: row.dossierFingerprint })) };
  }, request.mode === "preview" ? { accessMode: "read only", isolationLevel: "repeatable read" } : undefined);
}
