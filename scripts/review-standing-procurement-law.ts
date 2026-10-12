import { and, eq, ne, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";
import { auditLogs, legalActs, legalArticles, legalSourceSnapshots, legalTextSnapshots, legalVersions, users } from "../src/lib/db/schema";
import { assertCamaraProcurementRobotsAllowed, CAMARA_PROCUREMENT_SOURCE, extractCamaraProcurementPdf } from "../src/lib/official-sources/camara-procurement-text";
import { fetchOfficialLegalDocument } from "../src/lib/official-sources/fetch";
import { OFFICIAL_LAW_STANDING_REFERENCE, PROCUREMENT_PARTIAL_POLICY, PROCUREMENT_PENDING_ARTICLES, PROCUREMENT_RECONCILIATION_DOSSIER, PROCUREMENT_RECONCILED_RAW_PDF, PROCUREMENT_VETO_EVIDENCE, parseStandingProcurementReviewArgs, partitionStandingProcurementArticles, standingProcurementFingerprint, validateFreshStandingProcurementCapture, validateProcurementVetoReconciliation, validateStandingProcurementCorpus, validateStandingProcurementExistingArticles, validateStandingProcurementIdentity, validateStandingProcurementReceipt, type FreshProcurementCapture, type StandingProcurementContext } from "../src/lib/official-sources/standing-procurement-review";
import { parseOpportunityApprovalReviewerIdentity, requireOpportunityApprovalDatabaseUrl } from "../src/lib/opportunities/approval-command";

type Reader = Pick<PostgresJsDatabase<typeof schema>, "select">;

async function readContext(db: Reader, publicId: string, lock = false): Promise<StandingProcurementContext> {
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

async function verifyStandingIdempotency(db: Reader, context: StandingProcurementContext, checksum: string, fingerprint: string, articles: ReturnType<typeof validateStandingProcurementCorpus>) {
  const [receipt] = await db.select({ id: auditLogs.id, metadata: auditLogs.metadata }).from(auditLogs).where(and(eq(auditLogs.entityId, context.text.publicId), eq(auditLogs.action, "editorial.legal_text.partially_approved"), sql`${auditLogs.metadata}->>'approvalReference' = ${OFFICIAL_LAW_STANDING_REFERENCE}`, sql`${auditLogs.metadata}->>'approvalMode' = 'owner_standing_authorization'`, sql`${auditLogs.metadata}->>'humanReview' = 'false'`, sql`${auditLogs.metadata}->>'checksum' = ${checksum}`, sql`${auditLogs.metadata}->>'fingerprint' = ${fingerprint}`, sql`${auditLogs.metadata}->>'policy' = ${PROCUREMENT_PARTIAL_POLICY}`)).limit(1);
  const [version] = await db.select({ id: legalVersions.id }).from(legalVersions).where(and(eq(legalVersions.legalActId, context.act.id), eq(legalVersions.checksumSha256, checksum), eq(legalVersions.status, "current"), eq(legalVersions.sourceUrl, context.text.sourceUrl))).limit(1);
  const metadata = receipt?.metadata as Record<string, unknown> | undefined;
  if (!receipt || !version || context.monitor.status !== "approved") throw new Error("Fotografia já aprovada sem recibo parcial exato ou versão atual correspondente.");
  validateStandingProcurementReceipt(metadata, checksum, fingerprint);
  const existing = await db.select({ path: legalArticles.path, literalText: legalArticles.literalText, status: legalArticles.editorialStatus, rights: legalArticles.sourceRights, heading: legalArticles.heading, articleRef: legalArticles.articleRef, articleOrder: legalArticles.articleOrder }).from(legalArticles).where(eq(legalArticles.legalVersionId, version.id));
  const counts = validateStandingProcurementExistingArticles(articles, existing);
  return { mode: "unchanged", snapshot: context.text.publicId, versionId: version.id, capturedArticleCount: 191, ...counts, auditId: receipt.id };
}

async function readApprovalBody(response: Response, limit: number) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new Error("Fonte excede o limite de bytes da aprovação.");
  if (!response.body) throw new Error("Fonte oficial sem corpo.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("Fonte excede o limite de bytes da aprovação.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function captureFreshApprovalPdf(): Promise<FreshProcurementCapture["text"]> {
  const headers = { "User-Agent": "EditalLeiSeca-OfficialSourceMonitor/1.0 (+https://editaleiseca.com.br/fontes-e-atualizacao)", Accept: "application/pdf,text/plain;q=0.9" };
  const options = { redirect: "manual" as const, headers, signal: AbortSignal.timeout(20_000), cache: "no-store" as const };
  const robots = await fetch("https://www2.camara.leg.br/robots.txt", options);
  if (robots.status !== 404 && !robots.ok) throw new Error(`Robots Câmara HTTP ${robots.status}; sem contorno.`);
  if (robots.status !== 404) assertCamaraProcurementRobotsAllowed(new TextDecoder("utf-8", { fatal: true }).decode(await readApprovalBody(robots, 65_536)), CAMARA_PROCUREMENT_SOURCE.url);
  const response = await fetch(CAMARA_PROCUREMENT_SOURCE.url, { ...options, signal: AbortSignal.timeout(20_000) });
  if (!response.ok || response.redirected || response.url !== CAMARA_PROCUREMENT_SOURCE.url) throw new Error(`PDF Câmara HTTP ${response.status} ou URL divergente; sem contorno.`);
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/pdf") throw new Error("Fonte Câmara sem MIME PDF; erro/HTML não são corpo aprovado.");
  const parsed = await extractCamaraProcurementPdf(await readApprovalBody(response, 15 * 1024 * 1024), CAMARA_PROCUREMENT_SOURCE.url);
  return { sourceUrl: CAMARA_PROCUREMENT_SOURCE.url, checksumSha256: parsed.checksumSha256, normalizedContent: parsed.normalizedContent, contentLength: parsed.normalizedContent.length, articleCount: parsed.articles.length, parserVersion: CAMARA_PROCUREMENT_SOURCE.parserVersion, rawPdfChecksumSha256: parsed.rawPdfChecksumSha256, pageCount: parsed.pageCount, fetchedAt: new Date() };
}

async function main() {
  const command = parseStandingProcurementReviewArgs(process.argv.slice(2));
  const databaseUrl = requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL });
  const targetDatabase = new URL(databaseUrl);
  if (decodeURIComponent(targetDatabase.username) !== "leiprova_owner" || targetDatabase.pathname !== "/leiprova") throw new Error("Use o acesso de manutenção leiprova_owner ao banco leiprova; a aplicação e outros projetos ficam fora deste operador.");
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });
  try {
    const context = await readContext(db, command.snapshot);
    validateStandingProcurementIdentity(context);
    if (command.inspect) {
      const articles = validateStandingProcurementCorpus(context);
      validateProcurementVetoReconciliation(articles);
      const partition = partitionStandingProcurementArticles(articles);
      console.log(JSON.stringify({ mode: "inspect", snapshot: context.text.publicId, checksum: context.text.checksumSha256, fingerprint: standingProcurementFingerprint(context), parser: context.text.parserVersion, sourceUrl: context.text.sourceUrl, monitorSnapshot: context.monitor.publicId, monitorChecksum: context.monitor.checksumSha256, monitorStatus: context.monitor.status, textStatus: context.text.status, capturedArticleCount: articles.length, wouldReviewArticleCount: partition.reviewed.length, wouldDeferArticleCount: partition.deferred.length, pendingArticles: PROCUREMENT_PENDING_ARTICLES, requiredRawPdfSha256: PROCUREMENT_RECONCILED_RAW_PDF, requiredDossierSha256: PROCUREMENT_RECONCILIATION_DOSSIER, policy: PROCUREMENT_PARTIAL_POLICY, databaseWrites: 0 }, null, 2));
      return;
    }
    if (process.env.LEGAL_STANDING_REVIEW_REFERENCE !== OFFICIAL_LAW_STANDING_REFERENCE) throw new Error("Referência exata da autorização permanente de fontes/programas ausente.");
    const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: OFFICIAL_LAW_STANDING_REFERENCE });
    // Network is entirely outside the locking transaction. No cached/private file
    // may substitute for current official access in an approval execution.
    const freshMonitor = await fetchOfficialLegalDocument(CAMARA_PROCUREMENT_SOURCE.monitorUrl);
    const freshText = await captureFreshApprovalPdf();
    const fresh = { monitor: freshMonitor, text: freshText };
    const partition = validateFreshStandingProcurementCapture(context, command, fresh);
    const articles = partition.articles;
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
      console.log(JSON.stringify({ mode: "preview", snapshot: command.snapshot, checksum: command.checksum, fingerprint: command.fingerprint, capturedArticleCount: articles.length, wouldReviewArticleCount: partition.reviewed.length, wouldDeferArticleCount: partition.deferred.length, pendingArticles: PROCUREMENT_PENDING_ARTICLES, rawPdfChecksumSha256: freshText.rawPdfChecksumSha256, dossierSha256: command.dossier, policy: PROCUREMENT_PARTIAL_POLICY, monitorStatus: context.monitor.status, textStatus: context.text.status, wouldActivateVersion: context.text.status === "pending_review", approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, approvalMode: "owner_standing_authorization", humanReview: false, databaseWrites: 0 }, null, 2));
      return;
    }
    const result = await db.transaction(async (transaction) => {
      await transaction.execute(sql`set local lock_timeout = '5s'`);
      await transaction.execute(sql`set local statement_timeout = '30s'`);
      // Preserve act IDs; lock the act first, then its exact two snapshots.
      await transaction.select({ id: legalActs.id }).from(legalActs).where(eq(legalActs.id, context.act.id)).for("update");
      const locked = await readContext(transaction, command.snapshot, true);
      const lockedPartition = validateFreshStandingProcurementCapture(locked, command, fresh);
      const lockedArticles = lockedPartition.articles;
      const lockedOperators = await transaction.select({ id: users.id, role: users.role }).from(users).where(reviewer.email ? sql`lower(${users.email}) = ${reviewer.email}` : eq(users.role, "admin")).limit(2).for("share");
      if (lockedOperators.length !== 1 || lockedOperators[0].id !== operatorId || lockedOperators[0].role !== "admin") throw new Error("O administrador deixou de ser único ou perdeu o papel exigido.");
      if (locked.text.status === "approved") {
        return verifyStandingIdempotency(transaction, locked, command.checksum, command.fingerprint, lockedArticles);
      }
      const [collision] = await transaction.select({ id: legalVersions.id }).from(legalVersions).where(and(eq(legalVersions.legalActId, locked.act.id), eq(legalVersions.checksumSha256, command.checksum))).limit(1);
      if (collision) throw new Error("Versão com esse checksum já existe; exige conferência explícita, sem reativação automática.");
      const now = new Date();
      const notes = `Revisão automatizada PARCIAL Lei 14.133; ${OFFICIAL_LAW_STANDING_REFERENCE}; captura integral 191, apenas 182 artigos reviewed; 9 pending_review (${PROCUREMENT_PENDING_ARTICLES.map((article) => article.path).join(", ")}). PDF e monitor frescos; 11 vetos confrontados. Sem revisão humana. Valores/ADI/transição dos 9 artigos não liberados; conferência posterior pelo Maestro.`;
      const metadata = { policy: PROCUREMENT_PARTIAL_POLICY, partialApproval: true, capturedArticleCount: 191, reviewedArticleCount: 182, pendingArticleCount: 9, pendingArticles: PROCUREMENT_PENDING_ARTICLES, rawPdfChecksumSha256: freshText.rawPdfChecksumSha256, dossierSha256: command.dossier, vetoReconciliation: PROCUREMENT_VETO_EVIDENCE, approvalMode: "owner_standing_authorization", approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, humanReview: false, executionSource: "server_cli", legalActSlug: locked.act.slug, checksum: command.checksum, fingerprint: command.fingerprint, parserVersion: locked.text.parserVersion, sourceUrl: locked.text.sourceUrl, articleCount: lockedArticles.length, monitorChecksum: locked.monitor.checksumSha256, freshMonitorFetchedAt: freshMonitor.fetchedAt.toISOString(), freshTextFetchedAt: freshText.fetchedAt.toISOString(), excludedAmendmentArticles: [177, 178, 179], notes };
      if (locked.monitor.status === "pending_review") {
        await transaction.update(legalSourceSnapshots).set({ status: "superseded" }).where(and(eq(legalSourceSnapshots.legalActId, locked.act.id), eq(legalSourceSnapshots.status, "approved"), ne(legalSourceSnapshots.id, locked.monitor.id)));
        await transaction.update(legalSourceSnapshots).set({ status: "approved", reviewedByUserId: operatorId, reviewedAt: now, reviewNotes: notes }).where(and(eq(legalSourceSnapshots.id, locked.monitor.id), eq(legalSourceSnapshots.status, "pending_review")));
        await transaction.insert(auditLogs).values({ actorUserId: operatorId, action: "editorial.legal_source.approved", entityType: "legal_source_snapshot", entityId: locked.monitor.publicId, metadata: { policy: PROCUREMENT_PARTIAL_POLICY, partialApproval: true, capturedArticleCount: 191, reviewedArticleCount: 182, pendingArticleCount: 9, pendingArticles: PROCUREMENT_PENDING_ARTICLES, approvalMode: "owner_standing_authorization", approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, humanReview: false, executionSource: "server_cli", legalActSlug: locked.act.slug, checksum: locked.monitor.checksumSha256, sourceUrl: locked.monitor.sourceUrl, linkedTextSnapshot: locked.text.publicId, textChecksum: command.checksum, textFingerprint: command.fingerprint, textParserVersion: locked.text.parserVersion, textSourceUrl: locked.text.sourceUrl, freshMonitorFetchedAt: freshMonitor.fetchedAt.toISOString(), notes } });
      }
      await transaction.update(legalTextSnapshots).set({ status: "superseded", updatedAt: now }).where(and(eq(legalTextSnapshots.legalActId, locked.act.id), eq(legalTextSnapshots.status, "approved"), ne(legalTextSnapshots.id, locked.text.id)));
      await transaction.update(legalVersions).set({ status: "superseded" }).where(and(eq(legalVersions.legalActId, locked.act.id), eq(legalVersions.status, "current")));
      const [version] = await transaction.insert(legalVersions).values({ legalActId: locked.act.id, sourceUrl: locked.text.sourceUrl, checksumSha256: command.checksum, verifiedAt: freshText.fetchedAt, status: "current" }).returning({ id: legalVersions.id });
      const pendingPaths = new Set<string>(PROCUREMENT_PENDING_ARTICLES.map((article) => article.path));
      await transaction.insert(legalArticles).values(lockedArticles.map((article) => ({ ...article, legalVersionId: version.id, editorialStatus: pendingPaths.has(article.path) ? "pending_review" as const : "reviewed" as const, sourceRights: "official_text" as const })));
      await transaction.update(legalTextSnapshots).set({ status: "approved", reviewedByUserId: operatorId, reviewedAt: now, reviewNotes: notes, updatedAt: now }).where(and(eq(legalTextSnapshots.id, locked.text.id), eq(legalTextSnapshots.status, "pending_review")));
      const [receipt] = await transaction.insert(auditLogs).values({ actorUserId: operatorId, action: "editorial.legal_text.partially_approved", entityType: "legal_text_snapshot", entityId: locked.text.publicId, metadata }).returning({ id: auditLogs.id });
      return { mode: "applied", snapshot: locked.text.publicId, versionId: version.id, capturedArticleCount: lockedArticles.length, reviewedArticleCount: lockedPartition.reviewed.length, pendingArticleCount: lockedPartition.deferred.length, auditId: receipt.id };
    }, { isolationLevel: "serializable" });
    console.log(JSON.stringify({ ...result, approvalMode: "owner_standing_authorization", approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, humanReview: false, partialApproval: true, pendingArticles: PROCUREMENT_PENDING_ARTICLES, questionsApproved: 0, bindingsCreated: 0 }, null, 2));
  } finally { await client.end(); }
}

if (process.argv[1]?.endsWith("review-standing-procurement-law.ts")) void main().catch((error: unknown) => {
  const databaseError = error instanceof Error && (error.name === "PostgresError" || ("code" in error && typeof error.code === "string" && /^[0-9A-Z]{5}$/u.test(error.code)));
  const detail = error instanceof Error && !databaseError ? error.message
    .replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]")
    .replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9_-]+/gu, "[segredo removido]") : "Falha operacional; conferir o diagnóstico privado na VPS.";
  console.error("Revisão permanente parcial da Lei 14.133 bloqueada.", detail); process.exitCode = 1;
});
