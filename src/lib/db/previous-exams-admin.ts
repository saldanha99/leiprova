import "server-only";

import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/lib/db/client";
import {
  contestOpportunities,
  contestProductExamReferences,
  contestStoreProducts,
  examLicenseRequests,
  examEditionDocuments,
  examEditions,
  quizBanks,
  quizCareerSubjects,
  quizCareerSpecializations,
  quizCareerTracks,
  quizSubjects,
  users,
} from "@/lib/db/schema";
import { listLicensedPreviousExamReviewBatches } from "@/lib/editorial/licensed-previous-exam-import";
import { buildExamDocumentReviewFingerprint } from "@/lib/exams/exam-document-review";

export async function getPreviousExamsAdminSnapshot() {
  const db = getDb();
  const documentInitiator = alias(users, "exam_document_initiator");
  const documentReviewer = alias(users, "exam_document_reviewer");
  const referenceInitiator = alias(users, "exam_reference_initiator");
  const referenceReviewer = alias(users, "exam_reference_reviewer");
  const referenceAnswerKey = alias(
    examEditionDocuments,
    "exam_reference_answer_key",
  );

  const [exams, documents, products, references, licenseRequests, subjects, reviewBatches] =
    await Promise.all([
    db
      .select({
        id: examEditions.id,
        publicId: examEditions.publicId,
        title: examEditions.title,
        examDate: examEditions.examDate,
        status: examEditions.status,
        sourcePolicy: examEditions.sourcePolicy,
        officialUrl: examEditions.officialUrl,
        institutionAcronym: examEditions.institutionAcronym,
        jurisdictionCode: examEditions.jurisdictionCode,
        bankId: quizBanks.id,
        bankSlug: quizBanks.slug,
        bankName: quizBanks.name,
        careerTrackId: quizCareerTracks.id,
        careerName: quizCareerTracks.name,
        specializationId: quizCareerSpecializations.id,
        specializationName: quizCareerSpecializations.name,
      })
      .from(examEditions)
      .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
      .innerJoin(
        quizCareerTracks,
        eq(examEditions.careerTrackId, quizCareerTracks.id),
      )
      .leftJoin(
        quizCareerSpecializations,
        eq(examEditions.specializationId, quizCareerSpecializations.id),
      )
      .orderBy(desc(examEditions.examDate), desc(examEditions.id)),
    db
      .select({
        id: examEditionDocuments.id,
        publicId: examEditionDocuments.publicId,
        examEditionId: examEditionDocuments.examEditionId,
        careerTrackId: examEditions.careerTrackId,
        examPublicId: examEditions.publicId,
        examTitle: examEditions.title,
        bankName: quizBanks.name,
        documentType: examEditionDocuments.documentType,
        title: examEditionDocuments.title,
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
        licenseEvidenceCheckedAt:
          examEditionDocuments.licenseEvidenceCheckedAt,
        licensedAt: examEditionDocuments.licensedAt,
        licenseExpiresAt: examEditionDocuments.licenseExpiresAt,
        status: examEditionDocuments.status,
        initiatedByUserId: examEditionDocuments.initiatedByUserId,
        initiatorName: documentInitiator.name,
        reviewerName: documentReviewer.name,
        reviewedAt: examEditionDocuments.reviewedAt,
        reviewNotes: examEditionDocuments.reviewNotes,
        createdAt: examEditionDocuments.createdAt,
      })
      .from(examEditionDocuments)
      .innerJoin(
        examEditions,
        eq(examEditionDocuments.examEditionId, examEditions.id),
      )
      .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
      .leftJoin(
        documentInitiator,
        eq(examEditionDocuments.initiatedByUserId, documentInitiator.id),
      )
      .leftJoin(
        documentReviewer,
        eq(examEditionDocuments.reviewedByUserId, documentReviewer.id),
      )
      .orderBy(desc(examEditionDocuments.createdAt)),
    db
      .select({
        slug: contestStoreProducts.slug,
        status: contestStoreProducts.status,
        opportunityId: contestStoreProducts.opportunityId,
        opportunityTitle: contestOpportunities.title,
        opportunityExamDate: contestOpportunities.examDate,
        opportunityEditorialStatus: contestOpportunities.editorialStatus,
      })
      .from(contestStoreProducts)
      .leftJoin(
        contestOpportunities,
        eq(contestStoreProducts.opportunityId, contestOpportunities.id),
      )
      .where(isNotNull(contestStoreProducts.opportunityId))
      .orderBy(contestStoreProducts.slug),
    db
      .select({
        id: contestProductExamReferences.id,
        publicId: contestProductExamReferences.publicId,
        productSlug: contestProductExamReferences.productSlug,
        relationship: contestProductExamReferences.relationship,
        status: contestProductExamReferences.status,
        selectionVerifiedAt:
          contestProductExamReferences.selectionVerifiedAt,
        initiatedByUserId: contestProductExamReferences.initiatedByUserId,
        initiatorName: referenceInitiator.name,
        reviewerName: referenceReviewer.name,
        reviewedAt: contestProductExamReferences.reviewedAt,
        reviewNotes: contestProductExamReferences.reviewNotes,
        examPublicId: examEditions.publicId,
        examTitle: examEditions.title,
        examDate: examEditions.examDate,
        documentPublicId: examEditionDocuments.publicId,
        documentTitle: examEditionDocuments.title,
        documentUrl: examEditionDocuments.sourceUrl,
        documentSourcePolicy: examEditionDocuments.sourcePolicy,
        answerKeyDocumentPublicId: referenceAnswerKey.publicId,
        answerKeyDocumentTitle: referenceAnswerKey.title,
        answerKeyDocumentUrl: referenceAnswerKey.sourceUrl,
        answerKeyDocumentSourcePolicy: referenceAnswerKey.sourcePolicy,
      })
      .from(contestProductExamReferences)
      .innerJoin(
        examEditions,
        eq(contestProductExamReferences.examEditionId, examEditions.id),
      )
      .innerJoin(
        examEditionDocuments,
        and(
          eq(
            contestProductExamReferences.primaryDocumentId,
            examEditionDocuments.id,
          ),
          eq(
            contestProductExamReferences.examEditionId,
            examEditionDocuments.examEditionId,
          ),
        ),
      )
      .innerJoin(
        referenceAnswerKey,
        and(
          eq(
            contestProductExamReferences.answerKeyDocumentId,
            referenceAnswerKey.id,
          ),
          eq(
            contestProductExamReferences.examEditionId,
            referenceAnswerKey.examEditionId,
          ),
        ),
      )
      .leftJoin(
        referenceInitiator,
        eq(
          contestProductExamReferences.initiatedByUserId,
          referenceInitiator.id,
        ),
      )
      .leftJoin(
        referenceReviewer,
        eq(
          contestProductExamReferences.reviewedByUserId,
          referenceReviewer.id,
        ),
      )
      .orderBy(desc(contestProductExamReferences.createdAt)),
    db
      .select({
        publicId: examLicenseRequests.publicId,
        status: examLicenseRequests.status,
        editionPublicId: examEditions.publicId,
        editionTitle: examEditions.title,
        bankName: quizBanks.name,
        recipientEmails: examLicenseRequests.recipientEmails,
        initiatedByUserId: examLicenseRequests.initiatedByUserId,
        requestedAt: examLicenseRequests.requestedAt,
        lastFollowUpAt: examLicenseRequests.lastFollowUpAt,
        nextFollowUpAt: examLicenseRequests.nextFollowUpAt,
        followUpCount: examLicenseRequests.followUpCount,
        responseReceivedAt: examLicenseRequests.responseReceivedAt,
        expiresAt: examLicenseRequests.expiresAt,
        updatedAt: examLicenseRequests.updatedAt,
      })
      .from(examLicenseRequests)
      .innerJoin(
        examEditions,
        eq(examLicenseRequests.examEditionId, examEditions.id),
      )
      .innerJoin(quizBanks, eq(examLicenseRequests.bankId, quizBanks.id))
      .orderBy(desc(examLicenseRequests.updatedAt)),
    db
      .select({
        careerTrackId: quizCareerSubjects.careerTrackId,
        subjectId: quizSubjects.id,
        subjectName: quizSubjects.name,
      })
      .from(quizCareerSubjects)
      .innerJoin(
        quizSubjects,
        eq(quizCareerSubjects.subjectId, quizSubjects.id),
      )
      .where(eq(quizSubjects.isActive, true))
      .orderBy(
        quizCareerSubjects.careerTrackId,
        quizSubjects.name,
        quizSubjects.id,
      ),
    listLicensedPreviousExamReviewBatches(db),
  ]);
  const [productsWithoutOpportunity] = await db
    .select({ value: sql<number>`count(*)::integer` })
    .from(contestStoreProducts)
    .where(isNull(contestStoreProducts.opportunityId));

  return {
    exams,
    documents: documents.map((document) => ({
      ...document,
      reviewFingerprint: buildExamDocumentReviewFingerprint(document),
    })),
    products,
    references,
    licenseRequests,
    subjects,
    reviewBatches,
    metrics: {
      editions: exams.length,
      documentsPending: documents.filter(
        (document) => document.status === "pending_review",
      ).length,
      documentsApproved: documents.filter(
        (document) => document.status === "approved",
      ).length,
      licensedDocumentsApproved: documents.filter(
        (document) =>
          document.status === "approved" &&
          document.sourcePolicy === "licensed_content",
      ).length,
      referencesPending: references.filter(
        (reference) => reference.status === "pending_review",
      ).length,
      productsWithApprovedReference: new Set(
        references
          .filter((reference) => reference.status === "approved")
          .map((reference) => reference.productSlug),
      ).size,
      productsWithoutOpportunity: productsWithoutOpportunity?.value ?? 0,
      licenseRequestsOpen: licenseRequests.filter((request) =>
        ["prepared", "awaiting_response", "granted_pending_review", "manual_review"].includes(
          request.status,
        ),
      ).length,
      licenseRequestsGranted: licenseRequests.filter(
        (request) => request.status === "granted",
      ).length,
    },
  };
}

export type PreviousExamsAdminSnapshot = Awaited<
  ReturnType<typeof getPreviousExamsAdminSnapshot>
>;
