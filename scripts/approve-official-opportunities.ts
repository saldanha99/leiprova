import { randomUUID } from "node:crypto";

import postgres from "postgres";

import {
  organizerSlugForApproval,
  parseOpportunityApprovalCommand,
  parseOpportunityApprovalReviewerIdentity,
  requireOpportunityApprovalDatabaseUrl,
  type OpportunityApprovalReviewerIdentity,
} from "../src/lib/opportunities/approval-command";
import {
  assertOrganizerAssignmentsReconcilable,
  assertReviewedOrganizerAssignmentSet,
  type ExistingOrganizerAssignment,
  type OrganizerAssignmentIdentity,
} from "../src/lib/opportunities/assignment-reconciliation";
import { validateOfficialOpportunityApprovalBatch } from "../src/lib/opportunities/approval-policy";
import { saoPauloCalendarDate } from "../src/lib/opportunities/catalog-policy";
import {
  OFFICIAL_OPPORTUNITY_CANDIDATES,
  type InternalOpportunityCandidate,
  type InternalOpportunitySourceCandidate,
} from "../src/lib/opportunities/official-candidates";
import {
  checkOpportunitySourceMetadata,
  classifyOpportunitySourceHttpStatus,
} from "../src/lib/opportunities/source-metadata-check";
import {
  parseOfficialOpportunitySourceUrl,
  type OpportunitySourceMetadata,
} from "../src/lib/opportunities/source-monitor-policy";

type Transaction = postgres.TransactionSql;

type AdminRow = Readonly<{
  id: string;
  role: string;
}>;

type LookupRow = Readonly<{
  id: string;
  slug: string;
  isActive: boolean;
}>;

type CategoryCareerRow = Readonly<{
  categoryId: string;
  careerTrackId: string;
}>;

type ExistingOpportunityRow = Readonly<{
  id: string;
  publicId: string;
  slug: string;
  categoryId: string;
  careerTrackId: string;
  specializationId: string | null;
  jurisdictionCode: string;
  scope: string;
  cycleYear: number;
  institutionAcronym: string;
  institutionName: string;
  roleName: string;
  officialNoticeNumber: string | null;
  title: string;
  summary: string;
  lifecycleStatus: string;
  statusAsOf: string;
  officialUrl: string | null;
  announcedAt: string | null;
  noticePublishedAt: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  examDate: string | null;
  editorialStatus: string;
  createdByUserId: string | null;
}>;

type ExistingSourceRow = Readonly<{
  id: string;
  opportunityId: string;
  documentType: string;
  title: string;
  sourceUrl: string;
  sourceHost: string;
  sourcePolicy: string;
  sourceContentStored: boolean;
  status: string;
  initiatedByUserId: string | null;
}>;

type ExistingAssignmentRow = ExistingOrganizerAssignment & Readonly<{
  id: string;
  quizBankId: string | null;
  sourceDocumentId: string;
  responsibleType: string;
  organizerName: string;
  validFrom: string;
}>;

type SourceCheck = Readonly<{
  source: InternalOpportunitySourceCandidate;
  observation: OpportunitySourceMetadata;
}>;

class OpportunitySourceCheckError extends Error {
  readonly source: InternalOpportunitySourceCandidate;
  readonly httpStatus: number | null;

  constructor(
    source: InternalOpportunitySourceCandidate,
    detail: string,
    httpStatus: number | null = null,
  ) {
    super(`A fonte ${source.url} não pôde ser comprovada: ${detail}`);
    this.name = "OpportunitySourceCheckError";
    this.source = source;
    this.httpStatus = httpStatus;
  }
}

const REVIEW_NOTE =
  "Conteúdo e fatos conferidos editorialmente nas fontes oficiais, com aprovação explícita do proprietário; persistência metadata_only verificada por HEAD, sem armazenar o conteúdo da fonte.";

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Falha sem detalhe seguro.";
}

