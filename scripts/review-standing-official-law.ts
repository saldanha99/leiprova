import { and, eq, ne, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import { auditLogs, legalActs, legalArticles, legalSourceSnapshots, legalTextSnapshots, legalVersions, users } from "../src/lib/db/schema";
import { CAMARA_LGPD_SOURCE } from "../src/lib/official-sources/camara-text";
import { fetchOfficialConsolidatedLegalText, fetchOfficialLegalDocument } from "../src/lib/official-sources/fetch";
import { OFFICIAL_LAW_STANDING_REFERENCE, parseStandingLawReviewArgs, standingLawFingerprint, validateFreshStandingLawCapture, validateStandingLawCorpus, validateStandingLawIdentity, type StandingLawContext } from "../src/lib/official-sources/standing-law-review";
import { parseOpportunityApprovalReviewerIdentity, requireOpportunityApprovalDatabaseUrl } from "../src/lib/opportunities/approval-command";

type Reader = Pick<PostgresJsDatabase<typeof schema>, "select">;

async function readContext(db: Reader, publicId: string, lock = false): Promise<StandingLawContext> {
  const query = db.select({ act: legalActs, monitor: legalSourceSnapshots, text: legalTextSnapshots })
    .from(legalTextSnapshots)
    .innerJoin(legalActs, eq(legalActs.id, legalTextSnapshots.legalActId))
    .innerJoin(legalSourceSnapshots, and(eq(legalSourceSnapshots.id, legalTextSnapshots.monitorSnapshotId), eq(legalSourceSnapshots.legalActId, legalActs.id)))
    .where(eq(legalTextSnapshots.publicId, publicId)).limit(1);
  const [context] = await (lock ? query.for("update") : query);
  if (!context) throw new Error("Fotografia textual exata não encontrada.");
  // Fingerprint includes an explicit, stable subset, not ORM-only timestamps.
  return {
    act: { id: context.act.id, slug: context.act.slug, officialUrl: context.act.officialUrl, urn: context.act.urn, isActive: context.act.isActive, actNumber: context.act.actNumber, actYear: context.act.actYear, actType: context.act.actType, jurisdiction: context.act.jurisdiction },
    monitor: { id: context.monitor.id, publicId: context.monitor.publicId, legalActId: context.monitor.legalActId, sourceUrl: context.monitor.sourceUrl, checksumSha256: context.monitor.checksumSha256, normalizedContent: context.monitor.normalizedContent, fetchedAt: context.monitor.fetchedAt, status: context.monitor.status },
    text: { id: context.text.id, publicId: context.text.publicId, legalActId: context.text.legalActId, monitorSnapshotId: context.text.monitorSnapshotId, sourceUrl: context.text.sourceUrl, parserVersion: context.text.parserVersion, checksumSha256: context.text.checksumSha256, normalizedContent: context.text.normalizedContent, articleCount: context.text.articleCount, contentLength: context.text.contentLength, fetchedAt: context.text.fetchedAt, status: context.text.status },
  };
}

async function verifyStandingIdempotency(db: Reader, context: StandingLawContext, checksum: string, fingerprint: string, articles: ReturnType<typeof validateStandingLawCorpus>) {
  const [receipt] = await db.select({ id: auditLogs.id }).from(auditLogs).where(and(eq(auditLogs.entityId, context.text.publicId), eq(auditLogs.action, "editorial.legal_text.approved"), sql`${auditLogs.metadata}->>'approvalReference' = ${OFFICIAL_LAW_STANDING_REFERENCE}`, sql`${auditLogs.metadata}->>'approvalMode' = 'owner_standing_authorization'`, sql`${auditLogs.metadata}->>'humanReview' = 'false'`, sql`${auditLogs.metadata}->>'checksum' = ${checksum}`, sql`${auditLogs.metadata}->>'fingerprint' = ${fingerprint}`)).limit(1);
  const [version] = await db.select({ id: legalVersions.id }).from(legalVersions).where(and(eq(legalVersions.legalActId, context.act.id), eq(legalVersions.checksumSha256, checksum), eq(legalVersions.status, "current"), eq(legalVersions.sourceUrl, context.text.sourceUrl))).limit(1);
  if (!receipt || !version || context.monitor.status !== "approved") throw new Error("Fotografia já aprovada sem recibo permanente exato ou versão atual correspondente.");
  const existing = await db.select({ path: legalArticles.path, literalText: legalArticles.literalText, status: legalArticles.editorialStatus, rights: legalArticles.sourceRights }).from(legalArticles).where(eq(legalArticles.legalVersionId, version.id));
  if (existing.length !== articles.length || articles.some((article) => !existing.some((row) => row.path === article.path && row.literalText === article.literalText && row.status === "reviewed" && row.rights === "official_text"))) throw new Error("Artigos atuais divergem do recibo; não restaurar silenciosamente.");
  return { mode: "unchanged", snapshot: context.text.publicId, versionId: version.id, articleCount: existing.length, auditId: receipt.id };
}

async function main() {
  const command = parseStandingLawReviewArgs(process.argv.slice(2));
  const databaseUrl = requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL });
  const targetDatabase = new URL(databaseUrl);
  if (decodeURIComponent(targetDatabase.username) !== "leiprova_owner" || targetDatabase.pathname !== "/leiprova") throw new Error("Use o acesso de manutenção leiprova_owner ao banco leiprova; a aplicação e outros projetos ficam fora deste operador.");
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });
  try {
    const context = await readContext(db, command.snapshot);
    validateStandingLawIdentity(context);
    if (command.inspect) {
      const articles = validateStandingLawCorpus(context);
      console.log(JSON.stringify({ mode: "inspect", snapshot: context.text.publicId, checksum: context.text.checksumSha256, fingerprint: standingLawFingerprint(context), parser: context.text.parserVersion, sourceUrl: context.text.sourceUrl, monitorSnapshot: context.monitor.publicId, monitorChecksum: context.monitor.checksumSha256, monitorStatus: context.monitor.status, textStatus: context.text.status, articleCount: articles.length, databaseWrites: 0 }, null, 2));
      return;
    }
    if (process.env.LEGAL_STANDING_REVIEW_REFERENCE !== OFFICIAL_LAW_STANDING_REFERENCE) throw new Error("Referência exata da autorização permanente de fontes/programas ausente.");
    const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: OFFICIAL_LAW_STANDING_REFERENCE });
    // Network is entirely outside the locking transaction. No cached/private file
    // may substitute for current official access in an approval execution.
    const freshMonitor = await fetchOfficialLegalDocument(CAMARA_LGPD_SOURCE.monitorUrl);
    const freshText = await fetchOfficialConsolidatedLegalText(CAMARA_LGPD_SOURCE.monitorUrl, { provider: "camara" });
    const fresh = { monitor: freshMonitor, text: freshText };
    const articles = validateFreshStandingLawCapture(context, command, fresh);
    const operators = await db.select({ id: users.id, role: users.role }).from(users)
      .where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : eq(users.role, "admin")).limit(2);
    if (operators.length !== 1 || operators[0].role !== "admin") throw new Error("Exige exatamente um administrador identificado.");
    const operatorId = operators[0].id;
    if (!command.apply) {
      if (context.text.status === "approved") await verifyStandingIdempotency(db, context, command.checksum, command.fingerprint, articles);
      else {
        const [collision] = await db.select({ id: legalVersions.id }).from(legalVersions).where(and(eq(legalVersions.legalActId, context.act.id), eq(legalVersions.checksumSha256, command.checksum))).limit(1);
        if (collision) throw new Error("Versão com esse checksum já existe; não propor reativação silenciosa na prévia.");
      }
      console.log(JSON.stringify({ mode: "preview", snapshot: command.snapshot, checksum: command.checksum, fingerprint: command.fingerprint, articleCount: articles.length, monitorStatus: context.monitor.status, textStatus: context.text.status, wouldActivateVersion: context.text.status === "pending_review", approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, approvalMode: "owner_standing_authorization", humanReview: false, databaseWrites: 0 }, null, 2));
      return;
    }
    const result = await db.transaction(async (transaction) => {
      await transaction.execute(sql`set local lock_timeout = '5s'`);
      await transaction.execute(sql`set local statement_timeout = '30s'`);
      // Preserve act IDs; lock the act first, then its exact two snapshots.
      await transaction.select({ id: legalActs.id }).from(legalActs).where(eq(legalActs.id, context.act.id)).for("update");
      const locked = await readContext(transaction, command.snapshot, true);
      const lockedArticles = validateFreshStandingLawCapture(locked, command, fresh);
      const [operator] = await transaction.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, operatorId)).for("share");
      if (!operator || operator.role !== "admin") throw new Error("O administrador deixou de ter o papel exigido.");
      if (locked.text.status === "approved") {
        return verifyStandingIdempotency(transaction, locked, command.checksum, command.fingerprint, lockedArticles);
      }
      const [collision] = await transaction.select({ id: legalVersions.id }).from(legalVersions).where(and(eq(legalVersions.legalActId, locked.act.id), eq(legalVersions.checksumSha256, command.checksum))).limit(1);
      if (collision) throw new Error("Versão com esse checksum já existe; exige conferência explícita, sem reativação automática.");
      const now = new Date();
      const notes = `Revisão automatizada delimitada da LGPD; ${OFFICIAL_LAW_STANDING_REFERENCE}; ${lockedArticles.length} artigos; confronto oficial fresco. Sem revisão humana; conferência posterior pelo Maestro.`;
      const metadata = { approvalMode: "owner_standing_authorization", approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, humanReview: false, executionSource: "server_cli", legalActSlug: locked.act.slug, checksum: command.checksum, fingerprint: command.fingerprint, parserVersion: locked.text.parserVersion, sourceUrl: locked.text.sourceUrl, articleCount: lockedArticles.length, monitorChecksum: locked.monitor.checksumSha256, freshMonitorFetchedAt: freshMonitor.fetchedAt.toISOString(), freshTextFetchedAt: freshText.fetchedAt.toISOString(), excludedAmendmentArticles: [60], notes };
      if (locked.monitor.status === "pending_review") {
        await transaction.update(legalSourceSnapshots).set({ status: "superseded" }).where(and(eq(legalSourceSnapshots.legalActId, locked.act.id), eq(legalSourceSnapshots.status, "approved"), ne(legalSourceSnapshots.id, locked.monitor.id)));
        await transaction.update(legalSourceSnapshots).set({ status: "approved", reviewedByUserId: operatorId, reviewedAt: now, reviewNotes: notes }).where(and(eq(legalSourceSnapshots.id, locked.monitor.id), eq(legalSourceSnapshots.status, "pending_review")));
        await transaction.insert(auditLogs).values({ actorUserId: operatorId, action: "editorial.legal_source.approved", entityType: "legal_source_snapshot", entityId: locked.monitor.publicId, metadata: { approvalMode: "owner_standing_authorization", approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, humanReview: false, executionSource: "server_cli", legalActSlug: locked.act.slug, checksum: locked.monitor.checksumSha256, sourceUrl: locked.monitor.sourceUrl, linkedTextSnapshot: locked.text.publicId, textChecksum: command.checksum, textFingerprint: command.fingerprint, textParserVersion: locked.text.parserVersion, textSourceUrl: locked.text.sourceUrl, freshMonitorFetchedAt: freshMonitor.fetchedAt.toISOString(), notes } });
      }
      await transaction.update(legalTextSnapshots).set({ status: "superseded", updatedAt: now }).where(and(eq(legalTextSnapshots.legalActId, locked.act.id), eq(legalTextSnapshots.status, "approved"), ne(legalTextSnapshots.id, locked.text.id)));
      await transaction.update(legalVersions).set({ status: "superseded" }).where(and(eq(legalVersions.legalActId, locked.act.id), eq(legalVersions.status, "current")));
      const [version] = await transaction.insert(legalVersions).values({ legalActId: locked.act.id, sourceUrl: locked.text.sourceUrl, checksumSha256: command.checksum, verifiedAt: freshText.fetchedAt, status: "current" }).returning({ id: legalVersions.id });
      await transaction.insert(legalArticles).values(lockedArticles.map((article) => ({ ...article, legalVersionId: version.id, editorialStatus: "reviewed" as const, sourceRights: "official_text" as const })));
      await transaction.update(legalTextSnapshots).set({ status: "approved", reviewedByUserId: operatorId, reviewedAt: now, reviewNotes: notes, updatedAt: now }).where(and(eq(legalTextSnapshots.id, locked.text.id), eq(legalTextSnapshots.status, "pending_review")));
      const [receipt] = await transaction.insert(auditLogs).values({ actorUserId: operatorId, action: "editorial.legal_text.approved", entityType: "legal_text_snapshot", entityId: locked.text.publicId, metadata }).returning({ id: auditLogs.id });
      return { mode: "applied", snapshot: locked.text.publicId, versionId: version.id, articleCount: lockedArticles.length, auditId: receipt.id };
    }, { isolationLevel: "serializable" });
    console.log(JSON.stringify({ ...result, approvalMode: "owner_standing_authorization", approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, humanReview: false, questionsApproved: 0, bindingsCreated: 0 }, null, 2));
  } finally { await client.end(); }
}

if (process.argv[1]?.endsWith("review-standing-official-law.ts")) void main().catch((error: unknown) => {
  const databaseError = error instanceof Error && (error.name === "PostgresError" || ("code" in error && typeof error.code === "string" && /^[0-9A-Z]{5}$/u.test(error.code)));
  const detail = error instanceof Error && !databaseError ? error.message
    .replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]")
    .replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_-]+/gu, "[segredo removido]") : "Falha operacional; conferir o diagnóstico privado na VPS.";
  console.error("Revisão permanente da LGPD bloqueada.", detail); process.exitCode = 1;
});
