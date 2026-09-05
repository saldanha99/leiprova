import { and, eq, isNotNull, sql, type SQLWrapper } from "drizzle-orm";

import { legalActs, legalArticles, legalVersions, questions } from "@/lib/db/schema";
import { resolveOriginalStyleEligibility } from "@/lib/quiz/original-style-eligibility";

function authorialSourceConditions(bankId: number | SQLWrapper) {
  return and(
    eq(questions.editorialStatus, "reviewed"),
    eq(questions.quizMode, "original_style"), eq(questions.styleBankId, bankId),
    eq(questions.sourceRights, "original_authorial"), isNotNull(questions.reviewedByUserId),
    isNotNull(questions.legalArticleId), eq(legalArticles.editorialStatus, "reviewed"),
    eq(legalArticles.sourceRights, "official_text"), eq(legalVersions.status, "current"),
    eq(legalActs.isActive, true),
  );
}

function exactEditionRequirementExists(examEditionId: number | SQLWrapper) {
  return sql`exists (
    select 1 from question_opportunities link
    join contest_opportunities opportunity on opportunity.id = link.opportunity_id
    join opportunity_requirements requirement on requirement.opportunity_id = opportunity.id
      and requirement.legal_article_id = ${questions.legalArticleId}
      and requirement.subject_id = ${questions.subjectId}
      and requirement.editorial_status = 'reviewed'
    join opportunity_source_documents source on source.id = requirement.source_document_id
      and source.status = 'approved'
    left join opportunity_document_snapshots snapshot on snapshot.id = requirement.source_snapshot_id
    where link.question_id = ${questions.id} and link.relationship = 'direct_requirement'
      and opportunity.editorial_status = 'reviewed'
      and opportunity.exam_edition_id = ${examEditionId}
      and (requirement.source_snapshot_id is null or snapshot.status = 'approved')
  )`;
}

/** Usada pela rota e pelos testes SQL: edição exata e lastro ainda válido. */
export function originalStyleConditions(selection: { bankId: number | null }, examEditionId: number | null) {
  const eligibility = resolveOriginalStyleEligibility({ bankId: selection.bankId, examEditionId });
  if (!eligibility.eligible) return sql`false`;
  const legalSource = authorialSourceConditions(eligibility.bankId);
  return eligibility.scope === "general_bank"
    ? legalSource : and(legalSource, exactEditionRequirementExists(eligibility.examEditionId));
}

/** Não oferece prova futura apenas porque a oportunidade foi revisada.
 * Exige pelo menos uma questão publicável do programa; filtros de matéria ainda
 * podem reduzir o recorte a zero, sem prometer cobertura integral do edital. */
export function editionHasOriginalTraining(examEditionId: number | SQLWrapper, bankId: number | SQLWrapper) {
  return sql<boolean>`exists (
    select 1 from ${questions}
    join ${legalArticles} on ${legalArticles.id} = ${questions.legalArticleId}
    join ${legalVersions} on ${legalVersions.id} = ${legalArticles.legalVersionId}
    join ${legalActs} on ${legalActs.id} = ${legalVersions.legalActId}
    where ${authorialSourceConditions(bankId)}
      and ${exactEditionRequirementExists(examEditionId)}
  )`;
}