function sourceKey(source: Pick<InternalOpportunitySourceCandidate, "sourceId" | "url">) {
  return `${source.sourceId}:${source.url}`;
}

function sourceTitle(
  candidate: InternalOpportunityCandidate,
  source: InternalOpportunitySourceCandidate,
) {
  return `${candidate.title} — ${source.documentType} (${source.publisher})`;
}

function assertSameMaterialFields(
  candidate: InternalOpportunityCandidate,
  label: string,
  actual: Readonly<Record<string, unknown>>,
  expected: Readonly<Record<string, unknown>>,
) {
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (actual[field] !== expectedValue) {
      throw new Error(
        `[${candidate.slug}] ${label} já revisado diverge no campo ${field}; retorne-o manualmente para revisão antes de alterar.`,
      );
    }
  }
}

async function checkAllSources() {
  const uniqueSources = [
    ...new Map(
      OFFICIAL_OPPORTUNITY_CANDIDATES.flatMap((candidate) => candidate.officialSources).map(
        (source) => [sourceKey(source), source] as const,
      ),
    ).values(),
  ];
  const checks: SourceCheck[] = [];

  for (const source of uniqueSources) {
    try {
      const observation = await checkOpportunitySourceMetadata(source);
      const disposition = classifyOpportunitySourceHttpStatus(observation.httpStatus);
      if (disposition === "failed") {
        throw new OpportunitySourceCheckError(
          source,
          `HTTP ${observation.httpStatus}; a aprovação foi bloqueada`,
          observation.httpStatus,
        );
      }
      checks.push(Object.freeze({ source, observation }));
    } catch (error) {
      if (error instanceof OpportunitySourceCheckError) throw error;
      throw new OpportunitySourceCheckError(source, safeError(error));
    }
  }

  return Object.freeze(checks);
}

async function loadConfiguredReviewer(
  transaction: Transaction,
  reviewerIdentity: OpportunityApprovalReviewerIdentity,
) {
  const admins = reviewerIdentity.email
    ? await transaction<AdminRow[]>`
        select id::text as "id", role
        from users
        where lower(email) = ${reviewerIdentity.email}
        limit 2
        for key share
      `
    : await transaction<AdminRow[]>`
        select id::text as "id", role
        from users
        where role = 'admin'
        order by id
        limit 2
        for key share
      `;
  const reviewer = admins[0];
  if (!reviewer || admins.length !== 1) {
    throw new Error(
      reviewerIdentity.email
        ? "O único administrador configurado em ADMIN_EMAILS não existe; nenhum usuário foi criado."
        : "O banco precisa conter exatamente um administrador quando ADMIN_EMAILS estiver vazio.",
    );
  }
  if (reviewer.role !== "admin") {
    throw new Error("O usuário configurado em ADMIN_EMAILS precisa possuir role admin.");
  }
  return reviewer;
}

async function loadCatalog(transaction: Transaction) {
  const [categoryRows, careerRows, categoryCareerRows, bankRows] = await Promise.all([
    transaction<LookupRow[]>`
      select id::text as "id", slug, is_active as "isActive"
      from contest_categories
    `,
    transaction<LookupRow[]>`
      select id::text as "id", slug, is_active as "isActive"
      from quiz_career_tracks
    `,
    transaction<CategoryCareerRow[]>`
      select category_id::text as "categoryId", career_track_id::text as "careerTrackId"
      from contest_category_careers
    `,
    transaction<LookupRow[]>`
      select id::text as "id", slug, is_active as "isActive"
      from quiz_banks
    `,
  ]);

  return {
    categories: new Map(categoryRows.filter((row) => row.isActive).map((row) => [row.slug, row.id])),
    careers: new Map(careerRows.filter((row) => row.isActive).map((row) => [row.slug, row.id])),
    categoryCareers: new Set(
      categoryCareerRows.map((row) => `${row.categoryId}:${row.careerTrackId}`),
    ),
    banks: new Map(bankRows.filter((row) => row.isActive).map((row) => [row.slug, row.id])),
  };
}

