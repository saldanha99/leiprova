import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { legalComplementarySources } from "../db/schema-complementary";
import { DECREE_ANNEX_NORMALIZED_SHA, DECREE_BODY_NORMALIZED_SHA, DECREE_COMPLEMENTARY_PARSER, DECREE_COMPLEMENTARY_POLICY, DECREE_METADATA_RAW_SHA, DECREE_METADATA_URL, DECREE_SOURCE_KEYS } from "./decree-complementary";
import { PROCUREMENT_2026_AMOUNTS, PROCUREMENT_CONTEXT_SOURCE, prepareProcurementSupplementaryContext } from "./procurement-context";
import { OFFICIAL_LAW_STANDING_REFERENCE } from "./standing-law-review";

type Row = typeof legalComplementarySources.$inferSelect;
type Input = Parameters<typeof prepareProcurementSupplementaryContext>[0];

/** Approved source IDs do not imply a reviewed law article or question. */
export function attachApprovedDecreeSourceIds(input: Input, rows: readonly Row[], legalActId: number, now = new Date()) {
  const prepared = prepareProcurementSupplementaryContext(input);
  if (prepared.contextKind !== "annual_amount") throw new Error("Decreto anual não substitui fonte temporal ou judicial.");
  if (rows.length !== 2 || new Set(rows.map((row) => row.sourceKey)).size !== 2) throw new Error("Faltam dois IDs reais aprovados do corpo/anexo.");
  const expectedFacts = { policy: DECREE_COMPLEMENTARY_POLICY, amounts: PROCUREMENT_2026_AMOUNTS, statutoryNominalAmountsUnchanged: true, judicialRecontractingExcluded: true, coverageIsNotNormativeExpiry: true };
  for (const [index, key] of DECREE_SOURCE_KEYS.entries()) {
    const row = rows.find((item) => item.sourceKey === key);
    const expectedSource = index === 0 ? PROCUREMENT_CONTEXT_SOURCE.decree : PROCUREMENT_CONTEXT_SOURCE.annex;
    const expectedBodyHash = index === 0 ? DECREE_BODY_NORMALIZED_SHA : DECREE_ANNEX_NORMALIZED_SHA;
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(row.publicId) || row.legalActId !== legalActId || row.sourceUrl !== expectedSource.url || row.sourceKind !== (index === 0 ? "annual_decree_body" : "annual_decree_annex") || row.rawChecksumSha256 !== expectedSource.rawSha256 || row.normalizedChecksumSha256 !== expectedBodyHash || createHash("sha256").update(row.normalizedBody).digest("hex") !== expectedBodyHash || row.parserVersion !== DECREE_COMPLEMENTARY_PARSER || row.sourceActType !== "decreto" || row.sourceActNumber !== "12.807" || row.sourceActYear !== 2025 || row.status !== "approved" || row.humanReview || row.approvalReference !== OFFICIAL_LAW_STANDING_REFERENCE || row.approvalMode !== "owner_standing_authorization" || !row.approvalAuditId || !row.reviewedByUserId || !row.reviewedAt || row.normativeEffectiveFrom !== "2026-01-01" || row.normativeValidUntil !== null || row.editorialCoverageFrom !== "2026-01-01" || row.editorialCoverageThrough !== "2026-12-31" || !isDeepStrictEqual(row.facts, expectedFacts)) throw new Error("ID complementar sem estado, prova, período ou auditoria exatos.");
    const age = row.lastVerifiedAt ? now.getTime() - row.lastVerifiedAt.getTime() : Infinity;
    if (!Number.isFinite(age) || age < -30_000 || age > 6 * 60 * 60_000) throw new Error("Fonte complementar sem verificação recente; interromper consumo e recapturar oficialmente.");
    if (row.sourceValidityObservation.metadataUrl !== DECREE_METADATA_URL || row.sourceValidityObservation.metadataRawSha256 !== DECREE_METADATA_RAW_SHA || row.sourceValidityObservation.expressRevocationReported !== false || typeof row.sourceValidityObservation.observedAt !== "string" || !Number.isFinite(Date.parse(row.sourceValidityObservation.observedAt)) || !/^[a-f0-9]{64}$/u.test(row.evidenceFingerprint)) throw new Error("Observação da validade/fingerprint complementar não conferida.");
  }
  if (rows[0].reviewedByUserId !== rows[1].reviewedByUserId || rows[0].reviewedAt?.getTime() !== rows[1].reviewedAt?.getTime() || rows[0].approvalAuditId !== rows[1].approvalAuditId || rows[0].evidenceFingerprint !== rows[1].evidenceFingerprint || rows[0].id === rows[1].id) throw new Error("Corpo/anexo não pertencem ao mesmo par auditado.");
  const ordered = DECREE_SOURCE_KEYS.map((key) => rows.find((row) => row.sourceKey === key)!);
  const context = { ...prepared, legalActId, status: "approved_dependency_context" as const, sourceIds: ordered.map((row) => row.id), sourceReceipts: ordered.map((row) => ({ id: row.id, publicId: row.publicId, sourceKey: row.sourceKey, sourceUrl: row.sourceUrl, rawChecksumSha256: row.rawChecksumSha256, normalizedChecksumSha256: row.normalizedChecksumSha256, approvalAuditId: row.approvalAuditId, reviewedAt: row.reviewedAt!.toISOString(), lastVerifiedAt: row.lastVerifiedAt!.toISOString(), verificationLeaseExpiresAt: new Date(row.lastVerifiedAt!.getTime() + 21_600_000).toISOString(), evidenceFingerprint: row.evidenceFingerprint, humanReview: false as const })), lawArticleReviewStillRequired: true as const, questionApprovalStillRequired: true as const, publicationAllowed: false as const };
  // Verification freshness is enforced separately on every consumption, while
  // the content fingerprint stays stable when the same sources are recaptured.
  const fingerprintContent = { ...context, sourceReceipts: context.sourceReceipts.map((receipt) => ({ ...receipt, lastVerifiedAt: null, verificationLeaseExpiresAt: null })) };
  return { ...context, contentFingerprint: createHash("sha256").update(JSON.stringify(fingerprintContent)).digest("hex") };
}

export async function readApprovedDecreeAuthoringContext(db: Pick<PostgresJsDatabase, "select">, legalActId: number, input: Input) {
  const rows = await db.select().from(legalComplementarySources).where(and(eq(legalComplementarySources.legalActId, legalActId), inArray(legalComplementarySources.sourceKey, [...DECREE_SOURCE_KEYS]), eq(legalComplementarySources.status, "approved")));
  return attachApprovedDecreeSourceIds(input, rows, legalActId);
}
