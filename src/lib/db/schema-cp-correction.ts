import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, jsonb, pgPolicy, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { auditLogs, legalActs, legalSourceSnapshots, legalTextSnapshots, legalVersions, users } from "./schema";

/** Amendment proof is separate from the canonical CP corpus. Owner writes; APP reads approved/current only. */
export const legalCpCorrectionEvidence = pgTable("legal_cp_correction_evidence", {
  id: bigint("id",{mode:"number"}).primaryKey().generatedAlwaysAsIdentity(), publicId:text("public_id").notNull().unique(),
  legalActId:bigint("legal_act_id",{mode:"number"}).notNull().references(()=>legalActs.id,{onDelete:"restrict"}),
  monitorSnapshotId:bigint("monitor_snapshot_id",{mode:"number"}).notNull().references(()=>legalSourceSnapshots.id,{onDelete:"restrict"}),
  textSnapshotId:bigint("text_snapshot_id",{mode:"number"}).notNull().references(()=>legalTextSnapshots.id,{onDelete:"restrict"}),
  legalVersionId:bigint("legal_version_id",{mode:"number"}).notNull().references(()=>legalVersions.id,{onDelete:"restrict"}),
  cpUrl:text("cp_url").notNull(), cpRawSha256:text("cp_raw_sha256").notNull(), canonicalSha256:text("canonical_sha256").notNull(), parserVersion:text("parser_version").notNull(),
  amendmentUrl:text("amendment_url").notNull(),amendmentRawSha256:text("amendment_raw_sha256").notNull(),amendmentHtml:text("amendment_html").notNull(),
  fetchedAt:timestamp("fetched_at",{withTimezone:true}).notNull(),amendmentFetchedAt:timestamp("amendment_fetched_at",{withTimezone:true}).notNull(),robotsSha256:text("robots_sha256").notNull(),
  fingerprint:text("fingerprint").notNull().unique(),status:text("status").notNull().default("pending_review"),
  reviewedByUserId:bigint("reviewed_by_user_id",{mode:"number"}).references(()=>users.id,{onDelete:"restrict"}),reviewedAt:timestamp("reviewed_at",{withTimezone:true}),
  approvalAuditId:bigint("approval_audit_id",{mode:"number"}).references(()=>auditLogs.id,{onDelete:"restrict"}),approvalReference:text("approval_reference"),humanReview:boolean("human_review").notNull().default(false),
  metadata:jsonb("metadata").notNull().$type<Record<string,unknown>>(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
}, t=>[
  index("legal_cp_correction_evidence_monitor_idx").on(t.monitorSnapshotId),index("legal_cp_correction_evidence_text_idx").on(t.textSnapshotId),index("legal_cp_correction_evidence_version_idx").on(t.legalVersionId),index("legal_cp_correction_evidence_reviewer_idx").on(t.reviewedByUserId),index("legal_cp_correction_evidence_audit_idx").on(t.approvalAuditId),
  check("legal_cp_correction_evidence_scope",sql`${t.legalActId}=17 AND ${t.parserVersion}='camara-cp-correction-preview-v1.0.0' AND ${t.cpUrl}='https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html' AND ${t.cpRawSha256}='57547f371c5dd6e609f453397d2098e3930876b03f7233096b0dff907832b3e4' AND ${t.canonicalSha256}='7cd4ac2c76ca87f8032df0bd0c369dcfe7b1458038cd956bd01e5d7b68d8323d' AND ${t.amendmentUrl}='https://www2.camara.leg.br/legin/fed/lei/2026/lei-15517-22-setembro-2026-800012-publicacaooriginal-181458-pl.html' AND ${t.amendmentRawSha256}='44775d6c3fc157dfd63467295a6aa025285b304f762995577c8773eadc6ce596'`),
  check("legal_cp_correction_evidence_content",sql`octet_length(${t.amendmentHtml}) BETWEEN 1000 AND 131072 AND ${t.amendmentRawSha256}=encode(sha256(convert_to(${t.amendmentHtml},'UTF8')),'hex')`),
  check("legal_cp_correction_evidence_hash",sql`${t.fingerprint} ~ '^[a-f0-9]{64}$' AND ${t.robotsSha256} ~ '^[a-f0-9]{64}$'`),
  check("legal_cp_correction_evidence_status",sql`${t.status} IN('pending_review','approved','suspended','rejected','superseded')`),
  check("legal_cp_correction_evidence_public_id",sql`${t.publicId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  check("legal_cp_correction_evidence_metadata",sql`coalesce(jsonb_typeof(${t.metadata})='object' AND ${t.metadata}->>'policy'='cp63-camara402-enac5-v1' AND ${t.metadata}->>'fingerprint'=${t.fingerprint} AND ${t.metadata}->>'approvalMode'='owner_standing_authorization' AND ${t.metadata}->'humanReview'='false'::jsonb AND jsonb_typeof(${t.metadata}->'corrections')='array' AND jsonb_array_length(${t.metadata}->'corrections')=5 AND jsonb_typeof(${t.metadata}->'articleMap')='array' AND jsonb_array_length(${t.metadata}->'articleMap')=402,false)`),
  check("legal_cp_correction_evidence_approval",sql`NOT ${t.humanReview} AND (${t.status}<>'approved' OR (${t.approvalReference}='owner-standing-2026-10-12:official-sources-programs' AND ${t.approvalReference} IS NOT NULL AND ${t.approvalAuditId} IS NOT NULL AND ${t.reviewedByUserId} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL))`),
  pgPolicy("legal_cp_correction_evidence_read_approved",{for:"select",to:"public",using:sql`${t.status}='approved' AND EXISTS(SELECT 1 FROM legal_versions v JOIN legal_source_snapshots m ON m.id=${t.monitorSnapshotId} JOIN legal_text_snapshots s ON s.id=${t.textSnapshotId} WHERE v.id=${t.legalVersionId} AND v.legal_act_id=${t.legalActId} AND m.legal_act_id=v.legal_act_id AND s.legal_act_id=v.legal_act_id AND s.monitor_snapshot_id=m.id AND v.status='current' AND m.status='approved' AND s.status='approved' AND v.checksum_sha256=${t.canonicalSha256} AND s.checksum_sha256=${t.canonicalSha256} AND m.checksum_sha256=${t.canonicalSha256})`}),
]).enableRLS();