async function loadExistingOpportunity(
  transaction: Transaction,
  candidate: InternalOpportunityCandidate,
) {
  const rows = await transaction<ExistingOpportunityRow[]>`
    select
      id::text as "id",
      public_id as "publicId",
      slug,
      category_id::text as "categoryId",
      career_track_id::text as "careerTrackId",
      specialization_id::text as "specializationId",
      jurisdiction_code as "jurisdictionCode",
      scope,
      cycle_year as "cycleYear",
      institution_acronym as "institutionAcronym",
      institution_name as "institutionName",
      role_name as "roleName",
      official_notice_number as "officialNoticeNumber",
      title,
      summary,
      lifecycle_status as "lifecycleStatus",
      status_as_of::text as "statusAsOf",
      official_url as "officialUrl",
      announced_at::text as "announcedAt",
      notice_published_at::text as "noticePublishedAt",
      registration_starts_at::text as "registrationStartsAt",
      registration_ends_at::text as "registrationEndsAt",
      exam_date::text as "examDate",
      editorial_status as "editorialStatus",
      created_by_user_id::text as "createdByUserId"
    from contest_opportunities
    where slug = ${candidate.slug}
    limit 1
    for update
  `;
  return rows[0] ?? null;
}

async function assertNoIdentityCollision(
  transaction: Transaction,
  candidate: InternalOpportunityCandidate,
) {
  const rows = candidate.officialNoticeNumber
    ? await transaction<{ slug: string }[]>`
        select slug
        from contest_opportunities
        where institution_acronym = ${candidate.institutionAcronym}
          and official_notice_number = ${candidate.officialNoticeNumber}
          and cycle_year = ${candidate.cycleYear}
          and role_name = ${candidate.roleName}
          and slug <> ${candidate.slug}
        limit 1
        for update
      `
    : await transaction<{ slug: string }[]>`
        select slug
        from contest_opportunities
        where institution_acronym = ${candidate.institutionAcronym}
          and official_notice_number is null
          and cycle_year = ${candidate.cycleYear}
          and role_name = ${candidate.roleName}
          and jurisdiction_code = ${candidate.jurisdictionCode}
          and slug <> ${candidate.slug}
        limit 1
        for update
      `;

  if (rows[0]) {
    throw new Error(
      `[${candidate.slug}] a identidade oficial já pertence ao slug ${rows[0].slug}.`,
    );
  }
}

