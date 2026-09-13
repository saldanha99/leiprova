import { createHash } from "node:crypto";

type ExamDocumentReviewDossier = {
  id: number;
  publicId: string;
  examEditionId: number;
  documentType: string;
  title: string;
  sourceUrl: string;
  sourceHost: string;
  sourcePolicy: string;
  expectedQuestionCount: number | null;
  rightsHolder: string | null;
  licenseBasis: string | null;
  licenseReference: string | null;
  licenseEvidenceChecksumSha256: string | null;
  licenseEvidenceCheckedAt: Date | string | null;
  licensedAt: Date | string | null;
  licenseExpiresAt: Date | string | null;
  initiatedByUserId: number;
};

function stableDate(value: Date | string | null) {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

/** Sela exatamente o dossiê jurídico exibido antes da decisão humana. */
export function buildExamDocumentReviewFingerprint(
  document: ExamDocumentReviewDossier,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: document.id,
        publicId: document.publicId,
        examEditionId: document.examEditionId,
        documentType: document.documentType,
        title: document.title,
        sourceUrl: document.sourceUrl,
        sourceHost: document.sourceHost,
        sourcePolicy: document.sourcePolicy,
        expectedQuestionCount: document.expectedQuestionCount,
        rightsHolder: document.rightsHolder,
        licenseBasis: document.licenseBasis,
        licenseReference: document.licenseReference,
        licenseEvidenceChecksumSha256:
          document.licenseEvidenceChecksumSha256,
        licenseEvidenceCheckedAt: stableDate(
          document.licenseEvidenceCheckedAt,
        ),
        licensedAt: stableDate(document.licensedAt),
        licenseExpiresAt: stableDate(document.licenseExpiresAt),
        initiatedByUserId: document.initiatedByUserId,
      }),
    )
    .digest("hex");
}
