import { saoPauloCalendarDate } from "@/lib/opportunities/catalog-policy";
import { isOfficialExamUrl } from "@/lib/official-sources/exam-registry";
import {
  answerKeyDocumentTypeLabel,
  isAnswerKeyFinality,
  requiresAnswerKeyMaintenanceAct,
} from "@/lib/exams/answer-key-finality";
import { isOfficialExamSourceFresh } from "@/lib/exams/previous-exam-policy";

export const PUBLIC_EXAM_LICENSE_LABELS = {
  metadata_only: "Consulta na fonte oficial",
  licensed_content: "Licença de uso registrada",
} as const;

export type PublicExamDocument = {
  publicId: string;
  documentType: "question_booklet" | "answer_key" | "answer_key_decision";
  title: string;
  officialUrl: string;
  accessType: "external_link";
  /** Rótulo derivado do tipo do documento. O ato de manutenção nunca é
   * apresentado como gabarito, e o preliminar nunca como definitivo. */
  roleLabel: string;
  licenseLabel: (typeof PUBLIC_EXAM_LICENSE_LABELS)[keyof typeof PUBLIC_EXAM_LICENSE_LABELS];
  sourceCheckedAt: Date;
  questionCount: number | null;
};

export type PublicContestExamReference = {
  edition: {
    publicId: string;
    title: string;
    examDate: string;
    bank: {
      slug: string;
      name: string;
    };
  };
  /** Como a finalidade do gabarito desta edição se comprova. */
  answerKeyFinality: "definitive_document" | "preliminary_plus_maintenance_act";
  questionBooklet: PublicExamDocument;
  answerKeys: PublicExamDocument[];
};

export type PublicExamReferenceCandidateRow = {
  referenceId: number;
  referencePublicId: string;
  referenceStatus: string;
  relationship: string;
  primaryDocumentId: number;
  answerKeyDocumentId: number;
  answerKeyDecisionDocumentId: number | null;
  referenceReviewedByUserId: number | null;
  referenceReviewedAt: Date | null;
  selectionVerifiedAt: Date;
  editionId: number;
  editionPublicId: string;
  editionTitle: string;
  examDate: string;
  editionStatus: string;
  editionOfficialUrl: string | null;
  editionSourceCheckedAt: Date | null;
  opportunityInstitutionAcronym: string;
  opportunityJurisdictionCode: string;
  editionInstitutionAcronym: string | null;
  editionJurisdictionCode: string | null;
  editionAnswerKeyFinality: string | null;
  bankSlug: string;
  bankName: string;
  documentId: number;
  documentPublicId: string;
  documentExamEditionId: number;
  documentType: string;
  documentTitle: string;
  sourceUrl: string;
  sourceHost: string;
  sourceCheckedAt: Date;
  httpStatus: number;
  contentType: string | null;
  expectedQuestionCount: number | null;
  distributionMode: string;
  sourcePolicy: string;
  rightsHolder: string | null;
  licenseBasis: string | null;
  licenseReference: string | null;
  licenseEvidenceChecksumSha256: string | null;
  licenseEvidenceCheckedAt: Date | null;
  licensedAt: Date | null;
  licenseExpiresAt: Date | null;
  documentStatus: string;
  documentReviewedByUserId: number | null;
  documentReviewedAt: Date | null;
};

function isNonEmpty(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isApprovedReference(
  row: PublicExamReferenceCandidateRow,
  referenceDate: Date,
) {
  return (
    row.referenceStatus === "approved" &&
    row.relationship === "latest_previous_exam" &&
    row.referenceReviewedByUserId !== null &&
    toValidDate(row.referenceReviewedAt) !== null &&
    toValidDate(row.selectionVerifiedAt) !== null &&
    ["held", "published"].includes(row.editionStatus) &&
    isNonEmpty(row.editionPublicId) &&
    isNonEmpty(row.editionTitle) &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.examDate) &&
    row.examDate < saoPauloCalendarDate(referenceDate) &&
    isNonEmpty(row.opportunityInstitutionAcronym) &&
    isNonEmpty(row.opportunityJurisdictionCode) &&
    row.editionInstitutionAcronym === row.opportunityInstitutionAcronym &&
    row.editionJurisdictionCode === row.opportunityJurisdictionCode &&
    isNonEmpty(row.bankSlug) &&
    isNonEmpty(row.bankName) &&
    isOfficialExamUrl(row.bankSlug, row.editionOfficialUrl ?? "") &&
    isOfficialExamSourceFresh(row.editionSourceCheckedAt, referenceDate)
  );
}

