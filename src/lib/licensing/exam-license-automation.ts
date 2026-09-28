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

type LicenseItem = Pick<
  RequestSource,
  "editionTitle" | "bookletTitle" | "bookletUrl" | "answerKeyTitle" | "answerKeyUrl"
>;

const REQUEST_TERMS = [
  "O uso pretendido compreende reprodução integral ou parcial dos enunciados e alternativas em banco autenticado; indexação por concurso, cargo, disciplina, assunto e dispositivo legal; comentários e estatísticas autorais; e, somente se autorizado, hospedagem de cópia do PDF.",
  "",
  "Pedimos que a resposta identifique o titular, os documentos e edições abrangidos, modalidades permitidas, atribuição exigida, prazo, território, preço, revogação, tratamento de questões anuladas e permissão ou vedação de armazenamento do PDF.",
  "",
  `A ${BRAND_NAME} manterá fonte oficial, versão, data e hash de cada evidência e não publicará o material como licenciado antes da formalização e revisão.`,
  "",
  `Atenciosamente,\nResponsável legal da ${BRAND_NAME}`,
];

function licenseItemLines(item: LicenseItem) {
  return [
    `• Caderno: ${item.bookletTitle}`,
    `  ${item.bookletUrl}`,
    `• Gabarito: ${item.answerKeyTitle}`,
    `  ${item.answerKeyUrl}`,
  ];
}

/** Um único pedido para várias provas da mesma banca (autorização do proprietário, 28/09/2026). */
export function buildConsolidatedLicenseText(items: readonly LicenseItem[]) {
  return [
    "À equipe responsável,",
    "",
    `A ${BRAND_NAME} é uma plataforma educacional de preparação para concursos. Solicitamos autorização expressa, não exclusiva e documentada para utilizar em produto digital pago os ${items.length} cadernos e gabaritos abaixo:`,
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.editionTitle}`,
      ...licenseItemLines(item),
      "",
    ]),
    ...REQUEST_TERMS,
  ].join("\n");
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
    ...licenseItemLines(source),
    "",
    ...REQUEST_TERMS,
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

type DueLicenseRequest = LicenseItem & {
  publicId: string;
  status: string;
  bankId: number;
  recipients: string[];
  subject: string;
  body: string;
  fingerprint: string;
  followUpCount: number;
};

export async function dispatchDueExamLicenseRequests(
  db: Database,
  sender: LicenseEmailSender,
  now = new Date(),
  limit = 25,
) {
  // O driver postgres-js do Drizzle não serializa Date em SQL bruto (ERR_INVALID_ARG_TYPE).
  const nowIso = now.toISOString();
  const due = await db.execute<DueLicenseRequest>(sql`
    select request.public_id as "publicId",request.status,request.bank_id::integer as "bankId",
      request.recipient_emails as recipients,request.subject,request.request_body as body,
      request.scope_fingerprint as fingerprint,request.follow_up_count::integer as "followUpCount",
      edition.title as "editionTitle",booklet.title as "bookletTitle",booklet.source_url as "bookletUrl",
      answer_key.title as "answerKeyTitle",answer_key.source_url as "answerKeyUrl"
    from exam_license_requests request
    join exam_editions edition on edition.id=request.exam_edition_id
    join exam_edition_documents booklet on booklet.exam_edition_id=edition.id
      and booklet.document_type='question_booklet' and booklet.status='approved'
    join exam_edition_documents answer_key on answer_key.exam_edition_id=edition.id
      and answer_key.document_type='answer_key' and answer_key.status='approved'
    where request.status='prepared'
      or (request.status='awaiting_response' and request.next_follow_up_at <= ${nowIso}::timestamptz)
    order by coalesce(request.next_follow_up_at,request.created_at),request.created_at
    limit ${limit}
  `);

  let sent = 0;
  let deferred = 0;
  let manualReview = 0;
  let emails = 0;
  // Pedidos da mesma banca na mesma etapa seguem juntos: um e-mail por destinatário.
  const groups = new Map<string, { stage: number; requests: DueLicenseRequest[] }>();
  for (const request of due) {
    const stage = request.status === "prepared" ? 0 : request.followUpCount + 1;
    if (stage > MAX_LICENSE_FOLLOW_UPS) {
      await db.execute(sql`
        update exam_license_requests set status='manual_review',next_follow_up_at=null,
          review_notes='Três acompanhamentos automáticos concluídos sem resposta registrada.',updated_at=${nowIso}::timestamptz
        where public_id=${request.publicId} and status='awaiting_response'
      `);
      manualReview += 1;
      continue;
    }
    const key = `${request.bankId}:${stage}`;
    const group = groups.get(key) ?? { stage, requests: [] };
    group.requests.push(request);
    groups.set(key, group);
  }

  for (const { stage, requests } of groups.values()) {
    const byRecipient = new Map<string, DueLicenseRequest[]>();
    for (const request of requests) {
      for (const recipient of request.recipients) {
        byRecipient.set(recipient, [...(byRecipient.get(recipient) ?? []), request]);
      }
    }
    const failed = new Set<string>();
    const messageIds = new Map<string, string>();
    for (const [recipient, batch] of byRecipient) {
      const subject = batch.length === 1
        ? batch[0].subject
        : `Pedido de autorização comercial — ${batch.length} provas anteriores — ${BRAND_NAME}`;
      const text = batch.length === 1 ? batch[0].body : buildConsolidatedLicenseText(batch);
      try {
        const delivery = await sender({
          to: recipient,
          subject: stage ? `Acompanhamento ${stage}/3 — ${subject}` : subject,
          text: stage ? followUpBody(text, stage) : text,
          idempotencyKey: canonicalFingerprint({
            version: "exam-license-email-v2",
            stage,
            recipient,
            requests: batch.map((request) => `${request.publicId}:${request.fingerprint}`).sort(),
          }),
        });
        emails += 1;
        for (const request of batch) messageIds.set(request.publicId, delivery.messageId);
      } catch {
        for (const request of batch) failed.add(request.publicId);
      }
    }

    for (const request of requests) {
      // Sem todos os destinatários confirmados, o pedido volta no próximo ciclo.
      if (failed.has(request.publicId)) {
        deferred += 1;
        continue;
      }
      const nextFollowUpAt = stage >= MAX_LICENSE_FOLLOW_UPS
        ? null
        : followUpDate(now).toISOString();
      await db.execute(sql`
        update exam_license_requests set status=${stage >= MAX_LICENSE_FOLLOW_UPS ? "manual_review" : "awaiting_response"},
          requested_at=coalesce(requested_at,${nowIso}::timestamptz),
          last_follow_up_at=${stage ? nowIso : null}::timestamptz,
          next_follow_up_at=${nextFollowUpAt}::timestamptz,follow_up_count=${stage},
          last_provider_message_id=${messageIds.get(request.publicId) ?? ""},updated_at=${nowIso}::timestamptz
        where public_id=${request.publicId}
          and status=${request.status}
          and scope_fingerprint=${request.fingerprint}
      `);
      sent += 1;
    }
  }
  return { due: due.length, sent, deferred, manualReview, emails };
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

