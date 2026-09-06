import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../db/schema";
import { canReviewEditorialSubmission } from "../editorial/owner-approval";
import { approvedProductQuestionExists } from "./product-binding-query";
import {
  assertProductBindingReviewDecision, assertProductBindingReviewScope,
  productBindingReviewDossierSchema, productBindingReviewFingerprint, productBindingReviewSchema,
  ProductBindingReviewError, type ProductBindingReviewInput,
} from "./product-binding-review-policy";

type Db = PostgresJsDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
const idsSql = (ids: readonly string[]) => sql`array[${sql.join(ids.map((id) => sql`${id}`), sql`,`)}]::text[]`;

/** Projeta SOMENTE a decisão de vínculo para reaproveitar a mesma regra de acesso no preview.
 * É SELECT/CTE, sem UPDATE ou tabela temporária. Questões/fontes/requisitos não são projetados.
 * O CTE contém apenas IDs selecionados; uma versão aprovada histórica não mascara a proposta.
 */
function candidateCte(input: ProductBindingReviewInput, simulateReview: boolean, actorId: number) {
  return sql`with contest_product_question_bindings as (
    select (jsonb_populate_record(null::public.contest_product_question_bindings,
      to_jsonb(original_binding) ${simulateReview ? sql`|| jsonb_build_object(
        'status','approved','reviewed_by_user_id',${actorId}::bigint,
        'reviewed_at','2000-01-01T00:00:00Z','review_notes',${input.notes}::text)` : sql``}
    )).* from public.contest_product_question_bindings original_binding
    where original_binding.id = any(${idsSql(input.bindingIds)})
  )`;
}

async function loadDossiers(transaction: Transaction, input: ProductBindingReviewInput, actorId: number) {
  const rows = await transaction.execute<{ dossier: unknown }>(sql`${candidateCte(input, true, actorId)}
    select jsonb_build_object(
      'bindingId', b.id, 'questionId', b.question_id, 'proposedByUserId',b.proposed_by_user_id, 'productSlug', b.product_slug,
      'opportunityPublicId', opportunity.public_id, 'bindingStatus', b.status,
      'eligible', coalesce((${approvedProductQuestionExists(sql`candidate.product_slug`, sql`candidate.question_id`, sql`candidate.opportunity_id`)}
        and edition.public_id=${input.examEditionPublicId}
        and edition.career_track_id=opportunity.career_track_id
        and edition.specialization_id is not distinct from opportunity.specialization_id
        and edition.status not in ('draft','canceled','archived') and edition.official_url is not null
        and (q.quiz_mode='dry_law' or q.style_bank_id=edition.bank_id)
        and q.clean_room_attested_at is not null and q.created_by_user_id is not null and q.verified_at is not null),false),
      'snapshot', jsonb_build_object(
        'binding',to_jsonb(b), 'product',to_jsonb(product), 'opportunity',to_jsonb(opportunity), 'edition',to_jsonb(edition),
        'requirement',to_jsonb(requirement), 'source',to_jsonb(source),
        'documentSnapshot', (select jsonb_build_object('id',s.id,'sourceDocumentId',s.source_document_id,
          'url',s.document_url,'checksum',s.checksum_sha256,'status',s.status,'reviewedAt',s.reviewed_at,
          'reviewedByUserId',s.reviewed_by_user_id,'approvalBasis',s.approval_basis)
          from opportunity_document_snapshots s where s.id=b.source_snapshot_id),
        'question',to_jsonb(q), 'options',coalesce((select jsonb_agg(to_jsonb(o) order by o.sort_order,o.id)
          from question_options o where o.question_id=q.id),'[]'::jsonb),
        'article',to_jsonb(article), 'version',to_jsonb(version), 'act',to_jsonb(act),
        'organizers',coalesce((select jsonb_agg(jsonb_build_object('assignment',to_jsonb(a),'bank',to_jsonb(bank),'profile',to_jsonb(profile)) order by a.id)
          from opportunity_organizer_assignments a left join quiz_banks bank on bank.id=a.quiz_bank_id
          left join question_style_profiles profile on profile.quiz_bank_id=bank.id
          where a.opportunity_id=b.opportunity_id),'[]'::jsonb)
      )
    ) as dossier
    from public.contest_product_question_bindings b
    join contest_product_question_bindings candidate on candidate.id=b.id
    join contest_store_products product on product.slug=b.product_slug
    join contest_opportunities opportunity on opportunity.id=b.opportunity_id
    left join exam_editions edition on edition.id=opportunity.exam_edition_id
    join opportunity_requirements requirement on requirement.id=b.requirement_id
    join opportunity_source_documents source on source.id=b.source_document_id
    join questions q on q.id=b.question_id
    join legal_articles article on article.id=b.legal_article_id
    join legal_versions version on version.id=article.legal_version_id
    join legal_acts act on act.id=version.legal_act_id
    where b.id=any(${idsSql(input.bindingIds)}) order by b.id
  `);
  return rows.map((row) => productBindingReviewDossierSchema.parse(row.dossier));
}

