import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { approvedProductQuestionCount } from "../commerce/minimum-course-content";
import { CAMARA_CP_CORRECTION, CP63_EXPECTED_HELD_IDS, cpCorrectionSha256 } from "../official-sources/camara-cp-correction-parser";
import { CP_CUT_REFERENCE, assertCpCutFresh } from "../official-sources/cp-coordinated-cut";
import {
  CP_ACT_ID,
  CP_MONITOR_SNAPSHOT_ID,
  CP_RECEIPT_ID,
  CP_SUSPENSION_AUDIT_ID,
  CP_TEXT_SNAPSHOT_ID,
  CP_CUT_INITIAL_AUDIT_ID,
  CP_V112_ID,
  validateCpReconciliationContext,
  type FreshCpEvidence,
  type Tx,
} from "./cp-reconciliation-preview";

export const CP_RECONCILIATION_APPLY_POLICY = "cp-post-suspension-reconciliation-v1";

type Json = Record<string, unknown>;

export interface CpReconciliationApplyResult {
  mode: "applied";
  fingerprint: string;
  versionId: number;
  auditId: number;
  receiptId: number;
  monitorSnapshotId: number;
  textSnapshotId: number;
  previousReceiptId: number;
  previousReceiptStatus: "suspended";
  approvalReference: string;
  humanReview: false;
  offers: Array<{ slug: string; before: number; after: number }>;
}

/**
 * Post-suspension reconciliation of the CP (act 17, version 112).
 *
 * Receipt 1 stays suspended (the DB forbids restoring a closed receipt). A fresh,
 * fully compared capture yields NEW approved snapshots, version 112 back to current
 * and a NEW receipt whose metadata inherits the original cut manifest (5 corrections,
 * 402-article map) plus the reconciliation trail. Nothing in questions, bindings,
 * certificates, requirement 667, version 63 or its 27 held articles is written.
 */
