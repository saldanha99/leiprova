import { sql, type SQLWrapper } from "drizzle-orm";
import { approvedBindingQuestionContractExists } from "../editorial/question-contract-query";

/** Direito por produto, não por carreira/oportunidade. Uma proposta nunca libera acesso.
 * Revalida fonte/programa/versão e a revisão exata; suspensão ou edição posterior fecha o vínculo. */
export function approvedProductQuestionExists(
  productSlug: SQLWrapper,
  questionId: SQLWrapper,
  opportunityId?: SQLWrapper,
  bindingId?: SQLWrapper,
) {
  return sql`exists (
    select 1 from contest_product_question_bindings verified_product_binding
    join contest_store_products verified_product on verified_product.slug = verified_product_binding.product_slug
    join questions verified_product_question on verified_product_question.id = verified_product_binding.question_id
    join contest_opportunities verified_product_opportunity on verified_product_opportunity.id = verified_product_binding.opportunity_id
    join opportunity_requirements verified_product_requirement on verified_product_requirement.id = verified_product_binding.requirement_id
    join opportunity_source_documents verified_product_source on verified_product_source.id = verified_product_binding.source_document_id
    left join opportunity_document_snapshots verified_product_snapshot on verified_product_snapshot.id = verified_product_binding.source_snapshot_id
    join legal_articles verified_product_article on verified_product_article.id = verified_product_binding.legal_article_id
    join legal_versions verified_product_version on verified_product_version.id = verified_product_binding.legal_version_id
    join legal_acts verified_product_act on verified_product_act.id = verified_product_version.legal_act_id
    where verified_product_binding.product_slug = ${productSlug} and verified_product_binding.question_id = ${questionId}
      ${opportunityId ? sql`and verified_product_binding.opportunity_id = ${opportunityId}` : sql``}
      ${bindingId ? sql`and verified_product_binding.id = ${bindingId}` : sql``}
      and verified_product_binding.status = 'approved' and verified_product_binding.reviewed_by_user_id is not null
      and verified_product_binding.reviewed_at is not null
      and verified_product.opportunity_id = verified_product_binding.opportunity_id
      and verified_product_opportunity.editorial_status = 'reviewed'
      and verified_product_requirement.opportunity_id = verified_product_binding.opportunity_id
      and verified_product_source.opportunity_id = verified_product_binding.opportunity_id
      and verified_product_requirement.source_document_id = verified_product_binding.source_document_id
      and verified_product_requirement.source_snapshot_id is not distinct from verified_product_binding.source_snapshot_id
      and verified_product_requirement.editorial_status = 'reviewed'
      and verified_product_requirement.requirement_text = verified_product_binding.requirement_text and verified_product_requirement.source_locator = verified_product_binding.source_locator
      -- Artigo principal do requisito ou um dos adicionais gravados na revisão dele.
      and (verified_product_requirement.legal_article_id = verified_product_binding.legal_article_id or exists (
        select 1 from opportunity_requirement_articles verified_product_covered_article
        where verified_product_covered_article.requirement_id = verified_product_requirement.id and verified_product_covered_article.legal_article_id = verified_product_binding.legal_article_id))
      -- Tópico é filtro de estudo: requisito e questão precisam coincidir, inclusive
      -- os dois sem tópico (programa extraído do edital não traz tópico do catálogo).
      and verified_product_requirement.subject_id = verified_product_question.subject_id and verified_product_requirement.topic_id is not distinct from verified_product_question.topic_id
      and verified_product_source.status = 'approved'
      and verified_product_binding.evidence->>'sourceUrl' = verified_product_source.source_url
      and (verified_product_binding.source_snapshot_id is null or (
        verified_product_snapshot.status = 'approved' and verified_product_snapshot.source_document_id = verified_product_source.id
        and verified_product_snapshot.checksum_sha256 = verified_product_binding.source_snapshot_checksum))
      and verified_product_question.editorial_status = 'reviewed' and verified_product_question.reviewed_by_user_id is not null
      and verified_product_question.source_rights = 'original_authorial' and verified_product_question.quiz_mode in ('dry_law','original_style')
      and date_trunc('milliseconds', verified_product_question.updated_at) = date_trunc('milliseconds', verified_product_binding.question_updated_at)
      and verified_product_binding.evidence->'questionContent' = jsonb_build_object(
        'prompt', verified_product_question.prompt, 'explanation', verified_product_question.explanation, 'type', verified_product_question.type, 'learningObjective', verified_product_question.learning_objective,
        'options', coalesce((select jsonb_agg(jsonb_build_object(
          'optionKey', verified_product_option.option_key, 'text', verified_product_option.text, 'isCorrect', verified_product_option.is_correct,
          'rationale', verified_product_option.rationale, 'sortOrder', verified_product_option.sort_order) order by verified_product_option.sort_order)
          from question_options verified_product_option where verified_product_option.question_id = verified_product_question.id), '[]'::jsonb))
      and verified_product_question.legal_article_id = verified_product_article.id and verified_product_article.legal_version_id = verified_product_version.id
      and verified_product_binding.evidence->>'legalArticleText' = verified_product_article.literal_text
      and verified_product_article.editorial_status = 'reviewed' and verified_product_article.source_rights = 'official_text'
      and verified_product_version.status = 'current' and verified_product_version.checksum_sha256 = verified_product_binding.legal_version_checksum
      and verified_product_binding.evidence->>'legalSourceUrl' = verified_product_version.source_url
      and verified_product_act.is_active = true
      and ${approvedBindingQuestionContractExists(sql`verified_product_binding.id`, sql`verified_product_question.id`, sql`verified_product_binding.opportunity_id`)}
  )`;
}
