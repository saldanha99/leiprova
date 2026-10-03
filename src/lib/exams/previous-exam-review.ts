import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";

import * as schema from "@/lib/db/schema";
import {
  contestOpportunities,
  contestStoreProducts,
  examEditionDocuments,
  examEditions,
  opportunityOrganizerAssignments,
  quizBanks,
} from "@/lib/db/schema";
import { isOfficialExamUrl } from "@/lib/official-sources/exam-registry";

// Consultas da revisão de provas anteriores, compartilhadas entre o painel e
// o comando de servidor (sem server-only, para rodar também fora do Next).
type PreviousExamDatabase = PostgresJsDatabase<typeof schema>;
type PreviousExamTransaction = Parameters<
  Parameters<PreviousExamDatabase["transaction"]>[0]
>[0];
export type PreviousExamReader = PreviousExamDatabase | PreviousExamTransaction;

export const answerKeyDocuments = alias(
  examEditionDocuments,
  "answer_key_exam_document",
);

export async function loadDocumentReviewCandidate(
  database: PreviousExamReader,
  publicId: string,
) {
  const [document] = await database
    .select({
      id: examEditionDocuments.id,
      publicId: examEditionDocuments.publicId,
      examEditionId: examEditionDocuments.examEditionId,
      documentType: examEditionDocuments.documentType,
      title: examEditionDocuments.title,
      sourceUrl: examEditionDocuments.sourceUrl,
      sourceHost: examEditionDocuments.sourceHost,
      sourcePolicy: examEditionDocuments.sourcePolicy,
      expectedQuestionCount: examEditionDocuments.expectedQuestionCount,
      rightsHolder: examEditionDocuments.rightsHolder,
      licenseBasis: examEditionDocuments.licenseBasis,
      licenseReference: examEditionDocuments.licenseReference,
      licenseEvidenceChecksumSha256:
        examEditionDocuments.licenseEvidenceChecksumSha256,
      licenseEvidenceCheckedAt:
        examEditionDocuments.licenseEvidenceCheckedAt,
      licensedAt: examEditionDocuments.licensedAt,
      sourceCheckedAt: examEditionDocuments.sourceCheckedAt,
      httpStatus: examEditionDocuments.httpStatus,
      contentType: examEditionDocuments.contentType,
      status: examEditionDocuments.status,
      initiatedByUserId: examEditionDocuments.initiatedByUserId,
      licenseExpiresAt: examEditionDocuments.licenseExpiresAt,
      bankSlug: quizBanks.slug,
      editionStatus: examEditions.status,
      editionExamDate: examEditions.examDate,
      editionOfficialUrl: examEditions.officialUrl,
      editionSourceCheckedAt: examEditions.sourceCheckedAt,
    })
    .from(examEditionDocuments)
    .innerJoin(
      examEditions,
      eq(examEditionDocuments.examEditionId, examEditions.id),
    )
    .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
    .where(eq(examEditionDocuments.publicId, publicId))
    .limit(1);
  return document ?? null;
}

export const referenceSchema = z.object({
  productSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  examPublicId: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  documentPublicId: z.string().uuid(),
  answerKeyDocumentPublicId: z.string().uuid(),
});