async function lockContext(transaction: Transaction, input: ProductBindingReviewInput) {
  // Estes locks exigem grants limitados futuros. Não há fallback para owner/URL de migração.
  await transaction.execute(sql`select slug from contest_store_products where slug=${input.productSlug} for update`);
  await transaction.execute(sql`select id from contest_opportunities where public_id=${input.opportunityPublicId} for update`);
  await transaction.execute(sql`select id from exam_editions where public_id=${input.examEditionPublicId} for share`);
  await transaction.execute(sql`select id from public.contest_product_question_bindings where id=any(${idsSql(input.bindingIds)}) order by id for update`);
  await transaction.execute(sql`select public.lock_editorial_approval_context(array(
    select distinct question_id from public.contest_product_question_bindings where id=any(${idsSql(input.bindingIds)}) order by question_id
  ))`);
  await transaction.execute(sql`select r.id from opportunity_requirements r where r.id in (
    select requirement_id from public.contest_product_question_bindings where id=any(${idsSql(input.bindingIds)})
  ) order by r.id for share`);
  await transaction.execute(sql`select s.id from opportunity_source_documents s where s.id in (
    select source_document_id from public.contest_product_question_bindings where id=any(${idsSql(input.bindingIds)})
  ) order by s.id for share`);
  await transaction.execute(sql`select s.id from opportunity_document_snapshots s where s.id in (
    select source_snapshot_id from public.contest_product_question_bindings where id=any(${idsSql(input.bindingIds)})
  ) order by s.id for share`);
  // FOR UPDATE na oportunidade impede novas associações pela FK enquanto revisamos as existentes.
  await transaction.execute(sql`select a.id from opportunity_organizer_assignments a where a.opportunity_id in (
    select id from contest_opportunities where public_id=${input.opportunityPublicId}
  ) order by a.id for share`);
}

/** Serviço interno: o chamador deve derivar actorPublicId da sessão autenticada, nunca do formulário.
 * Não é um endpoint, não concede privilégios, não publica produto e não abre checkout.
 * Sem os grants futuros a aplicação falha fechada; nenhum uso de MIGRATION_DATABASE_URL.
 */
