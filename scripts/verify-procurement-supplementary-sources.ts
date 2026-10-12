import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { auditLogs, legalActs, users } from "../src/lib/db/schema";
import { legalComplementarySources } from "../src/lib/db/schema-complementary";
import { DECREE_SOURCE_KEYS, fetchDecreeComplementaryEvidence } from "../src/lib/official-sources/decree-complementary";
import { OFFICIAL_LAW_STANDING_REFERENCE } from "../src/lib/official-sources/standing-law-review";
import { parseOpportunityApprovalReviewerIdentity, requireOpportunityApprovalDatabaseUrl } from "../src/lib/opportunities/approval-command";
import { assertDecreeTargetAct, decreeTargetFingerprint, validateExistingDecreeSupplementaryRows } from "./approve-procurement-supplementary-sources";

/** Existing LegalMonitor must invoke this command; no automatic schedule implied. */
async function main() {
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));
  if (args.length > 1 || (args[0] && args[0] !== "--apply")) throw new Error("Verificação aceita somente --apply; padrão prévia sem escrita.");
  const apply = args[0] === "--apply";
  const url = requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL });
  const target = new URL(url);
  if (decodeURIComponent(target.username) !== "leiprova_owner" || target.pathname !== "/leiprova" || process.env.LEGAL_STANDING_REVIEW_REFERENCE !== OFFICIAL_LAW_STANDING_REFERENCE) throw new Error("Manutenção/referência permanente delimitada obrigatória.");
  const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: OFFICIAL_LAW_STANDING_REFERENCE });
  const client = postgres(url, { max: 1, prepare: false }); const db = drizzle(client);
  try {
    const [candidate] = await db.select().from(legalActs).where(eq(legalActs.slug, "lei-licitacoes-contratos-2021")).limit(1); const act = assertDecreeTargetAct(candidate);
    const where = and(eq(legalComplementarySources.legalActId, act.id), inArray(legalComplementarySources.sourceKey, [...DECREE_SOURCE_KEYS]), eq(legalComplementarySources.status, "approved"));
    const rows = await db.select().from(legalComplementarySources).where(where);
    if (!rows.length) { console.log(JSON.stringify({ mode: "no_approved_sources", databaseWrites: 0 })); return; }
    const stableRows = JSON.stringify(rows.map((row) => ({ id: row.id, publicId: row.publicId, fingerprint: row.evidenceFingerprint, status: row.status, verifiedAt: row.lastVerifiedAt?.toISOString() })).sort((a, b) => a.id - b.id));
    let failure: string | null = null; let prepared: Awaited<ReturnType<typeof fetchDecreeComplementaryEvidence>> | null = null;
    try {
      prepared = await fetchDecreeComplementaryEvidence();
      const fingerprint = decreeTargetFingerprint(act, prepared.fingerprint);
      const receipt = validateExistingDecreeSupplementaryRows(rows, prepared, fingerprint);
      if (!receipt) throw new Error("Par aprovado desapareceu.");
      const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.id, receipt.auditId!)).limit(1);
      const metadata = audit?.metadata as Record<string, unknown> | undefined;
      if (!audit || audit.action !== "editorial.legal_complementary_sources.approved" || audit.entityId !== fingerprint || metadata?.humanReview !== false || metadata?.approvalMode !== "owner_standing_authorization" || metadata?.fingerprint !== fingerprint || metadata?.approvalReference !== OFFICIAL_LAW_STANDING_REFERENCE || !isDeepStrictEqual(metadata?.sourcePublicIds, rows.map((row) => row.publicId).sort())) throw new Error("Recibo de aprovação não corresponde às fontes.");
    } catch (error) { failure = error instanceof Error ? error.message : "Conferência oficial falhou"; }
    if (!apply) { console.log(JSON.stringify({ mode: "preview", sourceIds: rows.map((row) => row.id), verificationSucceeded: failure === null, wouldSuspend: failure !== null, reason: failure, databaseWrites: 0 }, null, 2)); return; }
    const adminWhere = reviewer.email ? sql`lower(${users.email})=${reviewer.email}` : eq(users.role, "admin");
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout='5s'`); await tx.execute(sql`set local statement_timeout='30s'`);
      const [lockedAct] = await tx.select().from(legalActs).where(eq(legalActs.id, act.id)).for("update"); assertDecreeTargetAct(lockedAct);
      const admins = await tx.select({ id: users.id, role: users.role }).from(users).where(adminWhere).limit(2).for("share");
      if (admins.length !== 1 || admins[0].role !== "admin") throw new Error("Administrador único obrigatório.");
      const locked = await tx.select().from(legalComplementarySources).where(where).for("update");
      const lockedState = JSON.stringify(locked.map((row) => ({ id: row.id, publicId: row.publicId, fingerprint: row.evidenceFingerprint, status: row.status, verifiedAt: row.lastVerifiedAt?.toISOString() })).sort((a, b) => a.id - b.id));
      if (lockedState !== stableRows) throw new Error("Fontes foram alteradas durante a recaptura; executar verificação nova.");
      if (!failure && prepared) {
        const age = Date.now() - prepared.parts[0].fetchedAt.getTime(); if (age < -30_000 || age > 300_000) throw new Error("Recaptura perdeu frescor; não renovar lease.");
        validateExistingDecreeSupplementaryRows(locked, prepared, decreeTargetFingerprint(assertDecreeTargetAct(lockedAct), prepared.fingerprint));
      }
      const now = new Date();
      if (failure) await tx.update(legalComplementarySources).set({ status: "suspended", updatedAt: now }).where(where);
      else await tx.update(legalComplementarySources).set({ lastVerifiedAt: now, updatedAt: now }).where(where);
      const [audit] = await tx.insert(auditLogs).values({ actorUserId: admins[0].id, action: failure ? "editorial.legal_complementary_sources.suspended" : "editorial.legal_complementary_sources.verified", entityType: "legal_complementary_source_pair", entityId: rows[0].evidenceFingerprint, metadata: { approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, approvalMode: "owner_standing_authorization", humanReview: false, sourceIds: rows.map((row) => row.id), sourcePublicIds: rows.map((row) => row.publicId), verificationSucceeded: failure === null, observedAt: now.toISOString(), reason: failure, reasonClassification: failure ? "official_dependency_verification_failed_not_claim_of_revocation" : null, leaseHours: 6, worker: "verify-procurement-supplementary-sources.ts", executionSource: "server_cli", sourceValidityObservation: prepared?.parts[0].sourceValidityObservation ?? null, lawArticlesModified: 0, questionsApproved: 0 } }).returning({ id: auditLogs.id });
      return { mode: failure ? "suspended" : "verified", sourceIds: rows.map((row) => row.id), auditId: audit.id, humanReview: false };
    }, { isolationLevel: "serializable" });
    console.log(JSON.stringify(result, null, 2));
  } finally { await client.end(); }
}
if (process.argv[1]?.endsWith("verify-procurement-supplementary-sources.ts")) void main().catch((error: unknown) => { const safe = error instanceof Error && error.name !== "PostgresError" ? error.message.replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]") : "Falha operacional; diagnóstico privado na VPS."; console.error("Monitor complementar bloqueado.", safe); process.exitCode = 1; });
