import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { auditLogs, legalActs, users } from "../src/lib/db/schema";
import { legalComplementarySources } from "../src/lib/db/schema-complementary";
import { DECREE_SOURCE_KEYS, fetchDecreeComplementaryEvidence } from "../src/lib/official-sources/decree-complementary";
import { getOfficialLegalSource } from "../src/lib/official-sources/legal-registry";
import { OFFICIAL_LAW_STANDING_REFERENCE } from "../src/lib/official-sources/standing-law-review";
import { parseOpportunityApprovalReviewerIdentity, requireOpportunityApprovalDatabaseUrl } from "../src/lib/opportunities/approval-command";

type Source = typeof legalComplementarySources.$inferSelect;
export function parseDecreeSupplementaryApprovalArgs(argv: readonly string[]) {
  let apply = false; let fingerprint: string | undefined;
  for (const [index, arg] of argv.entries()) {
    if (arg === "--" && index === 0) continue;
    if (arg === "--apply" && !apply) { apply = true; continue; }
    if (/^fingerprint=[a-f0-9]{64}$/u.test(arg) && !fingerprint) { fingerprint = arg.slice(12); continue; }
    throw new Error("Argumento desconhecido ou repetido.");
  }
  if (apply && !fingerprint) throw new Error("--apply exige fingerprint exato da prévia.");
  return { apply, fingerprint };
}
export function assertDecreeTargetAct(act: typeof legalActs.$inferSelect | undefined) {
  const registered = getOfficialLegalSource("lei-licitacoes-contratos-2021")!;
  if (!act || act.slug !== registered.slug || act.urn !== registered.lexmlUrn || act.officialUrl !== registered.officialUrl || !act.isActive || act.actType !== "lei" || act.actNumber !== "14.133" || act.actYear !== 2021 || act.jurisdiction !== "federal") throw new Error("Ato alvo diverge da identidade da Lei14.133.");
  return act;
}
export function decreeTargetFingerprint(act: typeof legalActs.$inferSelect, evidenceFingerprint: string) {
  return createHash("sha256").update(JSON.stringify({ evidenceFingerprint, target: { id: act.id, slug: act.slug, urn: act.urn, officialUrl: act.officialUrl, active: act.isActive, type: act.actType, number: act.actNumber, year: act.actYear, jurisdiction: act.jurisdiction } })).digest("hex");
}
export function validateExistingDecreeSupplementaryRows(rows: Source[], prepared: Awaited<ReturnType<typeof fetchDecreeComplementaryEvidence>>, fingerprint: string) {
  if (!rows.length) return null;
  if (rows.length !== 2) throw new Error("Par complementar incompleto/duplicado; nenhuma restauração silenciosa.");
  for (const part of prepared.parts) {
    const row = rows.find((source) => source.sourceKey === part.sourceKey);
    if (!row || row.status !== "approved" || row.evidenceFingerprint !== fingerprint || row.sourceUrl !== part.sourceUrl || row.sourceKind !== part.sourceKind || row.parserVersion !== part.parserVersion || row.sourceActType !== part.sourceActType || row.sourceActNumber !== part.sourceActNumber || row.sourceActYear !== part.sourceActYear || row.rawChecksumSha256 !== part.rawChecksumSha256 || row.normalizedChecksumSha256 !== part.normalizedChecksumSha256 || row.normalizedBody !== part.normalizedBody || row.normativeEffectiveFrom !== part.normativeEffectiveFrom || row.normativeValidUntil !== null || row.editorialCoverageFrom !== part.editorialCoverageFrom || row.editorialCoverageThrough !== part.editorialCoverageThrough || !isDeepStrictEqual(row.facts, part.facts) || row.humanReview || row.approvalReference !== OFFICIAL_LAW_STANDING_REFERENCE || row.approvalMode !== "owner_standing_authorization" || !row.reviewedByUserId || !row.reviewedAt || !row.approvalAuditId) throw new Error("Fonte complementar mudou/está suspensa ou sem prova/recibo exato; não restaurar.");
    const original = { ...row.sourceValidityObservation, observedAt: null };
    const current = { ...part.sourceValidityObservation, observedAt: null };
    if (!isDeepStrictEqual(original, current)) throw new Error("Observação de validade diverge; reavaliar oficialmente.");
  }
  if (rows[0].approvalAuditId !== rows[1].approvalAuditId) throw new Error("IDs complementares sem recibo de par único.");
  return { sourceIds: rows.map((source) => ({ id: source.id, publicId: source.publicId, sourceKey: source.sourceKey })), auditId: rows[0].approvalAuditId };
}

