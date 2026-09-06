import { sql, type SQLWrapper } from "drizzle-orm";

/** Direito por produto, não por carreira/oportunidade. Uma proposta nunca libera acesso.
 * Revalida fonte/programa/versão e a revisão exata; suspensão ou edição posterior fecha o vínculo. */
export function approvedProductQuestionExists(
  productSlug: SQLWrapper,
  questionId: SQLWrapper,
  opportunityId?: SQLWrapper,
) {
  return sql`exists (
    select 1 from contest_product_question_bindings binding
    join contest_store_products product on product.slug = binding.product_slug
    join questions q on q.id = binding.question_id
    join contest_opportunities opportunity on opportunity.id = binding.opportunity_id
    join opportunity_requirements requirement on requirement.id = binding.requirement_id
    join opportunity_source_documents source on source.id = binding.source_document_id
    left join opportunity_document_snapshots snapshot on snapshot.id = binding.source_snapshot_id
    join legal_articles article on article.id = binding.legal_article_id
    join legal_versions version on version.id = binding.legal_version_id
    join legal_acts act on act.id = version.legal_act_id
    where binding.product_slug = ${productSlug} and binding.question_id = ${questionId}
      ${opportunityId ? sql`and binding.opportunity_id = ${opportunityId}` : sql``}
      and binding.status = 'approved' and binding.reviewed_by_user_id is not null
      and binding.reviewed_at is not null
      and product.opportunity_id = binding.opportunity_id
      and opportunity.editorial_status = 'reviewed'
      and requirement.opportunity_id = binding.opportunity_id
      and source.opportunity_id = binding.opportunity_id
      and requirement.source_document_id = binding.source_document_id
      and requirement.source_snapshot_id is not distinct from binding.source_snapshot_id
      and requirement.editorial_status = 'reviewed'
      and requirement.requirement_text = binding.requirement_text and requirement.source_locator = binding.source_locator
      and requirement.legal_article_id = binding.legal_article_id
      and requirement.subject_id = q.subject_id and requirement.topic_id = q.topic_id
      and source.status = 'approved'
      and binding.evidence->>'sourceUrl' = source.source_url
      and (binding.source_snapshot_id is null or (
        snapshot.status = 'approved' and snapshot.source_document_id = source.id
        and snapshot.checksum_sha256 = binding.source_snapshot_checksum))
      and q.editorial_status = 'reviewed' and q.reviewed_by_user_id is not null
      and q.source_rights = 'original_authorial' and q.quiz_mode in ('dry_law','original_style')
      and date_trunc('milliseconds', q.updated_at) = date_trunc('milliseconds', binding.question_updated_at)
      and binding.evidence->'questionContent' = jsonb_build_object(
        'prompt', q.prompt, 'explanation', q.explanation, 'type', q.type, 'learningObjective', q.learning_objective,
        'options', coalesce((select jsonb_agg(jsonb_build_object(
          'optionKey', option.option_key, 'text', option.text, 'isCorrect', option.is_correct,
          'rationale', option.rationale, 'sortOrder', option.sort_order) order by option.sort_order)
          from question_options option where option.question_id = q.id), '[]'::jsonb))
      and q.legal_article_id = article.id and article.legal_version_id = version.id
      and binding.evidence->>'legalArticleText' = article.literal_text
      and article.editorial_status = 'reviewed' and article.source_rights = 'official_text'
      and version.status = 'current' and version.checksum_sha256 = binding.legal_version_checksum
      and binding.evidence->>'legalSourceUrl' = version.source_url
      and act.is_active = true
      and (q.quiz_mode = 'dry_law' or exists (
        select 1 from opportunity_organizer_assignments assignment
        join quiz_banks bank on bank.id = assignment.quiz_bank_id
        join question_style_profiles profile on profile.quiz_bank_id = bank.id
        where assignment.opportunity_id = binding.opportunity_id
          and assignment.status = 'reviewed' and assignment.valid_until is null
          and assignment.quiz_bank_id = q.style_bank_id and bank.is_active = true
          and profile.is_active = true and profile.format = q.type
          and binding.evidence->'bankProfileVersion' = to_jsonb(profile.version)
          and binding.evidence->'organizerAssignmentId' = to_jsonb(assignment.id)
          and (assignment.role = 'examination_provider' or (
            assignment.role = 'primary_responsible' and not exists (
              select 1 from opportunity_organizer_assignments examiner
              where examiner.opportunity_id = binding.opportunity_id and examiner.role = 'examination_provider'
                and examiner.status = 'reviewed' and examiner.valid_until is null
            )
          ))
      ))
  )`;
}