async function ensureOpportunity(
  transaction: Transaction,
  candidate: InternalOpportunityCandidate,
  categoryId: string,
  careerTrackId: string,
  reviewerUserId: string,
) {
  await assertNoIdentityCollision(transaction, candidate);
  const officialUrl = parseOfficialOpportunitySourceUrl(candidate.officialUrl).url;
  const expected = {
    categoryId,
    careerTrackId,
    specializationId: null,
    jurisdictionCode: candidate.jurisdictionCode,
    scope: candidate.scope,
    cycleYear: candidate.cycleYear,
    institutionAcronym: candidate.institutionAcronym,
    institutionName: candidate.institutionName,
    roleName: candidate.roleName,
    officialNoticeNumber: candidate.officialNoticeNumber,
    title: candidate.title,
    summary: candidate.summary,
    lifecycleStatus: candidate.lifecycleStatus,
    statusAsOf: candidate.statusAsOf,
    officialUrl,
    announcedAt: null,
    noticePublishedAt: candidate.noticePublishedAt,
    registrationStartsAt: candidate.registrationStartsAt,
    registrationEndsAt: candidate.registrationEndsAt,
    examDate: candidate.examDate,
  } as const;
  const existing = await loadExistingOpportunity(transaction, candidate);

  if (existing) {
    if (existing.editorialStatus === "reviewed") {
      assertSameMaterialFields(candidate, "oportunidade", existing, expected);
      return { id: existing.id, publicId: existing.publicId, changed: false, reviewed: true };
    }
    if (!['draft', 'pending_review'].includes(existing.editorialStatus)) {
      throw new Error(
        `[${candidate.slug}] oportunidade em estado ${existing.editorialStatus}; aprovação automática bloqueada.`,
      );
    }
    if (existing.createdByUserId === reviewerUserId) {
      throw new Error(
        `[${candidate.slug}] o administrador informado criou a oportunidade e não pode revisar o próprio registro.`,
      );
    }

    await transaction`
      update contest_opportunities
      set
        category_id = ${categoryId},
        career_track_id = ${careerTrackId},
        specialization_id = null,
        jurisdiction_code = ${candidate.jurisdictionCode},
        scope = ${candidate.scope},
        cycle_year = ${candidate.cycleYear},
        institution_acronym = ${candidate.institutionAcronym},
        institution_name = ${candidate.institutionName},
        role_name = ${candidate.roleName},
        official_notice_number = ${candidate.officialNoticeNumber},
        title = ${candidate.title},
        summary = ${candidate.summary},
        lifecycle_status = ${candidate.lifecycleStatus},
        status_as_of = ${candidate.statusAsOf},
        official_url = ${officialUrl},
        announced_at = null,
        notice_published_at = ${candidate.noticePublishedAt},
        registration_starts_at = ${candidate.registrationStartsAt},
        registration_ends_at = ${candidate.registrationEndsAt},
        exam_date = ${candidate.examDate},
        editorial_status = 'pending_review',
        published_at = null,
        updated_by_user_id = ${reviewerUserId},
        reviewed_by_user_id = null,
        reviewed_at = null,
        review_notes = null,
        updated_at = now()
      where id = ${existing.id}
    `;
    return { id: existing.id, publicId: existing.publicId, changed: true, reviewed: false };
  }

  const inserted = await transaction<{ id: string; publicId: string }[]>`
    insert into contest_opportunities (
      public_id,
      slug,
      category_id,
      career_track_id,
      specialization_id,
      jurisdiction_code,
      scope,
      cycle_year,
      institution_acronym,
      institution_name,
      role_name,
      official_notice_number,
      title,
      summary,
      lifecycle_status,
      status_as_of,
      official_url,
      announced_at,
      notice_published_at,
      registration_starts_at,
      registration_ends_at,
      exam_date,
      editorial_status,
      created_by_user_id,
      updated_by_user_id
    ) values (
      ${randomUUID()},
      ${candidate.slug},
      ${categoryId},
      ${careerTrackId},
      null,
      ${candidate.jurisdictionCode},
      ${candidate.scope},
      ${candidate.cycleYear},
      ${candidate.institutionAcronym},
      ${candidate.institutionName},
      ${candidate.roleName},
      ${candidate.officialNoticeNumber},
      ${candidate.title},
      ${candidate.summary},
      ${candidate.lifecycleStatus},
      ${candidate.statusAsOf},
      ${officialUrl},
      null,
      ${candidate.noticePublishedAt},
      ${candidate.registrationStartsAt},
      ${candidate.registrationEndsAt},
      ${candidate.examDate},
      'pending_review',
      null,
      ${reviewerUserId}
    )
    returning id::text as "id", public_id as "publicId"
  `;
  return { ...inserted[0], changed: true, reviewed: false };
}

