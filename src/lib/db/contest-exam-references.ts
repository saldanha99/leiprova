import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  contestOpportunities,
  contestProductExamReferences,
  contestStoreProducts,
  examEditionDocuments,
  examEditions,
  quizBanks,
} from "@/lib/db/schema";
import {
  buildPublicContestExamReference,
  type PublicContestExamReference,
  type PublicExamReferenceCandidateRow,
} from "@/lib/exams/public-exam-reference-policy";
import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";

const publicExamReferenceSelection = {
  referenceId: contestProductExamReferences.id,
  referencePublicId: contestProductExamReferences.publicId,
  referenceStatus: contestProductExamReferences.status,
  relationship: contestProductExamReferences.relationship,
  primaryDocumentId: contestProductExamReferences.primaryDocumentId,
  answerKeyDocumentId: contestProductExamReferences.answerKeyDocumentId,
  referenceReviewedByUserId:
    contestProductExamReferences.reviewedByUserId,
  referenceReviewedAt: contestProductExamReferences.reviewedAt,
  selectionVerifiedAt: contestProductExamReferences.selectionVerifiedAt,
  editionId: examEditions.id,
  editionPublicId: examEditions.publicId,
  editionTitle: examEditions.title,
  examDate: examEditions.examDate,
  editionStatus: examEditions.status,
  editionOfficialUrl: examEditions.officialUrl,
  editionSourceCheckedAt: examEditions.sourceCheckedAt,
  opportunityInstitutionAcronym: contestOpportunities.institutionAcronym,
  opportunityJurisdictionCode: contestOpportunities.jurisdictionCode,
  editionInstitutionAcronym: examEditions.institutionAcronym,
  editionJurisdictionCode: examEditions.jurisdictionCode,
  bankSlug: quizBanks.slug,
  bankName: quizBanks.name,
  documentId: examEditionDocuments.id,
  documentPublicId: examEditionDocuments.publicId,
  documentExamEditionId: examEditionDocuments.examEditionId,
  documentType: examEditionDocuments.documentType,
  documentTitle: examEditionDocuments.title,
  sourceUrl: examEditionDocuments.sourceUrl,
  sourceHost: examEditionDocuments.sourceHost,
  sourceCheckedAt: examEditionDocuments.sourceCheckedAt,
  httpStatus: examEditionDocuments.httpStatus,
  contentType: examEditionDocuments.contentType,
  expectedQuestionCount: examEditionDocuments.expectedQuestionCount,
  distributionMode: examEditionDocuments.distributionMode,
  sourcePolicy: examEditionDocuments.sourcePolicy,
  rightsHolder: examEditionDocuments.rightsHolder,
  licenseBasis: examEditionDocuments.licenseBasis,
  licenseReference: examEditionDocuments.licenseReference,
  licenseEvidenceChecksumSha256:
    examEditionDocuments.licenseEvidenceChecksumSha256,
  licenseEvidenceCheckedAt: examEditionDocuments.licenseEvidenceCheckedAt,
  licensedAt: examEditionDocuments.licensedAt,
  licenseExpiresAt: examEditionDocuments.licenseExpiresAt,
  documentStatus: examEditionDocuments.status,
  documentReviewedByUserId: examEditionDocuments.reviewedByUserId,
  documentReviewedAt: examEditionDocuments.reviewedAt,
} as const;

function isExamReferenceCatalogUnavailable(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      (current as { code?: unknown }).code === "42P01"
    ) {
      return true;
    }
    current =
      "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}

/**
 * Expõe somente metadados revisados e links HTTPS na fonte oficial. Cópias
 * hospedadas permanecem fora da camada pública até existir uma entrega
 * autenticada própria; dados internos da licença nunca entram no DTO.
 */
