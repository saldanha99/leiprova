import { sql, type SQLWrapper } from "drizzle-orm";

import { OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS } from "@/lib/exams/previous-exam-policy";
import { OFFICIAL_EXAM_PORTALS } from "@/lib/official-sources/exam-registry";

/** A fonte oficial precisa ter sido conferida recentemente. A venda e a
 * entrega falham fechadas quando o link não foi revalidado nesse intervalo. */
export const PREVIOUS_EXAM_SOURCE_FRESHNESS_DAYS =
  OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS;

/** Compatibilidade visual: a prontidão não usa mais este piso simbólico; exige
 * exatamente `expected_question_count` do caderno. */
export const MINIMUM_LICENSED_PREVIOUS_EXAM_QUESTION_COUNT = 1;

function officialExamUrlAllowed(
  bankSlug: SQLWrapper,
  sourceUrl: SQLWrapper,
  declaredHost?: SQLWrapper,
) {
  const portalConditions = OFFICIAL_EXAM_PORTALS.map((portal) => {
    const allowedHosts = sql.join(
      portal.allowedHosts.map((host) => sql`${host}`),
      sql`, `,
    );
    return sql`(
      ${bankSlug} = ${portal.bankSlug}
      and lower(substring(${sourceUrl} from '^https://([^/:?#]+)')) in (${allowedHosts})
    )`;
  });
  const parsedHost = sql`lower(substring(${sourceUrl} from '^https://([^/:?#]+)'))`;

  return sql`(
    ${sourceUrl} ~* '^https://[a-z0-9.-]+(?:/|$)'
    and ${sourceUrl} !~* '^https://[^/]*@'
    ${declaredHost ? sql`and lower(${declaredHost}) = ${parsedHost}` : sql``}
    and (${sql.join(portalConditions, sql` or `)})
  )`;
}

function freshnessSatisfied(checkedAt: SQLWrapper) {
  return sql`${checkedAt} is not null
    and ${checkedAt} >= current_timestamp - make_interval(days => ${OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS})
    and ${checkedAt} <= current_timestamp`;
}

function licenseCovers(
  expiresAt: SQLWrapper,
  coverageEndsAt: SQLWrapper = sql`current_timestamp`,
) {
  return sql`(${expiresAt} is null or ${expiresAt} >= ${coverageEndsAt})`;
}

function productReleaseCondition(requireReleasedProduct: boolean) {
  return requireReleasedProduct
    ? sql`and exam_product.status = 'released'
        and exam_product.released_at is not null
        and exam_product.released_by_user_id is not null`
    : sql``;
}

function opportunityCondition(opportunityId?: SQLWrapper) {
  return opportunityId
    ? sql`and exam_product.opportunity_id = ${opportunityId}`
    : sql``;
}

function exactHistoricalScopeConditions() {
  return sql`
    and opportunity.editorial_status = 'reviewed'
    and opportunity.career_track_id = exam_edition.career_track_id
    and opportunity.specialization_id is not distinct from exam_edition.specialization_id
    and opportunity.institution_acronym = exam_edition.institution_acronym
    and opportunity.jurisdiction_code = exam_edition.jurisdiction_code
    and exam_edition.status in ('held', 'published')
    and exam_edition.exam_date < (current_timestamp at time zone 'America/Sao_Paulo')::date
    and (opportunity.exam_date is null or exam_edition.exam_date < opportunity.exam_date)
    and ${freshnessSatisfied(sql`exam_edition.source_checked_at`)}
    and ${officialExamUrlAllowed(sql`exam_bank.slug`, sql`exam_edition.official_url`)}
    and exam_bank.is_active = true
    and exists (
      select 1
      from opportunity_organizer_assignments assignment
      where assignment.opportunity_id = opportunity.id
        and assignment.status = 'reviewed'
        and assignment.valid_until is null
        and assignment.quiz_bank_id = exam_edition.bank_id
        and (
          assignment.role = 'examination_provider'
          or (
            assignment.role = 'primary_responsible'
            and not exists (
              select 1
              from opportunity_organizer_assignments examiner
              where examiner.opportunity_id = opportunity.id
                and examiner.role = 'examination_provider'
                and examiner.status = 'reviewed'
                and examiner.valid_until is null
            )
          )
        )
    )
    and not exists (
      select 1
      from exam_editions newer_edition
      where newer_edition.id <> exam_edition.id
        and newer_edition.bank_id = exam_edition.bank_id
        and newer_edition.career_track_id = exam_edition.career_track_id
        and newer_edition.specialization_id is not distinct from exam_edition.specialization_id
        and newer_edition.institution_acronym = exam_edition.institution_acronym
        and newer_edition.jurisdiction_code = exam_edition.jurisdiction_code
        and newer_edition.status in ('held', 'published')
        and (
          newer_edition.exam_date > exam_edition.exam_date
          or (
            newer_edition.exam_date = exam_edition.exam_date
            and newer_edition.id > exam_edition.id
          )
        )
        and newer_edition.exam_date < (current_timestamp at time zone 'America/Sao_Paulo')::date
        and (opportunity.exam_date is null or newer_edition.exam_date < opportunity.exam_date)
    )`;
}