export async function loadReferenceScope(
  database: PreviousExamReader,
  input: z.infer<typeof referenceSchema>,
  todayIso: string,
) {
  const [scope] = await database
    .select({
      productStatus: contestStoreProducts.status,
      opportunityId: contestOpportunities.id,
      opportunityEditorialStatus: contestOpportunities.editorialStatus,
      opportunityExamDate: contestOpportunities.examDate,
      opportunityInstitutionAcronym: contestOpportunities.institutionAcronym,
      opportunityJurisdictionCode: contestOpportunities.jurisdictionCode,
      opportunityCareerTrackId: contestOpportunities.careerTrackId,
      opportunitySpecializationId: contestOpportunities.specializationId,
      editionId: examEditions.id,
      editionStatus: examEditions.status,
      editionExamDate: examEditions.examDate,
      editionOfficialUrl: examEditions.officialUrl,
      editionSourceCheckedAt: examEditions.sourceCheckedAt,
      editionInstitutionAcronym: examEditions.institutionAcronym,
      editionJurisdictionCode: examEditions.jurisdictionCode,
      editionCareerTrackId: examEditions.careerTrackId,
      editionSpecializationId: examEditions.specializationId,
      editionBankId: examEditions.bankId,
      bankSlug: quizBanks.slug,
      documentId: examEditionDocuments.id,
      documentStatus: examEditionDocuments.status,
      documentType: examEditionDocuments.documentType,
      documentExamEditionId: examEditionDocuments.examEditionId,
      documentHttpStatus: examEditionDocuments.httpStatus,
      documentContentType: examEditionDocuments.contentType,
      documentExpectedQuestionCount:
        examEditionDocuments.expectedQuestionCount,
      documentSourceUrl: examEditionDocuments.sourceUrl,
      documentSourceCheckedAt: examEditionDocuments.sourceCheckedAt,
      documentSourcePolicy: examEditionDocuments.sourcePolicy,
      documentRightsHolder: examEditionDocuments.rightsHolder,
      documentLicenseBasis: examEditionDocuments.licenseBasis,
      documentLicenseReference: examEditionDocuments.licenseReference,
      documentLicenseEvidenceChecksumSha256:
        examEditionDocuments.licenseEvidenceChecksumSha256,
      documentLicenseEvidenceCheckedAt:
        examEditionDocuments.licenseEvidenceCheckedAt,
      documentLicensedAt: examEditionDocuments.licensedAt,
      documentLicenseExpiresAt: examEditionDocuments.licenseExpiresAt,
      answerKeyDocumentId: answerKeyDocuments.id,
      answerKeyDocumentStatus: answerKeyDocuments.status,
      answerKeyDocumentType: answerKeyDocuments.documentType,
      answerKeyDocumentExamEditionId: answerKeyDocuments.examEditionId,
      answerKeyDocumentHttpStatus: answerKeyDocuments.httpStatus,
      answerKeyDocumentContentType: answerKeyDocuments.contentType,
      answerKeyDocumentSourceUrl: answerKeyDocuments.sourceUrl,
      answerKeyDocumentSourceCheckedAt: answerKeyDocuments.sourceCheckedAt,
      answerKeyDocumentSourcePolicy: answerKeyDocuments.sourcePolicy,
      answerKeyDocumentRightsHolder: answerKeyDocuments.rightsHolder,
      answerKeyDocumentLicenseBasis: answerKeyDocuments.licenseBasis,
      answerKeyDocumentLicenseReference: answerKeyDocuments.licenseReference,
      answerKeyDocumentLicenseEvidenceChecksumSha256:
        answerKeyDocuments.licenseEvidenceChecksumSha256,
      answerKeyDocumentLicenseEvidenceCheckedAt:
        answerKeyDocuments.licenseEvidenceCheckedAt,
      answerKeyDocumentLicensedAt: answerKeyDocuments.licensedAt,
      answerKeyDocumentLicenseExpiresAt: answerKeyDocuments.licenseExpiresAt,
      newerEligibleEditionExists: sql<boolean>`exists (
        select 1
        from exam_editions newer_edition
        where newer_edition.id <> ${examEditions.id}
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
          and newer_edition.exam_date < coalesce(${contestOpportunities.examDate}, ${todayIso}::date)
          and newer_edition.exam_date < ${todayIso}::date
      )`.mapWith(Boolean),
    })
    .from(contestStoreProducts)
    .innerJoin(
      contestOpportunities,
      eq(contestStoreProducts.opportunityId, contestOpportunities.id),
    )
    .innerJoin(examEditions, eq(examEditions.publicId, input.examPublicId))
    .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
    .innerJoin(
      examEditionDocuments,
      and(
        eq(examEditionDocuments.publicId, input.documentPublicId),
        eq(examEditionDocuments.examEditionId, examEditions.id),
      ),
    )
    .innerJoin(
      answerKeyDocuments,
      and(
        eq(
          answerKeyDocuments.publicId,
          input.answerKeyDocumentPublicId,
        ),
        eq(answerKeyDocuments.examEditionId, examEditions.id),
      ),
    )
    .where(eq(contestStoreProducts.slug, input.productSlug))
    .limit(1);
  if (!scope) return null;

  const assignments = await database
    .select({
      role: opportunityOrganizerAssignments.role,
      bankId: opportunityOrganizerAssignments.quizBankId,
    })
    .from(opportunityOrganizerAssignments)
    .where(
      and(
        eq(opportunityOrganizerAssignments.opportunityId, scope.opportunityId),
        eq(opportunityOrganizerAssignments.status, "reviewed"),
        isNull(opportunityOrganizerAssignments.validUntil),
        inArray(opportunityOrganizerAssignments.role, [
          "examination_provider",
          "primary_responsible",
        ]),
      ),
    );
  const responsibleBankId =
    assignments.find((item) => item.role === "examination_provider")?.bankId ??
    assignments.find((item) => item.role === "primary_responsible")?.bankId ??
    null;

  return {
    ...scope,
    responsibleBankId,
    documentIsOfficialSource: isOfficialExamUrl(
      scope.bankSlug,
      scope.documentSourceUrl,
    ),
    editionIsOfficialSource: isOfficialExamUrl(
      scope.bankSlug,
      scope.editionOfficialUrl ?? "",
    ),
    answerKeyDocumentIsOfficialSource: isOfficialExamUrl(
      scope.bankSlug,
      scope.answerKeyDocumentSourceUrl,
    ),
  };
}