export async function getApprovedContestExamReference(
  productSlug: string,
  referenceDate = new Date(),
): Promise<PublicContestExamReference | null> {
  const normalizedProductSlug = productSlug.trim();
  if (!normalizedProductSlug) return null;
  const referenceDateIso = saoPauloCalendarDate(referenceDate);

  try {
    const rows = await getDb()
      .select(publicExamReferenceSelection)
      .from(contestProductExamReferences)
      .innerJoin(
        contestStoreProducts,
        eq(
          contestProductExamReferences.productSlug,
          contestStoreProducts.slug,
        ),
      )
      .innerJoin(
        contestOpportunities,
        eq(contestStoreProducts.opportunityId, contestOpportunities.id),
      )
      .innerJoin(
        examEditions,
        eq(contestProductExamReferences.examEditionId, examEditions.id),
      )
      .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
      .innerJoin(
        examEditionDocuments,
        and(
          eq(examEditionDocuments.examEditionId, examEditions.id),
          or(
            eq(
              examEditionDocuments.id,
              contestProductExamReferences.primaryDocumentId,
            ),
            eq(
              examEditionDocuments.id,
              contestProductExamReferences.answerKeyDocumentId,
            ),
          ),
        ),
      )
      .where(
        and(
          eq(contestProductExamReferences.productSlug, normalizedProductSlug),
          eq(
            contestProductExamReferences.relationship,
            "latest_previous_exam",
          ),
          eq(contestProductExamReferences.status, "approved"),
          isNotNull(contestProductExamReferences.reviewedByUserId),
          isNotNull(contestProductExamReferences.reviewedAt),
          isNotNull(contestProductExamReferences.selectionVerifiedAt),
          eq(contestOpportunities.editorialStatus, "reviewed"),
          eq(
            contestOpportunities.careerTrackId,
            examEditions.careerTrackId,
          ),
          sql`${contestOpportunities.specializationId} is not distinct from ${examEditions.specializationId}`,
          eq(
            contestOpportunities.institutionAcronym,
            examEditions.institutionAcronym,
          ),
          eq(
            contestOpportunities.jurisdictionCode,
            examEditions.jurisdictionCode,
          ),
          inArray(examEditions.status, ["held", "published"]),
          sql`${examEditions.examDate} < coalesce(${contestOpportunities.examDate}, ${referenceDateIso}::date)`,
          sql`${examEditions.examDate} < ${referenceDateIso}::date`,
          isNotNull(examEditions.officialUrl),
          sql`char_length(btrim(${examEditions.officialUrl})) > 0`,
          isNotNull(examEditions.sourceCheckedAt),
          sql`${examEditions.sourceCheckedAt} <= ${referenceDate}`,
          sql`${examEditions.sourceCheckedAt} >= ${referenceDate} - interval '30 days'`,
          eq(quizBanks.isActive, true),
          sql`exists (
            select 1
            from opportunity_organizer_assignments assignment
            where assignment.opportunity_id = ${contestOpportunities.id}
              and assignment.status = 'reviewed'
              and assignment.valid_until is null
              and assignment.quiz_bank_id = ${examEditions.bankId}
              and (
                assignment.role = 'examination_provider'
                or (
                  assignment.role = 'primary_responsible'
                  and not exists (
                    select 1
                    from opportunity_organizer_assignments examiner
                    where examiner.opportunity_id = ${contestOpportunities.id}
                      and examiner.role = 'examination_provider'
                      and examiner.status = 'reviewed'
                      and examiner.valid_until is null
                  )
                )
              )
          )`,
          sql`not exists (
            select 1
            from exam_editions newer_edition
            where newer_edition.id <> ${examEditions.id}
              and newer_edition.bank_id = ${examEditions.bankId}
              and newer_edition.career_track_id = ${examEditions.careerTrackId}
              and newer_edition.specialization_id is not distinct from ${examEditions.specializationId}
              and newer_edition.institution_acronym = ${examEditions.institutionAcronym}
              and newer_edition.jurisdiction_code = ${examEditions.jurisdictionCode}
              and newer_edition.status in ('held', 'published')
              and (
                newer_edition.exam_date > ${examEditions.examDate}
                or (
                  newer_edition.exam_date = ${examEditions.examDate}
                  and newer_edition.id > ${examEditions.id}
                )
              )
              and newer_edition.exam_date < coalesce(${contestOpportunities.examDate}, ${referenceDateIso}::date)
              and newer_edition.exam_date < ${referenceDateIso}::date
          )`,
          eq(examEditionDocuments.status, "approved"),
          isNotNull(examEditionDocuments.reviewedByUserId),
          isNotNull(examEditionDocuments.reviewedAt),
          eq(examEditionDocuments.distributionMode, "external_link"),
          sql`lower(split_part(${examEditionDocuments.contentType}, ';', 1)) = 'application/pdf'`,
          gte(examEditionDocuments.httpStatus, 200),
          lte(examEditionDocuments.httpStatus, 399),
          isNotNull(examEditionDocuments.sourceCheckedAt),
          sql`${examEditionDocuments.sourceCheckedAt} <= ${referenceDate}`,
          sql`${examEditionDocuments.sourceCheckedAt} >= ${referenceDate} - interval '30 days'`,
          or(
            eq(examEditionDocuments.sourcePolicy, "metadata_only"),
            and(
              eq(examEditionDocuments.sourcePolicy, "licensed_content"),
              isNotNull(examEditionDocuments.licensedAt),
              lte(examEditionDocuments.licensedAt, referenceDate),
              isNotNull(examEditionDocuments.rightsHolder),
              isNotNull(examEditionDocuments.licenseBasis),
              isNotNull(examEditionDocuments.licenseReference),
              sql`${examEditionDocuments.licenseEvidenceChecksumSha256} ~ '^[0-9a-f]{64}$'`,
              isNotNull(examEditionDocuments.licenseEvidenceCheckedAt),
              lte(examEditionDocuments.licenseEvidenceCheckedAt, referenceDate),
              sql`${examEditionDocuments.licenseEvidenceCheckedAt} <= ${examEditionDocuments.reviewedAt}`,
              or(
                isNull(examEditionDocuments.licenseExpiresAt),
                gt(examEditionDocuments.licenseExpiresAt, referenceDate),
              ),
            ),
          ),
        ),
      )
      .orderBy(
        desc(contestProductExamReferences.selectionVerifiedAt),
        desc(contestProductExamReferences.id),
        asc(examEditionDocuments.documentType),
        asc(examEditionDocuments.title),
        asc(examEditionDocuments.id),
      );

    return buildPublicContestExamReference(
      rows as PublicExamReferenceCandidateRow[],
      referenceDate,
    );
  } catch (error) {
    // Permite publicar o código antes da migração sem vazar um estado parcial.
    if (isExamReferenceCatalogUnavailable(error)) return null;
    throw error;
  }
}

/** Resolve apenas o identificador técnico já vinculado à oportunidade. O estado
 * comercial do produto não é alterado nem inferido por esta consulta. */
export async function getContestProductSlugForOpportunity(
  opportunityPublicId: string,
): Promise<string | null> {
  const normalizedPublicId = opportunityPublicId.trim();
  if (!normalizedPublicId) return null;
  try {
    const [row] = await getDb()
      .select({ slug: contestStoreProducts.slug })
      .from(contestStoreProducts)
      .innerJoin(
        contestOpportunities,
        eq(contestStoreProducts.opportunityId, contestOpportunities.id),
      )
      .where(eq(contestOpportunities.publicId, normalizedPublicId))
      .orderBy(contestStoreProducts.slug)
      .limit(1);
    return row?.slug ?? null;
  } catch (error) {
    if (isExamReferenceCatalogUnavailable(error)) return null;
    throw error;
  }
}

export type { PublicContestExamReference };