async function ensureApprovedSource(
  transaction: Transaction,
  candidate: InternalOpportunityCandidate,
  source: InternalOpportunitySourceCandidate,
  observation: OpportunitySourceMetadata,
  opportunityId: string,
  reviewerUserId: string,
  approvedAt: string,
) {
  const registered = parseOfficialOpportunitySourceUrl(source.url, source.sourceId);
  const title = sourceTitle(candidate, source);
  const rows = await transaction<ExistingSourceRow[]>`
    select
      id::text as "id",
      opportunity_id::text as "opportunityId",
      document_type as "documentType",
      title,
      source_url as "sourceUrl",
      source_host as "sourceHost",
      source_policy as "sourcePolicy",
      source_content_stored as "sourceContentStored",
      status,
      initiated_by_user_id::text as "initiatedByUserId"
    from opportunity_source_documents
    where opportunity_id = ${opportunityId}
      and source_url = ${registered.url}
    limit 1
    for update
  `;
  const existing = rows[0] ?? null;
  const expected = {
    opportunityId,
    documentType: source.documentType,
    title,
    sourceUrl: registered.url,
    sourceHost: registered.hostname,
    sourcePolicy: "metadata_only",
    sourceContentStored: false,
  } as const;

  if (existing?.status === "approved") {
    assertSameMaterialFields(candidate, `fonte ${registered.url}`, existing, expected);
    await transaction`
      update opportunity_source_documents
      set
        last_seen_at = greatest(last_seen_at, ${observation.observedAt})
      where id = ${existing.id}
    `;
    return { id: existing.id, changed: false };
  }
  if (existing && !['pending_review'].includes(existing.status)) {
    throw new Error(
      `[${candidate.slug}] fonte ${registered.url} está ${existing.status}; aprovação bloqueada.`,
    );
  }
  if (existing?.initiatedByUserId === reviewerUserId) {
    throw new Error(
      `[${candidate.slug}] o administrador informado iniciou a fonte ${registered.url} e não pode revisar o próprio registro.`,
    );
  }

  if (existing) {
    await transaction`
      update opportunity_source_documents
      set
        document_type = ${source.documentType},
        title = ${title},
        source_url = ${registered.url},
        source_host = ${registered.hostname},
        observed_at = ${observation.observedAt},
        last_seen_at = ${observation.observedAt},
        checksum_sha256 = null,
        http_status = ${observation.httpStatus},
        content_type = ${observation.contentType},
        source_policy = 'metadata_only',
        source_content_stored = false,
        status = 'approved',
        reviewed_by_user_id = ${reviewerUserId},
        reviewed_at = ${approvedAt},
        review_notes = ${REVIEW_NOTE}
      where id = ${existing.id}
    `;
    return { id: existing.id, changed: true };
  }

  const inserted = await transaction<{ id: string }[]>`
    insert into opportunity_source_documents (
      public_id,
      opportunity_id,
      document_type,
      source_external_id,
      title,
      source_url,
      source_host,
      published_at,
      observed_at,
      last_seen_at,
      checksum_sha256,
      http_status,
      content_type,
      source_policy,
      source_content_stored,
      status,
      initiated_by_user_id,
      reviewed_by_user_id,
      reviewed_at,
      review_notes
    ) values (
      ${randomUUID()},
      ${opportunityId},
      ${source.documentType},
      null,
      ${title},
      ${registered.url},
      ${registered.hostname},
      null,
      ${observation.observedAt},
      ${observation.observedAt},
      null,
      ${observation.httpStatus},
      ${observation.contentType},
      'metadata_only',
      false,
      'approved',
      null,
      ${reviewerUserId},
      ${approvedAt},
      ${REVIEW_NOTE}
    )
    returning id::text as "id"
  `;
  return { id: inserted[0].id, changed: true };
}