function approvedBookletConditions(
  coverageEndsAt: SQLWrapper,
  requireLicense: boolean,
) {
  const validLicense = sql`
    exam_document.source_policy = 'licensed_content'
    and exam_document.licensed_at is not null
    and exam_document.licensed_at <= current_timestamp
    and nullif(btrim(exam_document.rights_holder), '') is not null
    and nullif(btrim(exam_document.license_basis), '') is not null
    and nullif(btrim(exam_document.license_reference), '') is not null
    and exam_document.license_evidence_checksum_sha256 ~ '^[0-9a-f]{64}$'
    and exam_document.license_evidence_checked_at is not null
    and exam_document.license_evidence_checked_at <= current_timestamp
    and exam_document.license_evidence_checked_at <= exam_document.reviewed_at
    and ${licenseCovers(sql`exam_document.license_expires_at`, coverageEndsAt)}`;

  return sql`
    and exam_document.document_type = 'question_booklet'
    and exam_document.status = 'approved'
    and exam_document.reviewed_by_user_id is not null
    and exam_document.reviewed_at is not null
    and exam_document.http_status between 200 and 399
    and exam_document.distribution_mode = 'external_link'
    and lower(split_part(exam_document.content_type, ';', 1)) = 'application/pdf'
    and exam_document.expected_question_count between 1 and 300
    and ${freshnessSatisfied(sql`exam_document.source_checked_at`)}
    and ${officialExamUrlAllowed(
      sql`exam_bank.slug`,
      sql`exam_document.source_url`,
      sql`exam_document.source_host`,
    )}
    and ${
      requireLicense
        ? sql`(${validLicense})`
        : sql`(
            exam_document.source_policy = 'metadata_only'
            or (${validLicense})
          )`
    }`;
}

function approvedAnswerKeyConditions(coverageEndsAt: SQLWrapper) {
  return sql`
    and answer_key_document.document_type = 'answer_key'
    and answer_key_document.id <> exam_document.id
    and answer_key_document.status = 'approved'
    and answer_key_document.reviewed_by_user_id is not null
    and answer_key_document.reviewed_at is not null
    and answer_key_document.http_status between 200 and 399
    and answer_key_document.distribution_mode = 'external_link'
    and lower(split_part(answer_key_document.content_type, ';', 1)) = 'application/pdf'
    and answer_key_document.expected_question_count is null
    and ${freshnessSatisfied(sql`answer_key_document.source_checked_at`)}
    and ${officialExamUrlAllowed(
      sql`exam_bank.slug`,
      sql`answer_key_document.source_url`,
      sql`answer_key_document.source_host`,
    )}
    and answer_key_document.source_policy = 'licensed_content'
    and answer_key_document.licensed_at is not null
    and answer_key_document.licensed_at <= current_timestamp
    and nullif(btrim(answer_key_document.rights_holder), '') is not null
    and nullif(btrim(answer_key_document.license_basis), '') is not null
    and nullif(btrim(answer_key_document.license_reference), '') is not null
    and answer_key_document.license_evidence_checksum_sha256 ~ '^[0-9a-f]{64}$'
    and answer_key_document.license_evidence_checked_at is not null
    and answer_key_document.license_evidence_checked_at <= current_timestamp
    and answer_key_document.license_evidence_checked_at <= answer_key_document.reviewed_at
    and ${licenseCovers(
      sql`answer_key_document.license_expires_at`,
      coverageEndsAt,
    )}`;
}

