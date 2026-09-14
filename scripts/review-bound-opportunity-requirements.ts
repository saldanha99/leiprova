import { createHash } from "node:crypto";

import postgres from "postgres";
import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const sha256 = /^[a-f0-9]{64}$/u;

class RequirementReviewError extends Error {}

type Query = ReturnType<typeof postgres> | postgres.TransactionSql;
type Candidate = Readonly<{
  id: number;
  opportunityPublicId: string;
  requirementText: string;
  sourceLocator: string;
  sourceDocumentId: number;
  sourceSnapshotId: number;
  subjectIds: number[];
  topicIds: number[];
  legalArticleIds: number[];
  legalActIds: number[];
  proposalCount: number;
  questionCount: number;
  contextValid: boolean;
}>;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function parseArguments(arguments_: readonly string[]) {
  const values = new Map<string, string>();
  for (const argument of arguments_) {
    const match = /^--(opportunity|actor|mode|fingerprint|reference)=(.+)$/u.exec(
      argument,
    );
    if (!match || values.has(match[1])) {
      throw new RequirementReviewError(
        "Use --opportunity=SLUG --actor=UUID --reference=REF --mode=preview|apply; apply exige --fingerprint=SHA256.",
      );
    }
    values.set(match[1], match[2]);
  }
  const mode = values.get("mode") ?? "preview";
  const expectedFingerprint = values.get("fingerprint");
  const reference = z.string().trim().min(10).max(250).parse(values.get("reference"));
  if (mode !== "preview" && mode !== "apply") {
    throw new RequirementReviewError("Modo inválido.");
  }
  if (
    (mode === "apply" && !sha256.test(expectedFingerprint ?? "")) ||
    (mode === "preview" && expectedFingerprint !== undefined)
  ) {
    throw new RequirementReviewError(
      "A aplicação exige a impressão SHA256 da prévia; a prévia não recebe impressão.",
    );
  }
  return {
    actorPublicId: z.uuid().parse(values.get("actor")),
    expectedFingerprint,
    mode,
    opportunitySlug: slug.parse(values.get("opportunity")),
    reference,
  } as const;
}

function requireTarget(opportunitySlug: string) {
  const connectionString = process.env.LEIPROVA_REQUIREMENT_REVIEW_DATABASE_URL;
  if (!connectionString) {
    throw new RequirementReviewError(
      "Defina LEIPROVA_REQUIREMENT_REVIEW_DATABASE_URL explicitamente.",
    );
  }
  const target = new URL(connectionString);
  const production =
    process.env.NODE_ENV === "production" &&
    process.env.APP_URL === "https://leiprova.2b.app.br" &&
    process.env.LEIPROVA_REQUIREMENT_REVIEW_APPROVED ===
      `review-requirements:${opportunitySlug}` &&
    ["leiprova-pooler", "pooler"].includes(target.hostname) &&
    (!target.port || target.port === "5432") &&
    target.pathname === "/leiprova" &&
    target.username === "leiprova_app";
  const local =
    target.hostname === "127.0.0.1" &&
    target.pathname === "/leiprova_editorial_local";
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    target.search ||
    target.hash ||
    (!production && !local)
  ) {
    throw new RequirementReviewError("Destino de revisão de requisitos não permitido.");
  }
  return { connectionString, database: target.pathname.slice(1), production };
}

async function loadCandidates(query: Query, opportunitySlug: string) {
  return query<Candidate[]>`
    select
      r.id::integer as id,
      opportunity.public_id as "opportunityPublicId",
      r.requirement_text as "requirementText",
      r.source_locator as "sourceLocator",
      r.source_document_id::integer as "sourceDocumentId",
      r.source_snapshot_id::integer as "sourceSnapshotId",
      array_agg(distinct question.subject_id::integer order by question.subject_id::integer) as "subjectIds",
      array_agg(distinct question.topic_id::integer order by question.topic_id::integer) as "topicIds",
      array_agg(distinct binding.legal_article_id::integer order by binding.legal_article_id::integer) as "legalArticleIds",
      array_agg(distinct version.legal_act_id::integer order by version.legal_act_id::integer) as "legalActIds",
      count(binding.id)::integer as "proposalCount",
      count(distinct binding.question_id)::integer as "questionCount",
      bool_and(
        opportunity.editorial_status='reviewed'
        and source.status='approved'
        and snapshot.status='approved'
        and snapshot.source_document_id=source.id
        and binding.source_document_id=r.source_document_id
        and binding.source_snapshot_id=r.source_snapshot_id
        and binding.source_snapshot_checksum=snapshot.checksum_sha256
        and question.source_rights='original_authorial'
        and question.editorial_status='reviewed'
        and article.editorial_status='reviewed'
        and article.source_rights='official_text'
        and version.status='current'
        and act.is_active
      ) as "contextValid"
    from opportunity_requirements r
    join contest_opportunities opportunity on opportunity.id=r.opportunity_id
    join contest_product_question_bindings binding on binding.requirement_id=r.id
      and binding.opportunity_id=opportunity.id and binding.status='pending_review'
    join questions question on question.id=binding.question_id
    join opportunity_source_documents source on source.id=r.source_document_id
    join opportunity_document_snapshots snapshot on snapshot.id=r.source_snapshot_id
    join legal_articles article on article.id=binding.legal_article_id
    join legal_versions version on version.id=article.legal_version_id
    join legal_acts act on act.id=version.legal_act_id
    where opportunity.slug=${opportunitySlug} and r.editorial_status='draft'
    group by r.id,opportunity.public_id
    order by r.id
  `;
}