async function reconcileReviewedAssignments(
  transaction: Transaction,
  candidate: InternalOpportunityCandidate,
  opportunityId: string,
  sourceDocumentIds: ReadonlyMap<string, string>,
  bankIds: ReadonlyMap<string, string>,
  reviewerUserId: string,
  approvedAt: string,
) {
  const rows = await transaction<ExistingAssignmentRow[]>`
    select
      id::text as "id",
      quiz_bank_id::text as "quizBankId",
      source_document_id::text as "sourceDocumentId",
      responsible_type as "responsibleType",
      role,
      organizer_slug as "organizerSlug",
      organizer_name as "organizerName",
      valid_from::text as "validFrom",
      valid_until::text as "validUntil",
      status
    from opportunity_organizer_assignments
    where opportunity_id = ${opportunityId}
    order by id
    for update
  `;
  const desired = candidate.organizerSignals.map((signal) => {
    const organizerSlug = organizerSlugForApproval({
      institutionAcronym: candidate.institutionAcronym,
      ...signal,
    });
    const canonicalSourceUrl = parseOfficialOpportunitySourceUrl(signal.sourceUrl).url;
    const sourceDocumentId = sourceDocumentIds.get(canonicalSourceUrl);
    if (!sourceDocumentId) {
      throw new Error(`[${candidate.slug}] fonte persistida do responsável não encontrada.`);
    }
    const quizBankId = signal.quizBankSlug ? (bankIds.get(signal.quizBankSlug) ?? null) : null;
    return { signal, organizerSlug, sourceDocumentId, quizBankId };
  });
  const desiredIdentities: OrganizerAssignmentIdentity[] = desired.map(
    ({ signal, organizerSlug }) => ({ role: signal.role, organizerSlug }),
  );

  assertOrganizerAssignmentsReconcilable(candidate.slug, desiredIdentities, rows);

  let changed = false;
  for (const target of desired) {
    const existing = rows.find(
      (row) =>
        row.validUntil === null &&
        row.role === target.signal.role &&
        row.organizerSlug === target.organizerSlug &&
        (row.status === "pending_review" || row.status === "reviewed"),
    );
    const expected = {
      quizBankId: target.quizBankId,
      sourceDocumentId: target.sourceDocumentId,
      responsibleType: target.signal.responsibleType,
      role: target.signal.role,
      organizerSlug: target.organizerSlug,
      organizerName: target.signal.organizationName,
      validFrom: candidate.statusAsOf,
    } as const;

    if (existing?.status === "reviewed") {
      assertSameMaterialFields(
        candidate,
        `responsável ${target.organizerSlug}`,
        existing,
        expected,
      );
      continue;
    }

    if (existing) {
      await transaction`
        update opportunity_organizer_assignments
        set
          quiz_bank_id = ${target.quizBankId},
          source_document_id = ${target.sourceDocumentId},
          responsible_type = ${target.signal.responsibleType},
          organizer_name = ${target.signal.organizationName},
          valid_from = ${candidate.statusAsOf},
          status = 'reviewed',
          reviewed_by_user_id = ${reviewerUserId},
          reviewed_at = ${approvedAt},
          review_notes = ${REVIEW_NOTE},
          updated_at = ${approvedAt}
        where id = ${existing.id}
      `;
      changed = true;
      continue;
    }

    await transaction`
      insert into opportunity_organizer_assignments (
        opportunity_id,
        quiz_bank_id,
        source_document_id,
        responsible_type,
        role,
        organizer_slug,
        organizer_name,
        valid_from,
        valid_until,
        status,
        reviewed_by_user_id,
        reviewed_at,
        review_notes
      ) values (
        ${opportunityId},
        ${target.quizBankId},
        ${target.sourceDocumentId},
        ${target.signal.responsibleType},
        ${target.signal.role},
        ${target.organizerSlug},
        ${target.signal.organizationName},
        ${candidate.statusAsOf},
        null,
        'reviewed',
        ${reviewerUserId},
        ${approvedAt},
        ${REVIEW_NOTE}
      )
    `;
    changed = true;
  }

  const reviewedRows = await transaction<OrganizerAssignmentIdentity[]>`
    select role, organizer_slug as "organizerSlug"
    from opportunity_organizer_assignments
    where opportunity_id = ${opportunityId}
      and status = 'reviewed'
      and valid_until is null
    order by role, organizer_slug
  `;
  assertReviewedOrganizerAssignmentSet(candidate.slug, desiredIdentities, reviewedRows);
  return { changed };
}