/** Confirma que o produto possui a última prova exata com caderno e gabarito
 * oficiais, aprovados e licenciados. A reprodução das questões ainda depende
 * do predicado integral por questão usado na entrega. */
export function approvedProductPreviousExamReferenceExists(
  productSlug: SQLWrapper,
  opportunityId?: SQLWrapper,
) {
  return sql<boolean>`exists (
    select 1
    from contest_product_exam_references exam_reference
    join contest_store_products exam_product
      on exam_product.slug = exam_reference.product_slug
    join exam_editions exam_edition
      on exam_edition.id = exam_reference.exam_edition_id
    join quiz_banks exam_bank
      on exam_bank.id = exam_edition.bank_id
    join contest_opportunities opportunity
      on opportunity.id = exam_product.opportunity_id
    join exam_edition_documents exam_document
      on exam_document.id = exam_reference.primary_document_id
      and exam_document.exam_edition_id = exam_reference.exam_edition_id
    join exam_edition_documents answer_key_document
      on answer_key_document.id = exam_reference.answer_key_document_id
      and answer_key_document.exam_edition_id = exam_reference.exam_edition_id
    where exam_reference.product_slug = ${productSlug}
      ${opportunityCondition(opportunityId)}
      and exam_reference.relationship = 'latest_previous_exam'
      and exam_reference.status = 'approved'
      and exam_reference.reviewed_by_user_id is not null
      and exam_reference.reviewed_at is not null
      and exam_reference.selection_verified_at is not null
      ${exactHistoricalScopeConditions()}
      ${approvedBookletConditions(sql`current_timestamp`, true)}
      ${approvedAnswerKeyConditions(sql`current_timestamp`)}
  )`;
}

function qualifiedPreviousQuestionConditions(coverageEndsAt: SQLWrapper) {
  return sql`
    and exam_edition.source_policy = 'licensed_content'
    and previous_question.quiz_mode = 'previous_exam'
    and previous_question.editorial_status = 'reviewed'
    and previous_question.created_by_user_id is not null
    and previous_question.reviewed_by_user_id is not null
    and previous_question.reviewed_by_user_id <> previous_question.created_by_user_id
    and previous_question.submitted_at is not null
    and nullif(btrim(previous_question.review_notes), '') is not null
    and char_length(btrim(previous_question.review_notes)) between 20 and 1500
    and previous_question.source_rights = 'licensed'
    and previous_question.exam_edition_document_id = exam_document.id
    and previous_question.exam_edition_answer_key_document_id = answer_key_document.id
    and previous_question.exam_edition_answer_key_document_type = 'answer_key'
    and previous_question.source_title = exam_document.title
    and previous_question.source_url = exam_document.source_url
    and nullif(btrim(previous_question.source_title), '') is not null
    and nullif(btrim(previous_question.original_question_number), '') is not null
    and previous_question.original_question_order between 1 and exam_document.expected_question_count
    and previous_question.licensed_at is not null
    and previous_question.licensed_at <= current_timestamp
    and previous_question.source_rights_holder = exam_document.rights_holder
    and previous_question.license_basis = exam_document.license_basis
    and previous_question.license_reference = exam_document.license_reference
    and previous_question.licensed_at = exam_document.licensed_at
    and previous_question.license_expires_at is not distinct from exam_document.license_expires_at
    and ${licenseCovers(sql`previous_question.license_expires_at`, coverageEndsAt)}
    and previous_question.verified_at <= current_timestamp
    and char_length(btrim(previous_question.prompt)) between 20 and 20000
    and char_length(btrim(previous_question.explanation)) between 20 and 20000
    and char_length(btrim(previous_question.topic)) between 2 and 500
    and previous_question.type in ('true_false', 'multiple_choice')
    and exists (
      select 1
      from quiz_career_subjects career_subject
      where career_subject.career_track_id = exam_edition.career_track_id
        and career_subject.subject_id = previous_question.subject_id
    )
    and (
      previous_question.topic_id is null
      or exists (
        select 1
        from quiz_topics mapped_topic
        where mapped_topic.id = previous_question.topic_id
          and mapped_topic.subject_id = previous_question.subject_id
          and mapped_topic.is_active = true
      )
    )
    and (
      (
        select count(*)
        from question_options typed_option
        where typed_option.question_id = previous_question.id
      ) = case
        when previous_question.type = 'true_false' then 2
        else 4
      end
      or (
        previous_question.type = 'multiple_choice'
        and (
          select count(*)
          from question_options five_option
          where five_option.question_id = previous_question.id
        ) = 5
      )
    )
    and (
      select count(*)
      from question_options correct_option
      where correct_option.question_id = previous_question.id
        and correct_option.is_correct = true
    ) = 1
    and not exists (
      select 1
      from question_options invalid_option
      where invalid_option.question_id = previous_question.id
        and (
          char_length(btrim(invalid_option.option_key)) not between 1 and 10
          or char_length(btrim(invalid_option.text)) not between 1 and 5000
          or char_length(btrim(coalesce(invalid_option.rationale, ''))) not between 10 and 5000
        )
    )`;
}

