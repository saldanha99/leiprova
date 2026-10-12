import { sql, type SQLWrapper } from "drizzle-orm";

/** Modos adicionais não relaxam fonte/vínculo/lei vigente. Esta condição revalida
 * somente a decisão e a edição-base; as demais condições comerciais permanecem. */
export function preparationProgramReviewSatisfied(productSlug: SQLWrapper) {
  return sql<boolean>`exists (
    select 1 from contest_store_products preparation_product
    join contest_opportunities preparation_base on preparation_base.id = preparation_product.opportunity_id
    where preparation_product.slug = ${productSlug}
      and (preparation_product.preparation_mode = 'current_notice' or (
        preparation_product.preparation_mode in ('historical_training', 'pre_notice')
        and preparation_product.preparation_reviewed_at is not null
        and preparation_product.preparation_reviewed_by_user_id is not null
        and preparation_product.preparation_approval_reference is not null
        and preparation_product.preparation_opportunity_updated_at = preparation_base.updated_at
        and preparation_base.editorial_status = 'reviewed'
        and preparation_base.notice_published_at is not null
        and preparation_base.exam_date < (current_timestamp at time zone 'America/Sao_Paulo')::date
        and preparation_base.lifecycle_status not in ('canceled', 'suspended')
      ))
  )`;
}
