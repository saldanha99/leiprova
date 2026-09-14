import { createHash, randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";
import { BRAND_NAME } from "@/lib/brand";

export const LICENSE_FOLLOW_UP_DAYS = 7;
export const MAX_LICENSE_FOLLOW_UPS = 3;

type Database = PostgresJsDatabase<typeof schema>;

type RequestSource = Readonly<{
  editionId: number;
  editionPublicId: string;
  editionTitle: string;
  institutionAcronym: string;
  bankId: number;
  bankSlug: string;
  bookletTitle: string;
  bookletUrl: string;
  answerKeyTitle: string;
  answerKeyUrl: string;
}>;

export type LicenseRequestDraft = Readonly<{
  recipients: string[];
  subject: string;
  body: string;
  fingerprint: string;
}>;

export type LicenseEmail = Readonly<{
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}>;

export type LicenseEmailSender = (
  message: LicenseEmail,
) => Promise<{ messageId: string }>;

const bankContacts: Record<string, readonly string[]> = {
  cebraspe: ["sac@cebraspe.org.br"],
  fcc: ["contratar@fcc.org.br"],
  vunesp: ["comercial@vunesp.com.br", "planejamento@vunesp.com.br"],
};

function fgvContacts(institutionAcronym: string) {
  if (institutionAcronym === "CNJ") {
    return ["enac@fgv.br", "demanda.conhecimento@fgv.br"];
  }
  if (institutionAcronym === "ENFAM") {
    return ["examemagistratura@fgv.br", "demanda.conhecimento@fgv.br"];
  }
  return ["demanda.conhecimento@fgv.br"];
}

function canonicalFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildLicenseRequestDraft(
  source: RequestSource,
): LicenseRequestDraft | null {
  const recipients = source.bankSlug === "fgv"
    ? fgvContacts(source.institutionAcronym)
    : [...(bankContacts[source.bankSlug] ?? [])];
  if (!recipients.length) return null;

  const subject = `Pedido de autorização comercial — ${source.editionTitle} — ${BRAND_NAME}`;
  const body = [
    "À equipe responsável,",
    "",
    `A ${BRAND_NAME} é uma plataforma educacional de preparação para concursos. Solicitamos autorização expressa, não exclusiva e documentada para utilizar o caderno e o gabarito abaixo em produto digital pago:`,
    "",
    `• Caderno: ${source.bookletTitle}`,
    `  ${source.bookletUrl}`,
    `• Gabarito: ${source.answerKeyTitle}`,
    `  ${source.answerKeyUrl}`,
    "",
    "O uso pretendido compreende reprodução integral ou parcial dos enunciados e alternativas em banco autenticado; indexação por concurso, cargo, disciplina, assunto e dispositivo legal; comentários e estatísticas autorais; e, somente se autorizado, hospedagem de cópia do PDF.",
    "",
    "Pedimos que a resposta identifique o titular, os documentos e edições abrangidos, modalidades permitidas, atribuição exigida, prazo, território, preço, revogação, tratamento de questões anuladas e permissão ou vedação de armazenamento do PDF.",
    "",
    `A ${BRAND_NAME} manterá fonte oficial, versão, data e hash de cada evidência e não publicará o material como licenciado antes da formalização e revisão.`,
    "",
    `Atenciosamente,\nResponsável legal da ${BRAND_NAME}`,
  ].join("\n");
  const fingerprint = canonicalFingerprint({
    version: "exam-license-request-v1",
    editionPublicId: source.editionPublicId,
    bankSlug: source.bankSlug,
    institutionAcronym: source.institutionAcronym,
    recipients,
    subject,
    body,
  });
  return { recipients, subject, body, fingerprint };
}

function followUpDate(now: Date) {
  return new Date(now.getTime() + LICENSE_FOLLOW_UP_DAYS * 86_400_000);
}

async function loadEligibleSources(db: Database) {
  return db.execute<RequestSource>(sql`
    select
      edition.id::integer as "editionId",
      edition.public_id as "editionPublicId",
      edition.title as "editionTitle",
      edition.institution_acronym as "institutionAcronym",
      bank.id::integer as "bankId",
      bank.slug as "bankSlug",
      booklet.title as "bookletTitle",
      booklet.source_url as "bookletUrl",
      answer_key.title as "answerKeyTitle",
      answer_key.source_url as "answerKeyUrl"
    from exam_editions edition
    join quiz_banks bank on bank.id = edition.bank_id and bank.is_active
    join exam_edition_documents booklet
      on booklet.exam_edition_id = edition.id
      and booklet.document_type = 'question_booklet'
      and booklet.status = 'approved'
      and booklet.distribution_mode = 'external_link'
    join exam_edition_documents answer_key
      on answer_key.exam_edition_id = edition.id
      and answer_key.document_type = 'answer_key'
      and answer_key.status = 'approved'
      and answer_key.distribution_mode = 'external_link'
    where edition.status in ('held','published')
      and edition.exam_date < (current_timestamp at time zone 'America/Sao_Paulo')::date
      and booklet.source_policy in ('metadata_only','licensed_content')
      and answer_key.source_policy in ('metadata_only','licensed_content')
    order by edition.exam_date desc, edition.id desc
  `);
}

export async function prepareExamLicenseRequests(
  db: Database,
  ownerUserId: number,
) {
  const sources = await loadEligibleSources(db);
  let created = 0;
  let unchanged = 0;
  let manualReview = 0;
  let unsupportedBank = 0;

  for (const source of sources) {
    const draft = buildLicenseRequestDraft(source);
    if (!draft) {
      unsupportedBank += 1;
      continue;
    }
    const [existing] = await db.execute<{
      publicId: string;
      status: string;
      scopeFingerprint: string;
    }>(sql`
      select public_id as "publicId", status,
        scope_fingerprint as "scopeFingerprint"
      from exam_license_requests
      where exam_edition_id = ${source.editionId}
      limit 1
    `);
    if (!existing) {
      const publicId = randomUUID();
      await db.execute(sql`
        insert into exam_license_requests (
          public_id, exam_edition_id, bank_id, status, recipient_emails,
          subject, request_body, scope_fingerprint, initiated_by_user_id
        ) values (
          ${publicId}, ${source.editionId}, ${source.bankId}, 'prepared',
          ${JSON.stringify(draft.recipients)}::jsonb, ${draft.subject},
          ${draft.body}, ${draft.fingerprint}, ${ownerUserId}
        )
      `);
      await db.insert(schema.auditLogs).values({
        actorUserId: ownerUserId,
        action: "automation.exam_license.prepared",
        entityType: "exam_license_request",
        entityId: publicId,
        metadata: {
          editionPublicId: source.editionPublicId,
          scopeFingerprint: draft.fingerprint,
          recipientCount: draft.recipients.length,
          publicationAllowed: false,
        },
      });
      created += 1;
      continue;
    }
    if (existing.scopeFingerprint === draft.fingerprint) {
      unchanged += 1;
      continue;
    }
    if (existing.status === "prepared") {
      await db.execute(sql`
        update exam_license_requests set recipient_emails=${JSON.stringify(draft.recipients)}::jsonb,
          subject=${draft.subject},request_body=${draft.body},scope_fingerprint=${draft.fingerprint},updated_at=now()
        where public_id=${existing.publicId} and status='prepared'
      `);
      unchanged += 1;
    } else {
      await db.execute(sql`
        update exam_license_requests set status='manual_review',next_follow_up_at=null,
          review_notes='O escopo oficial mudou depois do envio; confira os documentos antes de novo contato.',updated_at=now()
        where public_id=${existing.publicId} and status not in ('granted','denied','expired','cancelled')
      `);
      manualReview += 1;
    }
  }
  return { eligibleEditions: sources.length, created, unchanged, manualReview, unsupportedBank };
}

function followUpBody(body: string, followUpNumber: number) {
  return [
    `Olá. Este é o ${followUpNumber}º acompanhamento do pedido abaixo.`,
    "",
    "Pedimos, por gentileza, a confirmação do recebimento e o encaminhamento ao titular ou setor jurídico/comercial responsável.",
    "",
    "--- pedido original ---",
    body,
  ].join("\n");
}

export async function dispatchDueExamLicenseRequests(
  db: Database,
  sender: LicenseEmailSender,
  now = new Date(),
  limit = 4,
) {
  const due = await db.execute<{
    publicId: string;
    status: string;
    recipients: string[];
    subject: string;
    body: string;
    fingerprint: string;
    followUpCount: number;
  }>(sql`
    select public_id as "publicId",status,recipient_emails as recipients,
      subject,request_body as body,scope_fingerprint as fingerprint,
      follow_up_count::integer as "followUpCount"
    from exam_license_requests
    where status='prepared'
      or (status='awaiting_response' and next_follow_up_at <= ${now})
    order by coalesce(next_follow_up_at,created_at),created_at
    limit ${limit}
  `);

  let sent = 0;
  let deferred = 0;
  let manualReview = 0;
  for (const request of due) {
    const followUpNumber = request.status === "prepared"
      ? 0
      : request.followUpCount + 1;
    if (followUpNumber > MAX_LICENSE_FOLLOW_UPS) {
      await db.execute(sql`
        update exam_license_requests set status='manual_review',next_follow_up_at=null,
          review_notes='Três acompanhamentos automáticos concluídos sem resposta registrada.',updated_at=${now}
        where public_id=${request.publicId} and status='awaiting_response'
      `);
      manualReview += 1;
      continue;
    }
    try {
      let lastMessageId = "";
      for (const recipient of request.recipients) {
        const delivery = await sender({
          to: recipient,
          subject: followUpNumber
            ? `Acompanhamento ${followUpNumber}/3 — ${request.subject}`
            : request.subject,
          text: followUpNumber
            ? followUpBody(request.body, followUpNumber)
            : request.body,
          idempotencyKey: canonicalFingerprint({
            version: "exam-license-email-v1",
            requestPublicId: request.publicId,
            fingerprint: request.fingerprint,
            followUpNumber,
            recipient,
          }),
        });
        lastMessageId = delivery.messageId;
      }
      const nextFollowUpAt = followUpNumber >= MAX_LICENSE_FOLLOW_UPS
        ? null
        : followUpDate(now);
      await db.execute(sql`
        update exam_license_requests set status=${followUpNumber >= MAX_LICENSE_FOLLOW_UPS ? "manual_review" : "awaiting_response"},
          requested_at=coalesce(requested_at,${now}),
          last_follow_up_at=${followUpNumber ? now : null},
          next_follow_up_at=${nextFollowUpAt},follow_up_count=${followUpNumber},
          last_provider_message_id=${lastMessageId},updated_at=${now}
        where public_id=${request.publicId}
          and status=${request.status}
          and scope_fingerprint=${request.fingerprint}
      `);
      sent += 1;
    } catch {
      deferred += 1;
    }
  }
  return { due: due.length, sent, deferred, manualReview };
}

/** Uma resposta registrada não basta: o caso somente conclui quando os dois
 * documentos exatos já estão aprovados como `licensed_content`. */
export async function reconcileGrantedExamLicenseRequests(db: Database) {
  const rows = await db.execute<{ publicId: string }>(sql`
    update exam_license_requests request set status='granted',updated_at=now()
    where request.status='granted_pending_review'
      and exists (
        select 1 from exam_edition_documents booklet
        where booklet.exam_edition_id=request.exam_edition_id
          and booklet.document_type='question_booklet'
          and booklet.status='approved'
          and booklet.source_policy='licensed_content'
          and booklet.license_evidence_checksum_sha256=request.response_checksum_sha256
          and (booklet.license_expires_at is null or booklet.license_expires_at > now())
      )
      and exists (
        select 1 from exam_edition_documents answer_key
        where answer_key.exam_edition_id=request.exam_edition_id
          and answer_key.document_type='answer_key'
          and answer_key.status='approved'
          and answer_key.source_policy='licensed_content'
          and answer_key.license_evidence_checksum_sha256=request.response_checksum_sha256
          and (answer_key.license_expires_at is null or answer_key.license_expires_at > now())
      )
    returning request.public_id as "publicId"
  `);
  const expired = await db.execute<{ publicId: string }>(sql`
    update exam_license_requests set status='expired',updated_at=now()
    where status='granted' and expires_at is not null and expires_at <= now()
    returning public_id as "publicId"
  `);
  return { granted: rows.length, expired: expired.length };
}