export function toPublicExamDocument(
  row: PublicExamReferenceCandidateRow,
  referenceDate = new Date(),
): PublicExamDocument | null {
  if (
    row.documentStatus !== "approved" ||
    row.documentReviewedByUserId === null ||
    !toValidDate(row.documentReviewedAt) ||
    row.documentExamEditionId !== row.editionId ||
    !["question_booklet", "answer_key", "answer_key_decision"].includes(
      row.documentType,
    ) ||
    !isNonEmpty(row.documentPublicId) ||
    !isNonEmpty(row.documentTitle) ||
    !Number.isInteger(row.httpStatus) ||
    row.httpStatus < 200 ||
    row.httpStatus > 399 ||
    row.contentType?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/pdf" ||
    row.distributionMode !== "external_link" ||
    !isOfficialExamSourceFresh(row.sourceCheckedAt, referenceDate) ||
    (row.documentType === "question_booklet"
      ? !Number.isInteger(row.expectedQuestionCount) ||
        (row.expectedQuestionCount ?? 0) < 1
      : row.expectedQuestionCount !== null)
  ) {
    return null;
  }

  let officialUrl: URL;
  try {
    officialUrl = new URL(row.sourceUrl);
  } catch {
    return null;
  }
  if (
    officialUrl.protocol !== "https:" ||
    officialUrl.username !== "" ||
    officialUrl.password !== "" ||
    officialUrl.port !== "" ||
    !isNonEmpty(row.sourceHost) ||
    officialUrl.hostname.toLowerCase() !== row.sourceHost.trim().toLowerCase() ||
    !isOfficialExamUrl(row.bankSlug, officialUrl.toString())
  ) {
    return null;
  }

  if (row.sourcePolicy === "licensed_content") {
    const licensedAt = toValidDate(row.licensedAt);
    const expiresAt = toValidDate(row.licenseExpiresAt);
    const evidenceCheckedAt = toValidDate(row.licenseEvidenceCheckedAt);
    if (
      !licensedAt ||
      licensedAt.getTime() > referenceDate.getTime() ||
      !isNonEmpty(row.rightsHolder) ||
      !isNonEmpty(row.licenseBasis) ||
      !isNonEmpty(row.licenseReference) ||
      !row.licenseEvidenceChecksumSha256?.match(/^[a-f0-9]{64}$/u) ||
      !evidenceCheckedAt ||
      evidenceCheckedAt.getTime() > referenceDate.getTime() ||
      evidenceCheckedAt.getTime() >
        (toValidDate(row.documentReviewedAt)?.getTime() ?? 0) ||
      (row.licenseExpiresAt !== null && !expiresAt) ||
      (expiresAt && expiresAt.getTime() <= referenceDate.getTime())
    ) {
      return null;
    }
  } else if (row.sourcePolicy !== "metadata_only") {
    return null;
  }

  const roleLabel = answerKeyDocumentTypeLabel(row.documentType);
  if (!roleLabel) return null;

  return {
    publicId: row.documentPublicId.trim(),
    documentType: row.documentType as PublicExamDocument["documentType"],
    title: row.documentTitle.trim(),
    officialUrl: officialUrl.toString(),
    accessType: "external_link",
    roleLabel,
    licenseLabel: PUBLIC_EXAM_LICENSE_LABELS[row.sourcePolicy],
    sourceCheckedAt: row.sourceCheckedAt,
    questionCount:
      row.documentType === "question_booklet"
        ? row.expectedQuestionCount
        : null,
  };
}

export function buildPublicContestExamReference(
  rows: PublicExamReferenceCandidateRow[],
  referenceDate = new Date(),
): PublicContestExamReference | null {
  const first = rows[0];
  if (!first || !isApprovedReference(first, referenceDate)) return null;

  const sameApprovedReference = rows.filter(
    (row) =>
      row.referenceId === first.referenceId &&
      row.editionId === first.editionId &&
      isApprovedReference(row, referenceDate),
  );
  const documents = sameApprovedReference
    .map((row) => ({ row, document: toPublicExamDocument(row, referenceDate) }))
    .filter(
      (
        item,
      ): item is {
        row: PublicExamReferenceCandidateRow;
        document: PublicExamDocument;
      } => item.document !== null,
    );

  const questionBooklet = documents.find(
    ({ row, document }) =>
      row.documentId === first.primaryDocumentId &&
      document.documentType === "question_booklet",
  )?.document;
  if (!questionBooklet) return null;

  const answerKey = documents.find(
    ({ row, document }) =>
      row.documentId === first.answerKeyDocumentId &&
      document.documentType === "answer_key",
  )?.document;
  if (!answerKey || answerKey.publicId === questionBooklet.publicId) return null;

  const finality = first.editionAnswerKeyFinality ?? "definitive_document";
  if (!isAnswerKeyFinality(finality)) return null;
  const answerKeys = [answerKey];
  if (requiresAnswerKeyMaintenanceAct(finality)) {
    // Sem o ato, o gabarito preliminar ficaria sozinho na página como se fosse
    // final. Falha fechada: a seção não aparece.
    const decision = documents.find(
      ({ row, document }) =>
        row.documentId === first.answerKeyDecisionDocumentId &&
        document.documentType === "answer_key_decision",
    )?.document;
    if (
      !decision ||
      first.answerKeyDecisionDocumentId === null ||
      decision.publicId === questionBooklet.publicId ||
      decision.publicId === answerKey.publicId
    ) {
      return null;
    }
    answerKeys.push(decision);
  } else if (first.answerKeyDecisionDocumentId !== null) {
    // Ato pendurado em edição com gabarito definitivo: estado incoerente.
    return null;
  }

  return {
    edition: {
      publicId: first.editionPublicId.trim(),
      title: first.editionTitle.trim(),
      examDate: first.examDate,
      bank: {
        slug: first.bankSlug.trim(),
        name: first.bankName.trim(),
      },
    },
    answerKeyFinality: finality,
    questionBooklet,
    answerKeys,
  };
}