function validateCandidates(candidates: readonly Candidate[]) {
  if (!candidates.length) {
    throw new RequirementReviewError(
      "Nenhum requisito rascunho possui propostas revisáveis neste escopo.",
    );
  }
  for (const candidate of candidates) {
    if (
      !candidate.contextValid ||
      !candidate.sourceSnapshotId ||
      candidate.subjectIds.length !== 1 ||
      candidate.topicIds.length !== 1 ||
      candidate.legalArticleIds.length !== 1 ||
      candidate.legalActIds.length !== 1 ||
      candidate.proposalCount < 1 ||
      candidate.questionCount < 1
    ) {
      throw new RequirementReviewError(
        `O requisito ${candidate.id} não possui contexto oficial, revisado e unânime.`,
      );
    }
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const target = requireTarget(args.opportunitySlug);
  const client = postgres(target.connectionString, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 10,
  });
  try {
    const [identity] = await client<
      { name: string; role: string; superuser: boolean }[]
    >`
      select current_database() as name,current_user as role,
        (select rolsuper from pg_roles where rolname=current_user) as superuser
    `;
    if (
      !identity ||
      identity.name !== target.database ||
      (target.production &&
        (identity.role !== "leiprova_app" || identity.superuser))
    ) {
      throw new RequirementReviewError("Identidade do banco não autorizada.");
    }
    const [actor] = await client<
      { id: number; role: string }[]
    >`select id::integer as id,role from users where public_id=${args.actorPublicId}`;
    if (!actor || !["admin", "editor"].includes(actor.role)) {
      throw new RequirementReviewError("Responsável editorial não autorizado.");
    }
    const previewCandidates = await loadCandidates(client, args.opportunitySlug);
    validateCandidates(previewCandidates);
    const operationFingerprint = fingerprint({
      version: "bound-opportunity-requirements-review-v1",
      actorPublicId: args.actorPublicId,
      opportunitySlug: args.opportunitySlug,
      reference: args.reference,
      candidates: previewCandidates,
    });
    if (args.mode === "preview") {
      console.log(
        JSON.stringify(
          {
            mode: "preview",
            database: identity.name,
            fingerprint: operationFingerprint,
            requirements: previewCandidates,
            wouldApprove: previewCandidates.length,
            productsReleased: 0,
          },
          null,
          2,
        ),
      );
      return;
    }
    if (args.expectedFingerprint !== operationFingerprint) {
      throw new RequirementReviewError(
        "Contexto, responsável ou confirmação mudou; confira nova prévia.",
      );
    }
    const note =
      "Programa, matéria, assunto e dispositivo conferidos pelo proprietário nas fontes oficiais e nas propostas autorais vinculadas.";
    const result = await client.begin(async (transaction) => {
      await transaction`set local statement_timeout='30s'`;
      await transaction`set local lock_timeout='5s'`;
      await transaction`select pg_advisory_xact_lock(621743,39)`;
      await transaction`
        select r.id from opportunity_requirements r
        join contest_opportunities o on o.id=r.opportunity_id
        where o.slug=${args.opportunitySlug} and r.id=any(${previewCandidates.map((row) => row.id)}::bigint[])
        order by r.id for update
      `;
      const current = await loadCandidates(transaction, args.opportunitySlug);
      validateCandidates(current);
      const currentFingerprint = fingerprint({
        version: "bound-opportunity-requirements-review-v1",
        actorPublicId: args.actorPublicId,
        opportunitySlug: args.opportunitySlug,
        reference: args.reference,
        candidates: current,
      });
      if (currentFingerprint !== operationFingerprint) {
        throw new RequirementReviewError(
          "O programa ou as propostas mudaram durante a decisão.",
        );
      }
      for (const candidate of current) {
        const updated = await transaction<{ id: number }[]>`
          update opportunity_requirements set
            subject_id=${candidate.subjectIds[0]},
            topic_id=${candidate.topicIds[0]},
            legal_act_id=${candidate.legalActIds[0]},
            legal_article_id=${candidate.legalArticleIds[0]},
            editorial_status='reviewed',
            created_by_user_id=${actor.id},
            reviewed_by_user_id=${actor.id},
            reviewed_at=clock_timestamp(),
            review_notes=${note},
            updated_at=clock_timestamp()
          where id=${candidate.id} and editorial_status='draft'
          returning id::integer as id
        `;
        if (updated.length !== 1) {
          throw new RequirementReviewError("O requisito mudou antes da aprovação.");
        }
        const mappedMetadata = JSON.stringify({
          subjectId: candidate.subjectIds[0],
          topicId: candidate.topicIds[0],
          legalArticleId: candidate.legalArticleIds[0],
          proposalCount: candidate.proposalCount,
          mappingBasis: "unanimous_reviewed_product_proposals",
          dossierFingerprint: operationFingerprint,
        });
        const reviewedMetadata = JSON.stringify({
          reference: args.reference,
          humanReviewConfirmed: true,
          reviewerAlsoResponsible: true,
          approvalBasis: "owner_explicit_confirmation",
          dossierFingerprint: operationFingerprint,
        });
        await transaction`
          insert into audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
          values
            (${actor.id},'editorial.notice_requirement.mapped','opportunity_requirement',${String(candidate.id)},${mappedMetadata}::jsonb),
            (${actor.id},'editorial.notice_requirement.reviewed','opportunity_requirement',${String(candidate.id)},${reviewedMetadata}::jsonb)
        `;
      }
      return { approved: current.length };
    });
    console.log(
      JSON.stringify(
        {
          mode: "apply",
          database: identity.name,
          fingerprint: operationFingerprint,
          ...result,
          productsReleased: 0,
          checkoutEnabled: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message.slice(0, 500)
      : "Falha sem detalhe seguro; nenhum requisito foi aprovado.",
  );
  process.exitCode = 1;
});