async function main() {
  const command = parseDecreeSupplementaryApprovalArgs(process.argv.slice(2));
  const url = requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL });
  const target = new URL(url);
  if (decodeURIComponent(target.username) !== "leiprova_owner" || target.pathname !== "/leiprova") throw new Error("Operador usa somente manutenção leiprova_owner no banco leiprova.");
  if (process.env.LEGAL_STANDING_REVIEW_REFERENCE !== OFFICIAL_LAW_STANDING_REFERENCE) throw new Error("Referência permanente exata ausente.");
  const reviewer = parseOpportunityApprovalReviewerIdentity({ ADMIN_EMAILS: process.env.ADMIN_EMAILS, OPPORTUNITY_APPROVAL_REFERENCE: OFFICIAL_LAW_STANDING_REFERENCE });
  // Full official network/parser validation precedes locking and all mutations.
  const prepared = await fetchDecreeComplementaryEvidence();
  const client = postgres(url, { max: 1, prepare: false }); const db = drizzle(client);
  try {
    const [candidate] = await db.select().from(legalActs).where(eq(legalActs.slug, "lei-licitacoes-contratos-2021")).limit(1);
    const act = assertDecreeTargetAct(candidate); const fingerprint = decreeTargetFingerprint(act, prepared.fingerprint);
    if (command.fingerprint && command.fingerprint !== fingerprint) throw new Error("Fingerprint da prévia mudou; nenhuma ativação.");
    const adminWhere = reviewer.email ? sql`lower(${users.email})=${reviewer.email}` : eq(users.role, "admin");
    const admins = await db.select({ id: users.id, role: users.role }).from(users).where(adminWhere).limit(2);
    if (admins.length !== 1 || admins[0].role !== "admin") throw new Error("Administrador deve ser único.");
    const actorId = admins[0].id;
    const where = and(eq(legalComplementarySources.legalActId, act.id), inArray(legalComplementarySources.sourceKey, [...DECREE_SOURCE_KEYS]));
    const verifyReceipt = async (rows: Source[], readAudit: (id: number) => Promise<(typeof auditLogs.$inferSelect)[]>) => {
      const receipt = validateExistingDecreeSupplementaryRows(rows, prepared, fingerprint);
      if (!receipt) return null;
      const [audit] = await readAudit(receipt.auditId!);
      const metadata = audit?.metadata as Record<string, unknown> | undefined;
      if (!audit || audit.action !== "editorial.legal_complementary_sources.approved" || audit.entityId !== fingerprint || metadata?.approvalReference !== OFFICIAL_LAW_STANDING_REFERENCE || metadata?.approvalMode !== "owner_standing_authorization" || metadata?.humanReview !== false || metadata?.fingerprint !== fingerprint || !isDeepStrictEqual(metadata?.sourcePublicIds, rows.map((row) => row.publicId).sort())) throw new Error("Recibo auditado dos IDs complementares não corresponde ao par.");
      return receipt;
    };
    const existing = await db.select().from(legalComplementarySources).where(where);
    const existingReceipt = await verifyReceipt(existing, (id) => db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1));
    if (!command.apply) {
      console.log(JSON.stringify({ mode: "preview", fingerprint, evidenceFingerprint: prepared.fingerprint, legalActId: act.id, currentReceipt: existingReceipt, wouldCreateSourceRows: !existingReceipt, sourceParts: prepared.parts.map((part) => ({ sourceKey: part.sourceKey, sourceUrl: part.sourceUrl, rawChecksumSha256: part.rawChecksumSha256, normalizedChecksumSha256: part.normalizedChecksumSha256 })), normativeEffectiveFrom: "2026-01-01", normativeValidUntil: null, editorialCoverageThrough: "2026-12-31", amountFacts: 9, publicationAllowed: false, humanReview: false, databaseWrites: 0 }, null, 2)); return;
    }
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout='5s'`); await tx.execute(sql`set local statement_timeout='30s'`);
      const [locked] = await tx.select().from(legalActs).where(eq(legalActs.id, act.id)).for("update");
      if (decreeTargetFingerprint(assertDecreeTargetAct(locked), prepared.fingerprint) !== command.fingerprint) throw new Error("Identidade/fingerprint alterada após prévia.");
      const age = Date.now() - prepared.parts[0].fetchedAt.getTime(); if (age < -30_000 || age > 300_000) throw new Error("Fonte oficial deixou de estar fresca antes da transação.");
      const lockedAdmins = await tx.select({ id: users.id, role: users.role }).from(users).where(adminWhere).limit(2).for("share");
      if (lockedAdmins.length !== 1 || lockedAdmins[0].id !== actorId || lockedAdmins[0].role !== "admin") throw new Error("Administrador mudou/deixou de ser único.");
      const lockedSources = await tx.select().from(legalComplementarySources).where(where).for("update");
      const prior = await verifyReceipt(lockedSources, (id) => tx.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1));
      if (prior) return { mode: "unchanged", ...prior };
      const publicIds = [randomUUID(), randomUUID()]; const now = new Date();
      const [audit] = await tx.insert(auditLogs).values({ actorUserId: actorId, action: "editorial.legal_complementary_sources.approved", entityType: "legal_complementary_source_pair", entityId: fingerprint, metadata: { approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, approvalMode: "owner_standing_authorization", humanReview: false, fingerprint, evidenceFingerprint: prepared.fingerprint, sourcePublicIds: [...publicIds].sort(), legalActId: act.id, sourceParts: prepared.parts.map((part) => ({ sourceKey: part.sourceKey, sourceUrl: part.sourceUrl, rawChecksumSha256: part.rawChecksumSha256, normalizedChecksumSha256: part.normalizedChecksumSha256 })), sourceValidityObservation: prepared.parts[0].sourceValidityObservation, normativeEffectiveFrom: "2026-01-01", normativeValidUntil: null, editorialCoverageThrough: "2026-12-31", lawLiteralModified: false, lawArticlesApproved: 0, amountFacts: 9, executionSource: "server_cli" } }).returning({ id: auditLogs.id });
      const inserted = await tx.insert(legalComplementarySources).values(prepared.parts.map((part, index) => ({ ...part, evidenceFingerprint: fingerprint, publicId: publicIds[index], legalActId: act.id, status: "approved", approvalAuditId: audit.id, approvalReference: OFFICIAL_LAW_STANDING_REFERENCE, approvalMode: "owner_standing_authorization", humanReview: false, reviewedByUserId: actorId, reviewedAt: now, lastVerifiedAt: now }))).returning({ id: legalComplementarySources.id, publicId: legalComplementarySources.publicId, sourceKey: legalComplementarySources.sourceKey });
      return { mode: "applied", sourceIds: inserted, auditId: audit.id };
    }, { isolationLevel: "serializable" });
    console.log(JSON.stringify({ ...result, fingerprint, humanReview: false, lawArticlesApproved: 0, lawLiteralModified: false, questionsApproved: 0, authoringIntegrationRequired: true }, null, 2));
  } finally { await client.end(); }
}
if (process.argv[1]?.endsWith("approve-procurement-supplementary-sources.ts")) void main().catch((error: unknown) => { const safe = error instanceof Error && error.name !== "PostgresError" ? error.message.replace(/postgres(?:ql)?:\/\/\S+/giu, "[conexão removida]") : "Falha operacional; diagnóstico privado na VPS."; console.error("Fonte complementar bloqueada.", safe); process.exitCode = 1; });