async function main() {
  const command = parseOpportunityApprovalCommand(process.argv.slice(2));
  const approvalEnvironment = {
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
    OPPORTUNITY_APPROVAL_REFERENCE: process.env.OPPORTUNITY_APPROVAL_REFERENCE,
  };
  const reviewerIdentity = parseOpportunityApprovalReviewerIdentity(approvalEnvironment);
  const databaseUrl = requireOpportunityApprovalDatabaseUrl(approvalEnvironment);
  const todayIso = saoPauloCalendarDate();
  const validations = validateOfficialOpportunityApprovalBatch(
    OFFICIAL_OPPORTUNITY_CANDIDATES,
    todayIso,
  );

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    let sourceChecks: readonly SourceCheck[];
    try {
      sourceChecks = await checkAllSources();
    } catch (error) {
      if (command.approve && error instanceof OpportunitySourceCheckError) {
        await client.begin(async (transaction) => {
          const reviewer = await loadConfiguredReviewer(transaction, reviewerIdentity);
          await transaction`
            insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
            values (
              ${reviewer.id},
              'opportunity.source_metadata_failed',
              'official_opportunity_source',
              ${error.source.sourceId},
              ${JSON.stringify({
                sourceUrl: error.source.url,
                httpStatus: error.httpStatus,
                failure: safeError(error),
                sourcePolicy: "metadata_only",
                sourceContentStored: false,
                executionSource: reviewerIdentity.executionSource,
                approvalReference: reviewerIdentity.approvalReference,
              })}::jsonb
            )
          `;
        });
      }
      throw error;
    }
    const sourceChecksByKey = new Map(
      sourceChecks.map((check) => [sourceKey(check.source), check]),
    );

    const result = await client.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(172936, 20260901)`;

      const reviewer = await loadConfiguredReviewer(transaction, reviewerIdentity);
      const reviewerUserId = reviewer.id;

      const catalog = await loadCatalog(transaction);
      for (const candidate of OFFICIAL_OPPORTUNITY_CANDIDATES) {
        const categoryId = catalog.categories.get(candidate.categorySlug);
        const careerTrackId = catalog.careers.get(candidate.careerSlug);
        if (!categoryId) throw new Error(`[${candidate.slug}] categoria ativa não encontrada.`);
        if (!careerTrackId) throw new Error(`[${candidate.slug}] carreira ativa não encontrada.`);
        if (!catalog.categoryCareers.has(`${categoryId}:${careerTrackId}`)) {
          throw new Error(`[${candidate.slug}] carreira não pertence à categoria informada.`);
        }
        for (const signal of candidate.organizerSignals) {
          if (signal.quizBankSlug && !catalog.banks.has(signal.quizBankSlug)) {
            throw new Error(`[${candidate.slug}] perfil de banca ativo não encontrado.`);
          }
        }
      }

      if (!command.approve) {
        return {
          mode: "preview" as const,
          reviewerUserId,
          approved: 0,
          unchanged: 0,
        };
      }

      const approvedAt = new Date().toISOString();
      let approved = 0;
      let unchanged = 0;

      for (const candidate of OFFICIAL_OPPORTUNITY_CANDIDATES) {
        const categoryId = catalog.categories.get(candidate.categorySlug)!;
        const careerTrackId = catalog.careers.get(candidate.careerSlug)!;
        const opportunity = await ensureOpportunity(
          transaction,
          candidate,
          categoryId,
          careerTrackId,
          reviewerUserId,
        );
        let changed = opportunity.changed;
        const sourceDocumentIds = new Map<string, string>();
        const observedInstants: string[] = [];

        for (const source of candidate.officialSources) {
          const check = sourceChecksByKey.get(sourceKey(source));
          if (!check) throw new Error(`[${candidate.slug}] observação HEAD ausente.`);
          observedInstants.push(check.observation.observedAt);
          const persisted = await ensureApprovedSource(
            transaction,
            candidate,
            source,
            check.observation,
            opportunity.id,
            reviewerUserId,
            approvedAt,
          );
          const canonicalUrl = parseOfficialOpportunitySourceUrl(source.url, source.sourceId).url;
          sourceDocumentIds.set(canonicalUrl, persisted.id);
          changed ||= persisted.changed;
          await transaction`
            insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
            values (
              ${reviewerUserId},
              'opportunity.source_metadata_observed',
              'opportunity_source_document',
              ${persisted.id},
              ${JSON.stringify({
                candidateSlug: candidate.slug,
                sourceUrl: canonicalUrl,
                requestMethod: check.observation.requestMethod,
                httpStatus: check.observation.httpStatus,
                contentType: check.observation.contentType,
                observedAt: check.observation.observedAt,
                sourcePolicy: "metadata_only",
                sourceContentStored: false,
                executionSource: reviewerIdentity.executionSource,
                approvalReference: reviewerIdentity.approvalReference,
              })}::jsonb
            )
          `;
        }

        const assignments = await reconcileReviewedAssignments(
          transaction,
          candidate,
          opportunity.id,
          sourceDocumentIds,
          catalog.banks,
          reviewerUserId,
          approvedAt,
        );
        changed ||= assignments.changed;

        if (!opportunity.reviewed) {
          const sourceCheckedAt = [...observedInstants].sort().at(-1) ?? approvedAt;
          await transaction`
            update contest_opportunities
            set
              source_checked_at = ${sourceCheckedAt},
              editorial_status = 'reviewed',
              published_at = ${approvedAt},
              updated_by_user_id = ${reviewerUserId},
              reviewed_by_user_id = ${reviewerUserId},
              reviewed_at = ${approvedAt},
              review_notes = ${REVIEW_NOTE},
              updated_at = ${approvedAt}
            where id = ${opportunity.id}
          `;
          changed = true;
        }

        if (changed) {
          await transaction`
            insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
            values (
              ${reviewerUserId},
              'opportunity.official_candidate_approved',
              'contest_opportunity',
              ${opportunity.id},
              ${JSON.stringify({
                candidateSlug: candidate.slug,
                sourcePolicy: "metadata_only",
                sourceContentStored: false,
                sourceCount: candidate.officialSources.length,
                organizerCount: candidate.organizerSignals.length,
                reviewerIdentityProvenance: reviewerIdentity.provenance,
                executionSource: reviewerIdentity.executionSource,
                approvalReference: reviewerIdentity.approvalReference,
              })}::jsonb
            )
          `;
          approved += 1;
        } else {
          unchanged += 1;
        }
      }

      return { mode: "approved" as const, reviewerUserId, approved, unchanged };
    });

    console.log(
      JSON.stringify(
        {
          completedAt: new Date().toISOString(),
          mode: result.mode,
          reviewerUserId: result.reviewerUserId,
          reviewerIdentityProvenance: reviewerIdentity.provenance,
          executionSource: reviewerIdentity.executionSource,
          approvalReference: reviewerIdentity.approvalReference,
          candidates: OFFICIAL_OPPORTUNITY_CANDIDATES.length,
          catalogEligible: validations.filter((validation) => validation.catalogEligible).length,
          sourcesChecked: sourceChecks.length,
          headRestricted: sourceChecks.filter(
            (check) =>
              classifyOpportunitySourceHttpStatus(check.observation.httpStatus) ===
              "head_restricted",
          ).length,
          approved: result.approved,
          unchanged: result.unchanged,
          sourcePolicy: "metadata_only",
          sourceContentStored: false,
        },
        null,
        2,
      ),
    );

    if (!command.approve) {
      console.log(
        "Prévia concluída sem escrita. Repita com --approve para efetivar uma transação atômica.",
      );
    }
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Falha ao aprovar oportunidades oficiais.", safeError(error));
  process.exitCode = 1;
});