export async function applyCpReconciliation(
  tx: Tx,
  fresh: FreshCpEvidence,
  actorId: number,
  expectedFingerprint: string
): Promise<CpReconciliationApplyResult> {
  // Same fence/order as the owner verifier: advisory -> act -> versions -> snapshots.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('leiprova:cp-owner-maintenance:v1',0))`);
  await tx.execute(sql`select id from legal_acts where id=${CP_ACT_ID} for update`);
  await tx.execute(sql`select id from legal_versions where legal_act_id=${CP_ACT_ID} order by id for update`);
  await tx.execute(sql`select id from legal_source_snapshots where legal_act_id=${CP_ACT_ID} order by id for update`);
  await tx.execute(sql`select id from legal_text_snapshots where legal_act_id=${CP_ACT_ID} order by id for update`);
  await tx.execute(sql`select id from legal_cp_correction_evidence order by id for update`);

  const preview = await validateCpReconciliationContext(tx, fresh, { mode: "apply" });
  if (preview.fingerprint !== expectedFingerprint) {
    throw new Error("Contexto mudou desde a prévia (fingerprint divergente); nada gravado.");
  }

  const [approved] = await tx.execute<{ total: number }>(
    sql`select count(*)::int as total from legal_cp_correction_evidence where legal_act_id=${CP_ACT_ID} and status='approved'`
  );
  if (approved?.total !== 0) throw new Error("Já existe recibo CP aprovado; reconciliação não se repete.");

  const [previous] = await tx.execute<{ fingerprint: string; metadata: Json }>(
    sql`select fingerprint, metadata from legal_cp_correction_evidence where id=${CP_RECEIPT_ID} and status='suspended'`
  );
  if (!previous || typeof previous.metadata !== "object" || previous.metadata === null) {
    throw new Error("Recibo 1 suspenso ausente.");
  }

  const now = new Date();
  const canonical = fresh.parsed.articles.map(a => [a.path, "", a.literalText].join("\n")).join("\n\n");
  const notes = `${CP_RECONCILIATION_APPLY_POLICY}; recaptura Câmara confrontada integralmente (402) com Lei 15.517; recibo ${CP_RECEIPT_ID} permanece suspenso; ${CP_CUT_REFERENCE}; humanReview:false.`;

  // (legal_act_id, checksum) is unique, so the same corpus cannot get a new snapshot row.
  // The rejected 2757/1660 are re-approved only if their stored content equals the fresh
  // canonical body byte for byte; the original rejection stays in audit 10902.
  const fetchedAt = fresh.body.fetchedAt.toISOString();
  const [monitor] = await tx.execute<{ id: number; publicId: string }>(
    sql`update legal_source_snapshots set status='approved', reviewed_by_user_id=${actorId}, reviewed_at=${now.toISOString()}::timestamptz,
          review_notes=${notes}, last_seen_at=${fetchedAt}::timestamptz
        where id=${CP_MONITOR_SNAPSHOT_ID} and legal_act_id=${CP_ACT_ID} and status='rejected'
          and checksum_sha256=${CAMARA_CP_CORRECTION.canonicalSha256} and normalized_content=${canonical} and article_marker_count=402
        returning id::int as id, public_id as "publicId"`
  );
  const [text] = await tx.execute<{ id: number; publicId: string }>(
    sql`update legal_text_snapshots set status='approved', reviewed_by_user_id=${actorId}, reviewed_at=${now.toISOString()}::timestamptz,
          review_notes=${notes}, last_seen_at=${fetchedAt}::timestamptz, updated_at=${now.toISOString()}::timestamptz
        where id=${CP_TEXT_SNAPSHOT_ID} and legal_act_id=${CP_ACT_ID} and monitor_snapshot_id=${CP_MONITOR_SNAPSHOT_ID} and status='rejected'
          and checksum_sha256=${CAMARA_CP_CORRECTION.canonicalSha256} and normalized_content=${canonical} and article_count=402
          and parser_version=${fresh.parsed.parserVersion}
        returning id::int as id, public_id as "publicId"`
  );
  if (!monitor || !text) throw new Error("Snapshots 2757/1660 não conferem byte a byte com a captura fresca; revertido.");

  const promoted = await tx.execute<{ id: number }>(
    sql`update legal_versions set status='current', verified_at=${fresh.body.fetchedAt.toISOString()}::timestamptz
        where id=${CP_V112_ID} and legal_act_id=${CP_ACT_ID} and status='pending_review' returning id::int as id`
  );
  if (promoted.length !== 1) throw new Error("Versão 112 não estava pending_review; revertido.");
  const [otherCurrent] = await tx.execute<{ total: number }>(
    sql`select count(*)::int as total from legal_versions where legal_act_id=${CP_ACT_ID} and status='current' and id<>${CP_V112_ID}`
  );
  if (otherCurrent?.total !== 0) throw new Error("Outra versão CP está current; revertido.");

  const metadata: Json = {
    ...previous.metadata,
    fingerprint: expectedFingerprint,
    approvalReference: CP_CUT_REFERENCE,
    humanReview: false,
    rawSha256: fresh.parsed.rawSha256,
    amendmentRawSha256: cpCorrectionSha256(fresh.amendment.bytes),
    freshFetchedAt: fresh.body.fetchedAt.toISOString(),
    amendmentFetchedAt: fresh.amendment.fetchedAt.toISOString(),
    monitorId: monitor.id,
    textId: text.id,
    newVersionId: CP_V112_ID,
    reconciliation: {
      policy: CP_RECONCILIATION_APPLY_POLICY,
      previousReceiptId: CP_RECEIPT_ID,
      previousFingerprint: previous.fingerprint,
      initialCutAuditId: CP_CUT_INITIAL_AUDIT_ID,
      suspensionAuditId: CP_SUSPENSION_AUDIT_ID,
      suspensionReason: preview.auditTrail.suspensionReason,
      snapshotsReapproved: [monitor.id, text.id],
      offersProjected: preview.offers.products.map(p => ({ slug: p.slug, before: p.currentValidCount, after: p.projectedValidCount })),
      questionsModified: 0, bindingsModified: 0, requirementsModified: 0, productsReleased: 0, flagsChanged: 0, pricesChanged: 0,
    },
  };

  const [audit] = await tx.insert(schema.auditLogs).values({
    actorUserId: actorId, action: "editorial.legal_cp.coordinated_cut", entityType: "legal_text_snapshot", entityId: text.publicId, metadata,
  }).returning({ id: schema.auditLogs.id });

  const amendmentHtml = new TextDecoder("utf-8", { fatal: true }).decode(fresh.amendment.bytes);
  const [receipt] = await tx.execute<{ id: number }>(
    sql`insert into legal_cp_correction_evidence(public_id,legal_act_id,monitor_snapshot_id,text_snapshot_id,legal_version_id,cp_url,cp_raw_sha256,canonical_sha256,parser_version,amendment_url,amendment_raw_sha256,amendment_html,fetched_at,amendment_fetched_at,robots_sha256,fingerprint,status,reviewed_by_user_id,reviewed_at,approval_audit_id,approval_reference,human_review,metadata)
        values(${randomUUID()},${CP_ACT_ID},${monitor.id},${text.id},${CP_V112_ID},${CAMARA_CP_CORRECTION.url},${fresh.parsed.rawSha256},${fresh.parsed.canonicalSha256},${fresh.parsed.parserVersion},${CAMARA_CP_CORRECTION.amendmentUrl},${cpCorrectionSha256(fresh.amendment.bytes)},${amendmentHtml},${fresh.body.fetchedAt.toISOString()}::timestamptz,${fresh.amendment.fetchedAt.toISOString()}::timestamptz,${cpCorrectionSha256(fresh.robots.bytes)},${expectedFingerprint},'approved',${actorId},${now.toISOString()}::timestamptz,${audit.id},${CP_CUT_REFERENCE},false,${JSON.stringify(metadata)}::jsonb)
        returning id::int as id`
  );

  // Final checks inside the same transaction: real store predicate equals the projection.
  const after = await tx.execute<{ slug: string; count: number }>(
    sql`select p.slug, ${approvedProductQuestionCount(sql`p.slug`, sql`p.opportunity_id`)} as count
        from contest_store_products p where p.status='released' order by p.slug`
  );
  const projected = preview.offers.products;
  if (after.length !== projected.length || after.some((row, i) => row.slug !== projected[i].slug || row.count !== projected[i].projectedValidCount)) {
    throw new Error("Contagem real da loja difere da projeção; revertido.");
  }
  const held = await tx.execute<{ id: number }>(
    sql`select id::int as id from legal_articles where legal_version_id=63 and editorial_status='suspended' order by id`
  );
  if (JSON.stringify(held.map(a => a.id)) !== JSON.stringify([...CP63_EXPECTED_HELD_IDS].sort((a, b) => a - b))) {
    throw new Error("Suspensões da versão 63 alteradas; revertido.");
  }
  const [old] = await tx.execute<{ status: string }>(sql`select status from legal_cp_correction_evidence where id=${CP_RECEIPT_ID}`);
  if (old?.status !== "suspended") throw new Error("Recibo 1 deixou de estar suspenso; revertido.");
  assertCpCutFresh(fresh.body.fetchedAt);
  assertCpCutFresh(fresh.amendment.fetchedAt);

  return {
    mode: "applied",
    fingerprint: expectedFingerprint,
    versionId: CP_V112_ID,
    auditId: audit.id,
    receiptId: receipt.id,
    monitorSnapshotId: monitor.id,
    textSnapshotId: text.id,
    previousReceiptId: CP_RECEIPT_ID,
    previousReceiptStatus: "suspended",
    approvalReference: CP_CUT_REFERENCE,
    humanReview: false,
    offers: projected.map(p => ({ slug: p.slug, before: p.currentValidCount, after: p.projectedValidCount })),
  };
}