export async function reviewProductQuestionBindings(db: Db, request: {
  input: unknown; actorPublicId: string; mode: "preview" | "apply"; expectedFingerprint?: string;
}) {
  if (!["preview", "apply"].includes(request.mode)) throw new ProductBindingReviewError("Modo de revisão inválido.");
  const input = productBindingReviewSchema.parse(request.input);
  const actorPublicId = z.uuid().parse(request.actorPublicId);
  if (request.mode === "apply" && !/^[a-f0-9]{64}$/u.test(request.expectedFingerprint ?? "")) {
    throw new ProductBindingReviewError("Faça preview e informe a impressão digital exata do dossiê.");
  }
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`set local statement_timeout='30s'`);
    await transaction.execute(sql`set local lock_timeout='5s'`);
    const [actor] = await transaction.execute<{ id: number; role: string; email: string }>(sql`
      select id::integer as id, role, email from users where public_id=${actorPublicId}
      ${request.mode === "apply" ? sql`for share` : sql``}
    `);
    if (!actor || !["admin", "editor"].includes(actor.role)) throw new ProductBindingReviewError("Operador editorial não autorizado.");
    if (request.mode === "apply") await lockContext(transaction, input);
    const dossiers = await loadDossiers(transaction, input, actor.id);
    assertProductBindingReviewScope(input, dossiers);
    const includesOwnProposal = dossiers.some((d) => d.proposedByUserId === actor.id);
    const reviewerAllowed = dossiers.every((d) => canReviewEditorialSubmission({
      initiatorUserId: d.proposedByUserId, reviewerUserId: actor.id, reviewerEmail: actor.email,
    }));
    const fingerprint = productBindingReviewFingerprint(input, { publicId: actorPublicId, role: actor.role }, dossiers);
    if (request.mode === "preview") {
      return { mode: "preview" as const, fingerprint, total: dossiers.length, approved: 0,
        eligible: dossiers.filter((d) => d.eligible && d.bindingStatus === "pending_review").length,
        dossiers, reviewerAllowed, requiresOwnerOverride: includesOwnProposal,
        productReleased: false as const, checkoutEnabled: false as const };
    }
    assertProductBindingReviewDecision(input, actor.role, dossiers, request.expectedFingerprint, fingerprint);
    if (!reviewerAllowed || (includesOwnProposal && input.ownerOverride !== true) || (!includesOwnProposal && input.ownerOverride === true)) {
      throw new ProductBindingReviewError("Proposta própria exige a conta proprietária configurada e exceção explícita; os demais casos exigem revisão independente.");
    }
    const updated = await transaction.execute<{ id: string }>(sql`
      update public.contest_product_question_bindings set status='approved', reviewed_by_user_id=${actor.id},
        reviewed_at=clock_timestamp(), review_notes=${input.notes}, updated_at=clock_timestamp()
      where id=any(${idsSql(input.bindingIds)}) and product_slug=${input.productSlug} and status='pending_review'
        and opportunity_id in (select id from contest_opportunities where public_id=${input.opportunityPublicId})
      returning id
    `);
    if (updated.length !== input.bindingIds.length) throw new ProductBindingReviewError("O lote mudou durante a decisão; a transação será revertida.");
    const validations = await transaction.execute<{ id: string; valid: boolean }>(sql`${candidateCte(input, false, actor.id)}
      select candidate.id, ${approvedProductQuestionExists(sql`candidate.product_slug`, sql`candidate.question_id`, sql`candidate.opportunity_id`)} as valid
      from contest_product_question_bindings candidate order by candidate.id
    `);
    if (validations.length !== input.bindingIds.length || validations.some((row) => !row.valid)) {
      throw new ProductBindingReviewError("A regra de acesso rejeitou o vínculo; nenhuma decisão será persistida.");
    }
    await transaction.insert(schema.auditLogs).values(dossiers.map((dossier) => ({
      actorUserId: actor.id, action: "editorial.product_binding.approved", entityType: "contest_product_question_binding",
      entityId: dossier.bindingId, metadata: { productSlug: input.productSlug, opportunityPublicId: input.opportunityPublicId,
        examEditionPublicId: input.examEditionPublicId,
        dossierFingerprint: fingerprint, selectedBindingIds: [...input.bindingIds].sort(), notes: input.notes,
        confirmations: input.confirmations, humanReviewRecorded: true,
        approvalBasis: dossier.proposedByUserId === actor.id ? "owner_self_review" : "independent_review",
        ownerOverride: dossier.proposedByUserId === actor.id && input.ownerOverride === true,
        productReleased: false, checkoutEnabled: false },
    })));
    return { mode: "apply" as const, fingerprint, total: dossiers.length, approved: updated.length,
      productReleased: false as const, checkoutEnabled: false as const };
  }, request.mode === "preview" ? { isolationLevel: "repeatable read", accessMode: "read only" } : { isolationLevel: "serializable" });
}