/**
 * Valida uma questão histórica licenciada sem vinculá-la à venda de um produto
 * específico. Essa variante alimenta estatísticas editoriais de longo prazo:
 * exige edição oficial, caderno e gabarito aprovados, licença vigente e revisão
 * independente da questão, mas não exige que a edição seja a última de um cargo.
 */
export function approvedHistoricalPreviousExamQuestionExists(
  questionId: SQLWrapper,
  coverageEndsAt: SQLWrapper = sql`current_timestamp`,
) {
  return sql<boolean>`exists (
    select 1
    from questions previous_question
    join exam_editions exam_edition
      on exam_edition.id = previous_question.exam_edition_id
    join quiz_banks exam_bank
      on exam_bank.id = exam_edition.bank_id
    join exam_edition_documents exam_document
      on exam_document.id = previous_question.exam_edition_document_id
      and exam_document.exam_edition_id = exam_edition.id
    join exam_edition_documents answer_key_document
      on answer_key_document.id = previous_question.exam_edition_answer_key_document_id
      and answer_key_document.exam_edition_id = exam_edition.id
    where previous_question.id = ${questionId}
      and exam_edition.status in ('held', 'published')
      and exam_edition.exam_date < (current_timestamp at time zone 'America/Sao_Paulo')::date
      and ${freshnessSatisfied(sql`exam_edition.source_checked_at`)}
      and ${officialExamUrlAllowed(sql`exam_bank.slug`, sql`exam_edition.official_url`)}
      and exam_bank.is_active = true
      ${approvedBookletConditions(coverageEndsAt, true)}
      ${approvedAnswerKeyConditions(coverageEndsAt)}
      ${qualifiedPreviousQuestionConditions(coverageEndsAt)}
  )`;
}

/**
 * Revalida, a cada leitura, toda a cadeia produto -> última edição -> caderno
 * -> questão. Um simples link público ou um PDF em domínio oficial não concede
 * direito de reproduzir o enunciado dentro da área paga.
 */
export function approvedProductPreviousExamQuestionExists(
  productSlug: SQLWrapper,
  questionId: SQLWrapper,
  opportunityId?: SQLWrapper,
  coverageEndsAt: SQLWrapper = sql`current_timestamp`,
  requireReleasedProduct = false,
) {
  return sql<boolean>`exists (
    select 1
    from contest_product_exam_references exam_reference
    join contest_store_products exam_product
      on exam_product.slug = exam_reference.product_slug
    join exam_editions exam_edition
      on exam_edition.id = exam_reference.exam_edition_id
    join quiz_banks exam_bank
      on exam_bank.id = exam_edition.bank_id
    join contest_opportunities opportunity
      on opportunity.id = exam_product.opportunity_id
    join exam_edition_documents exam_document
      on exam_document.id = exam_reference.primary_document_id
      and exam_document.exam_edition_id = exam_reference.exam_edition_id
    join exam_edition_documents answer_key_document
      on answer_key_document.id = exam_reference.answer_key_document_id
      and answer_key_document.exam_edition_id = exam_reference.exam_edition_id
    join questions previous_question
      on previous_question.exam_edition_id = exam_reference.exam_edition_id
      and previous_question.exam_edition_document_id = exam_document.id
    where exam_reference.product_slug = ${productSlug}
      and previous_question.id = ${questionId}
      ${opportunityCondition(opportunityId)}
      ${productReleaseCondition(requireReleasedProduct)}
      and exam_reference.relationship = 'latest_previous_exam'
      and exam_reference.status = 'approved'
      and exam_reference.reviewed_by_user_id is not null
      and exam_reference.reviewed_at is not null
      and exam_reference.selection_verified_at is not null
      ${exactHistoricalScopeConditions()}
      ${approvedBookletConditions(coverageEndsAt, true)}
      ${approvedAnswerKeyConditions(coverageEndsAt)}
      ${qualifiedPreviousQuestionConditions(coverageEndsAt)}
  )`;
}

