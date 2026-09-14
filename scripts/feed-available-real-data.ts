import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { validateAvailableRealExamEditions } from "../src/lib/exams/available-real-data";
import { parseOfficialExamUrl } from "../src/lib/official-sources/exam-registry";
import { parseOpportunityApprovalReviewerIdentity, requireOpportunityApprovalDatabaseUrl } from "../src/lib/opportunities/approval-command";

type Transaction = postgres.TransactionSql;

function parseCommand(argv: readonly string[]) {
  if (argv.length === 0) return { apply: false } as const;
  if (argv.length === 1 && argv[0] === "--apply") return { apply: true } as const;
  throw new Error("Use sem argumentos para a prévia ou somente --apply para gravar.");
}

async function observeOfficialSource(bankSlug: string, url: string, expected: "text/html" | "application/pdf") {
  parseOfficialExamUrl(bankSlug, url);
  const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Fonte oficial indisponível (HTTP ${response.status}): ${url}`);
  parseOfficialExamUrl(bankSlug, response.url);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith(expected)) throw new Error(`Tipo inesperado ${contentType || "ausente"}: ${url}`);
  return { checkedAt: new Date().toISOString(), httpStatus: response.status, contentType };
}

async function loadOperator(transaction: Transaction, email: string | null) {
  const rows = email
    ? await transaction<{ id: string; role: string }[]>`select id::text as id, role from users where lower(email)=${email} limit 2 for key share`
    : await transaction<{ id: string; role: string }[]>`select id::text as id, role from users where role='admin' order by id limit 2 for key share`;
  if (rows.length !== 1 || rows[0].role !== "admin") throw new Error("A carga exige exatamente um administrador identificado.");
  return rows[0].id;
}

async function main() {
  const command = parseCommand(process.argv.slice(2));
  const reference = process.env.AVAILABLE_REAL_DATA_FEED_REFERENCE?.trim();
  if (!reference || !/^[a-z0-9][a-z0-9._:/-]{0,159}$/i.test(reference)) {
    throw new Error("Defina AVAILABLE_REAL_DATA_FEED_REFERENCE com a autorização desta carga.");
  }
  const reviewerIdentity = parseOpportunityApprovalReviewerIdentity({
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    OPPORTUNITY_APPROVAL_REFERENCE: reference,
  });
  const databaseUrl = requireOpportunityApprovalDatabaseUrl({ MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL });
  const editions = validateAvailableRealExamEditions();
  const observations = new Map<string, Awaited<ReturnType<typeof observeOfficialSource>>>();
  for (const edition of editions) {
    observations.set(edition.officialUrl, await observeOfficialSource(edition.bankSlug, edition.officialUrl, "text/html"));
    for (const document of edition.documents) {
      observations.set(document.sourceUrl, await observeOfficialSource(edition.bankSlug, document.sourceUrl, "application/pdf"));
    }
  }

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const preview = await client.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(172936, 20260913)`;
      const operatorId = await loadOperator(transaction, reviewerIdentity.email);
      const catalog = await transaction<{ bankId: string; bankSlug: string; careerId: string; careerSlug: string }[]>`
        select b.id::text as "bankId", b.slug as "bankSlug", c.id::text as "careerId", c.slug as "careerSlug"
        from quiz_banks b cross join quiz_career_tracks c where b.is_active=true and c.is_active=true
      `;
      const bankIds = new Map(catalog.map((row) => [row.bankSlug, row.bankId]));
      const careerIds = new Map(catalog.map((row) => [row.careerSlug, row.careerId]));
      const result = { editionsInserted: 0, editionsRefreshed: 0, opportunitiesLinked: 0, productsLinked: 0, documentsProposed: 0, documentsRefreshed: 0 };

      for (const edition of editions) {
        const bankId = bankIds.get(edition.bankSlug);
        const careerId = careerIds.get(edition.careerSlug);
        if (!bankId || !careerId) throw new Error(`Catálogo ativo ausente para ${edition.publicId}.`);
        const observation = observations.get(edition.officialUrl)!;
        const existing = await transaction<{ id: string; careerId: string; bankId: string; status: string; officialUrl: string; examDate: string; institutionAcronym: string | null; jurisdictionCode: string | null }[]>`
          select id::text as id, career_track_id::text as "careerId", bank_id::text as "bankId", status,
            official_url as "officialUrl", exam_date::text as "examDate", institution_acronym as "institutionAcronym",
            jurisdiction_code as "jurisdictionCode"
          from exam_editions where public_id=${edition.publicId} limit 1 for update
        `;
        let editionId: string;
        if (existing[0]) {
          const row = existing[0];
          if (row.careerId !== careerId || row.bankId !== bankId || row.status !== edition.status || row.officialUrl !== edition.officialUrl || row.examDate !== edition.examDate || row.institutionAcronym !== edition.institutionAcronym || row.jurisdictionCode !== edition.jurisdictionCode) {
            throw new Error(`Edição existente diverge do manifesto: ${edition.publicId}.`);
          }
          editionId = row.id;
          result.editionsRefreshed += 1;
          if (command.apply) await transaction`update exam_editions set source_http_status=${observation.httpStatus}, source_checked_at=${observation.checkedAt}, source_page_title=${edition.title}, updated_by_user_id=${operatorId}, updated_at=now() where id=${editionId}`;
        } else {
          result.editionsInserted += 1;
          if (!command.apply) {
            editionId = `preview:${edition.publicId}`;
          } else {
            const inserted = await transaction<{ id: string }[]>`
              insert into exam_editions (public_id,career_track_id,specialization_id,bank_id,institution_acronym,jurisdiction_code,source_external_id,title,organizer,jurisdiction,official_url,exam_date,duration_minutes,status,source_policy,source_content_stored,source_page_title,source_http_status,source_checked_at,created_by_user_id,updated_by_user_id)
              values (${edition.publicId},${careerId},null,${bankId},${edition.institutionAcronym},${edition.jurisdictionCode},${edition.sourceExternalId},${edition.title},${edition.organizer},${edition.jurisdiction},${edition.officialUrl},${edition.examDate},${edition.durationMinutes},${edition.status},'metadata_only',false,${edition.title},${observation.httpStatus},${observation.checkedAt},${operatorId},${operatorId}) returning id::text as id
            `;
            editionId = inserted[0].id;
          }
        }

        if (edition.opportunitySlug) {
          const opportunities = await transaction<{ id: string; examEditionId: string | null; careerId: string; institutionAcronym: string; jurisdictionCode: string; examDate: string | null; editorialStatus: string }[]>`
            select id::text as id, exam_edition_id::text as "examEditionId", career_track_id::text as "careerId", institution_acronym as "institutionAcronym", jurisdiction_code as "jurisdictionCode", exam_date::text as "examDate", editorial_status as "editorialStatus"
            from contest_opportunities where slug=${edition.opportunitySlug} limit 1 for update
          `;
          const opportunity = opportunities[0];
          if (!opportunity || opportunity.editorialStatus !== "reviewed" || opportunity.careerId !== careerId || opportunity.institutionAcronym !== edition.institutionAcronym || opportunity.jurisdictionCode !== edition.jurisdictionCode || opportunity.examDate !== edition.examDate) {
            throw new Error(`Oportunidade revisada incompatível: ${edition.opportunitySlug}.`);
          }
          if (opportunity.examEditionId && opportunity.examEditionId !== editionId) throw new Error(`Oportunidade já ligada a outra edição: ${edition.opportunitySlug}.`);
          if (!opportunity.examEditionId) {
            result.opportunitiesLinked += 1;
            if (command.apply) await transaction`update contest_opportunities set exam_edition_id=${editionId}, updated_by_user_id=${operatorId}, updated_at=now() where id=${opportunity.id}`;
          }
          if (!edition.productSlug) throw new Error(`Produto ausente para ${edition.publicId}.`);
          const products = await transaction<{ opportunityId: string | null; status: string }[]>`select opportunity_id::text as "opportunityId", status from contest_store_products where slug=${edition.productSlug} limit 1 for update`;
          const product = products[0];
          if (!product || product.status !== "draft") throw new Error(`Produto inexistente ou não está em rascunho: ${edition.productSlug}.`);
          if (product.opportunityId && product.opportunityId !== opportunity.id) throw new Error(`Produto já ligado a outra oportunidade: ${edition.productSlug}.`);
          if (!product.opportunityId) {
            result.productsLinked += 1;
            if (command.apply) await transaction`update contest_store_products set opportunity_id=${opportunity.id}, updated_at=now() where slug=${edition.productSlug}`;
          }
        }

        for (const document of edition.documents) {
          const documentObservation = observations.get(document.sourceUrl)!;
          const current = command.apply || !editionId.startsWith("preview:")
            ? await transaction<{ id: string; status: string }[]>`
                select id::text as id,status from exam_edition_documents where exam_edition_id=${editionId} and document_type=${document.documentType} and source_url=${document.sourceUrl} and status in ('pending_review','approved') order by id limit 1 for update
              `
            : [];
          if (current[0]) {
            result.documentsRefreshed += 1;
            if (command.apply && current[0].status === "pending_review") await transaction`update exam_edition_documents set source_checked_at=${documentObservation.checkedAt}, http_status=${documentObservation.httpStatus}, content_type=${documentObservation.contentType}, updated_at=now() where id=${current[0].id}`;
          } else {
            result.documentsProposed += 1;
            if (command.apply) {
              const sourceHost = new URL(document.sourceUrl).hostname.toLowerCase();
              await transaction`
                insert into exam_edition_documents (public_id,exam_edition_id,document_type,title,source_url,source_host,source_checked_at,http_status,content_type,file_name,expected_question_count,distribution_mode,source_policy,status,initiated_by_user_id)
                values (${randomUUID()},${editionId},${document.documentType},${document.title},${document.sourceUrl},${sourceHost},${documentObservation.checkedAt},${documentObservation.httpStatus},${documentObservation.contentType},${document.fileName},${document.expectedQuestionCount},'external_link','metadata_only','pending_review',${operatorId})
              `;
            }
          }
        }
      }

      if (command.apply) await transaction`
        insert into audit_logs (actor_user_id,action,entity_type,entity_id,metadata)
        values (${operatorId},'content.available_real_data_fed','real_data_feed',${reference},${JSON.stringify({ ...result, sourcePolicy: "metadata_only", sourceContentStored: false, previousExamPublicationAllowed: false })}::jsonb)
      `;
      return { operatorId, result };
    });
    console.log(JSON.stringify({ mode: command.apply ? "applied" : "preview", reference, sourcesChecked: observations.size, ...preview.result, sourcePolicy: "metadata_only", sourceContentStored: false, productsReleased: 0 }, null, 2));
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Falha na carga real disponível.", error instanceof Error ? error.message : "Erro desconhecido.");
  process.exitCode = 1;
});
