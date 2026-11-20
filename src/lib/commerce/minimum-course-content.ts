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

/** Contagem SÓ para ordenar a fila dos agentes (nunca para acesso, venda ou liberação).
 * Mantém as conferências baratas do vínculo aprovado (revisão, questão sem edição posterior,
 * requisito revisado, fonte aprovada, versão vigente com o mesmo checksum, ato ativo) e deixa
 * de comparar textos e o JSON da questão, que custavam ~13 s por reserva (20/11/2026, 32
 * produtos: mesma contagem por produto em ~0,18 s). */
export function priorityProductQuestionCount(
  productSlug: SQLWrapper,
  opportunityId: SQLWrapper,
) {
  return sql<number>`(
    select count(distinct priority_binding.question_id)::integer
    from contest_product_question_bindings priority_binding
    join questions priority_question on priority_question.id = priority_binding.question_id
    join opportunity_requirements priority_requirement on priority_requirement.id = priority_binding.requirement_id
    join opportunity_source_documents priority_source on priority_source.id = priority_binding.source_document_id
    join legal_versions priority_version on priority_version.id = priority_binding.legal_version_id
    join legal_acts priority_act on priority_act.id = priority_version.legal_act_id
    where priority_binding.product_slug = ${productSlug}
      and priority_binding.opportunity_id = ${opportunityId}
      and priority_binding.status = 'approved' and priority_binding.reviewed_by_user_id is not null
      and priority_binding.reviewed_at is not null
      and priority_question.editorial_status = 'reviewed' and priority_question.reviewed_by_user_id is not null
      and date_trunc('milliseconds', priority_question.updated_at) = date_trunc('milliseconds', priority_binding.question_updated_at)
      and priority_requirement.editorial_status = 'reviewed'
      and priority_requirement.opportunity_id = priority_binding.opportunity_id
      and priority_source.status = 'approved'
      and priority_version.status = 'current' and priority_version.checksum_sha256 = priority_binding.legal_version_checksum
      and priority_act.is_active
  )`.mapWith(Number);
}

/** Fecha novas vendas abaixo do piso; não revoga o restante do acesso já adquirido. */
export function minimumCourseContentSatisfied(
  productSlug: SQLWrapper,
  opportunityId?: SQLWrapper,
) {
  return sql<boolean>`${approvedProductQuestionCount(productSlug, opportunityId)} >= ${MINIMUM_COURSE_QUESTION_COUNT}`;
}
