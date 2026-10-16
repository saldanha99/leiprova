import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../db/schema";
import { mprjFormatEvidenceSchema, type OfficialQuestionContract } from "./official-question-contract";
import { MPRJ_MC5_FORMAT_EVIDENCE as target, type MprjMc5FormatObservation } from "./mprj-format-evidence";

const documentSchema = z.object({
  id: z.number().int().positive(), publicId: z.uuid(), editionId: z.literal(41), editionPublicId: z.literal("mprj-promotor-substituto-xxxix-2026-preambular"), bankId: z.number().int().positive(),
  bankSlug: z.literal("fgv"), bankActive: z.literal(true), roleName: z.literal(target.roleName),
  institution: z.literal("MPRJ"), jurisdiction: z.literal("RJ"), notice: z.literal("XXXIX/2026"),
  opportunityPublicId: z.literal("31739f51-3b4b-4984-a272-54fb549c034d"),
  cycleYear: z.literal(2026), specializationId: z.null(), editionInstitution: z.literal("MPRJ"), editionJurisdiction: z.literal("RJ"),
  editionSourcePolicy: z.literal("metadata_only"), editionSourceContentStored: z.literal(false),
  documentType: z.literal("question_booklet"), title: z.literal("MPRJ XXXIX/2026 — prova preambular — caderno Tipo 1"),
  sourceUrl: z.literal(target.sourceUrl), sourceHost: z.literal("conhecimento.fgv.br"), status: z.literal("approved"),
  sourcePolicy: z.literal("metadata_only"), distributionMode: z.literal("external_link"), storageKey: z.null(), byteLength: z.null(),
  httpStatus: z.literal(200), contentType: z.string().regex(/^application\/pdf(?:;.*)?$/u),
  expectedQuestionCount: z.literal(100), publishedOn: z.literal("2026-06-01"), checksum: z.string().regex(/^[a-f0-9]{64}$/u).nullable(),
  documentUpdatedAt: z.string(), editionUpdatedAt: z.string(), opportunityUpdatedAt: z.string(),
});
export type MprjFormatDocument = z.infer<typeof documentSchema>;

/** Pure, strict plan; no source text/bytes can enter its persisted fields. */
export function planMprjFormatEvidence(contract: OfficialQuestionContract, rawDocument: unknown,
  observation: MprjMc5FormatObservation, verificationDate: string) {
  const document = documentSchema.parse(rawDocument);
  if (contract.opportunityId !== 20 || contract.examEditionId !== 41 || contract.bankId !== document.bankId ||
    contract.roleName !== target.roleName || contract.noticeNumber !== target.noticeNumber || contract.cycleYear !== 2026 ||
    contract.specializationId !== null || contract.format !== "multiple_choice" ||
    observation.sourceUrl !== target.sourceUrl || (document.checksum !== null && document.checksum !== observation.sourceSha256)) {
    throw new Error("Identidade, banca ou SHA da capa diverge do documento aprovado.");
  }
  const facts = mprjFormatEvidenceSchema.omit({ evidenceId: true, documentPublicId: true }).parse({ ...observation, verificationDate });
  const evidenceId = createHash("sha256").update(JSON.stringify({ version: 1, document, facts })).digest("hex");
  return { document, evidence: mprjFormatEvidenceSchema.parse({ ...facts, evidenceId, documentPublicId: document.publicId }) };
}

/** Called within the existing reviewer transaction, after the opportunity row lock. */
export async function readMprjFormatDocument(tx: Pick<PostgresJsDatabase<typeof schema>, "execute">, apply: boolean) {
  if (apply) {
    await tx.execute(sql`select id from exam_editions where id=41 for share`);
    await tx.execute(sql`select id from exam_edition_documents where exam_edition_id=41 and document_type='question_booklet' order by id for share`);
  }
  const documents = await tx.execute(sql`
    select d.id::int id,d.public_id as "publicId",d.exam_edition_id::int as "editionId",e.public_id as "editionPublicId",e.bank_id::int as "bankId",
      b.slug as "bankSlug",b.is_active as "bankActive",o.role_name as "roleName",o.institution_acronym institution,
      o.jurisdiction_code jurisdiction,o.official_notice_number notice,o.public_id as "opportunityPublicId",
      o.cycle_year as "cycleYear",o.specialization_id as "specializationId",e.institution_acronym as "editionInstitution",
      e.jurisdiction_code as "editionJurisdiction",e.source_policy as "editionSourcePolicy",e.source_content_stored as "editionSourceContentStored",d.document_type as "documentType",d.title,d.source_url as "sourceUrl",
      d.source_host as "sourceHost",d.status,d.source_policy as "sourcePolicy",d.distribution_mode as "distributionMode",
      d.storage_key as "storageKey",d.byte_length as "byteLength",d.http_status as "httpStatus",d.content_type as "contentType",
      d.expected_question_count as "expectedQuestionCount",(d.published_at at time zone 'UTC')::date::text as "publishedOn",
      d.checksum_sha256 checksum,d.updated_at::text as "documentUpdatedAt",e.updated_at::text as "editionUpdatedAt",
      o.updated_at::text as "opportunityUpdatedAt"
    from exam_edition_documents d join exam_editions e on e.id=d.exam_edition_id
    join contest_opportunities o on o.id=20 and o.exam_edition_id=e.id join quiz_banks b on b.id=e.bank_id
    where e.id=41 and d.document_type='question_booklet' and d.status='approved' order by d.id`);
  if (documents.length !== 1) throw new Error("Exige exatamente um caderno Tipo 1 aprovado; duplicata ou ausência bloqueia.");
  return documentSchema.parse(documents[0]);
}
