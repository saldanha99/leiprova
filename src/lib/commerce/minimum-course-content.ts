import { sql, type SQLWrapper } from "drizzle-orm";
import { approvedProductQuestionExists } from "./product-binding-query";

/** Piso editorial por produto. Não se soma o acervo de outros cargos ou bancas. */
export const MINIMUM_COURSE_QUESTION_COUNT = 68;

export function hasMinimumCourseQuestionCount(count: number) {
  return Number.isSafeInteger(count) && count >= MINIMUM_COURSE_QUESTION_COUNT;
}

/** Contagem ao vivo para catálogo e inventário: vários requisitos da mesma questão
 * contam uma vez. O mesmo predicado de acesso revalida todas as evidências atuais. */
export function approvedProductQuestionCount(
  productSlug: SQLWrapper,
  opportunityId?: SQLWrapper,
) {
  return sql<number>`(
    select count(distinct content_binding.question_id)::integer
    from contest_product_question_bindings content_binding
    where content_binding.product_slug = ${productSlug}
      and content_binding.status = 'approved'
      ${opportunityId ? sql`and content_binding.opportunity_id = ${opportunityId}` : sql``}
      and ${approvedProductQuestionExists(productSlug, sql`content_binding.question_id`, opportunityId)}
  )`.mapWith(Number);
}

/** Fecha novas vendas abaixo do piso; não revoga o restante do acesso já adquirido. */
export function minimumCourseContentSatisfied(
  productSlug: SQLWrapper,
  opportunityId?: SQLWrapper,
) {
  return sql<boolean>`${approvedProductQuestionCount(productSlug, opportunityId)} >= ${MINIMUM_COURSE_QUESTION_COUNT}`;
}