export function approvedProductPreviousExamQuestionCount(
  productSlug: SQLWrapper,
  opportunityId?: SQLWrapper,
  coverageEndsAt: SQLWrapper = sql`current_timestamp`,
  requireReleasedProduct = false,
) {
  return sql<number>`(
    select count(distinct licensed_question.id)::integer
    from questions licensed_question
    where ${approvedProductPreviousExamQuestionExists(
      productSlug,
      sql`licensed_question.id`,
      opportunityId,
      coverageEndsAt,
      requireReleasedProduct,
    )}
  )`.mapWith(Number);
}

export function approvedProductPreviousExamExpectedQuestionCount(
  productSlug: SQLWrapper,
  opportunityId?: SQLWrapper,
  coverageEndsAt: SQLWrapper = sql`current_timestamp`,
  requireReleasedProduct = false,
) {
  return sql<number>`coalesce((
    select exam_document.expected_question_count
    from contest_product_exam_references exam_reference
    join contest_store_products exam_product
      on exam_product.slug = exam_reference.product_slug
    join exam_editions exam_edition
      on exam_edition.id = exam_reference.exam_edition_id
    join quiz_banks exam_bank
      on exam_bank.id = exam_edition.bank_id
    join contest_opportunities opportunity
      on opportunity.id = exam_product.opportunity_id
    join exam_edition_documents exam_document
      on exam_document.id = exam_reference.primary_document_id
      and exam_document.exam_edition_id = exam_reference.exam_edition_id
    join exam_edition_documents answer_key_document
      on answer_key_document.id = exam_reference.answer_key_document_id
      and answer_key_document.exam_edition_id = exam_reference.exam_edition_id
    where exam_reference.product_slug = ${productSlug}
      ${opportunityCondition(opportunityId)}
      ${productReleaseCondition(requireReleasedProduct)}
      and exam_reference.relationship = 'latest_previous_exam'
      and exam_reference.status = 'approved'
      and exam_reference.reviewed_by_user_id is not null
      and exam_reference.reviewed_at is not null
      and exam_reference.selection_verified_at is not null
      ${exactHistoricalScopeConditions()}
      ${approvedBookletConditions(coverageEndsAt, true)}
      ${approvedAnswerKeyConditions(coverageEndsAt)}
    order by exam_reference.id desc
    limit 1
  ), 0)`.mapWith(Number);
}

/** A prova somente está completa quando todas as posições previstas no caderno
 * têm uma questão qualificada e licenciada pelo mesmo instrumento. */
export function licensedPreviousExamContentSatisfied(
  productSlug: SQLWrapper,
  opportunityId?: SQLWrapper,
  coverageEndsAt: SQLWrapper = sql`current_timestamp`,
  requireReleasedProduct = false,
) {
  const expected = approvedProductPreviousExamExpectedQuestionCount(
    productSlug,
    opportunityId,
    coverageEndsAt,
    requireReleasedProduct,
  );
  return sql<boolean>`${expected} between 1 and 300
    and ${approvedProductPreviousExamQuestionCount(
      productSlug,
      opportunityId,
      coverageEndsAt,
      requireReleasedProduct,
    )} = ${expected}`;
}

/** Impede o Master de enxergar questões órfãs ou ligadas somente a produtos em
 * rascunho. O mesmo predicado completo usado na venda é aplicado na entrega. */
export function approvedReleasedProductPreviousExamQuestionExists(
  questionId: SQLWrapper,
  coverageEndsAt: SQLWrapper = sql`current_timestamp`,
) {
  return sql<boolean>`exists (
    select 1
    from contest_store_products released_exam_product
    where released_exam_product.status = 'released'
      and released_exam_product.opportunity_id is not null
      and ${licensedPreviousExamContentSatisfied(
        sql`released_exam_product.slug`,
        sql`released_exam_product.opportunity_id`,
        coverageEndsAt,
        true,
      )}
      and ${approvedProductPreviousExamQuestionExists(
        sql`released_exam_product.slug`,
        questionId,
        sql`released_exam_product.opportunity_id`,
        coverageEndsAt,
        true,
      )}
  )`;
}
