import {
  answerKeyTitleFitsRole,
  isAnswerKeyFinality,
  requiresAnswerKeyMaintenanceAct,
} from "@/lib/exams/answer-key-finality";
import {
  isOfficialExamSourceFresh,
  OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS,
} from "@/lib/exams/previous-exam-policy";

export type ExamReferenceScope = {
  productStatus: string;
  preparationMode?: string;
  opportunityEditorialStatus: string;
  opportunityExamDate: string | null;
  opportunityInstitutionAcronym: string;
  opportunityJurisdictionCode: string;
  opportunityCareerTrackId: number;
  opportunitySpecializationId: number | null;
  responsibleBankId: number | null;
  editionStatus: string;
  editionExamDate: string;
  editionSourceCheckedAt: Date | string | null;
  editionIsOfficialSource: boolean;
  editionInstitutionAcronym: string | null;
  editionJurisdictionCode: string | null;
  editionCareerTrackId: number;
  editionSpecializationId: number | null;
  editionBankId: number;
  /** Nulo nas edições anteriores à migração 0055; equivale a
   * `definitive_document` para efeito de validação. */
  editionAnswerKeyFinality?: string | null;
  documentId: number;
  documentStatus: string;
  documentType: string;
  documentExamEditionId: number;
  editionId: number;
  documentHttpStatus: number;
  documentContentType: string | null;
  documentExpectedQuestionCount: number | null;
  documentSourceCheckedAt: Date | string;
  documentIsOfficialSource: boolean;
  documentSourcePolicy: string;
  documentRightsHolder: string | null;
  documentLicenseBasis: string | null;
  documentLicenseReference: string | null;
  documentLicenseEvidenceChecksumSha256: string | null;
  documentLicenseEvidenceCheckedAt: Date | string | null;
  documentLicensedAt: Date | string | null;
  documentLicenseExpiresAt: Date | string | null;
  answerKeyDocumentId: number;
  answerKeyDocumentStatus: string;
  answerKeyDocumentType: string;
  answerKeyDocumentTitle?: string | null;
  answerKeyDocumentExamEditionId: number;
  answerKeyDocumentHttpStatus: number;
  answerKeyDocumentContentType: string | null;
  answerKeyDocumentSourceCheckedAt: Date | string;
  answerKeyDocumentIsOfficialSource: boolean;
  answerKeyDocumentSourcePolicy: string;
  answerKeyDocumentRightsHolder: string | null;
  answerKeyDocumentLicenseBasis: string | null;
  answerKeyDocumentLicenseReference: string | null;
  answerKeyDocumentLicenseEvidenceChecksumSha256: string | null;
  answerKeyDocumentLicenseEvidenceCheckedAt: Date | string | null;
  answerKeyDocumentLicensedAt: Date | string | null;
  answerKeyDocumentLicenseExpiresAt: Date | string | null;
  answerKeyDecisionDocumentId?: number | null;
  answerKeyDecisionDocumentStatus?: string | null;
  answerKeyDecisionDocumentType?: string | null;
  answerKeyDecisionDocumentTitle?: string | null;
  answerKeyDecisionDocumentExamEditionId?: number | null;
  answerKeyDecisionDocumentHttpStatus?: number | null;
  answerKeyDecisionDocumentContentType?: string | null;
  answerKeyDecisionDocumentSourceCheckedAt?: Date | string | null;
  answerKeyDecisionDocumentIsOfficialSource?: boolean | null;
  answerKeyDecisionDocumentSourcePolicy?: string | null;
  answerKeyDecisionDocumentDistributionMode?: string | null;
  answerKeyDecisionDocumentExpectedQuestionCount?: number | null;
  newerEligibleEditionExists: boolean;
};

export type ExamReferenceScopeDecision =
  | { valid: true }
  | { valid: false; reason: string };

function isFreshSourceCheck(value: Date | string, todayIso: string) {
  const today = new Date(`${todayIso}T23:59:59.999-03:00`);
  return isOfficialExamSourceFresh(value, today);
}

function hasCurrentLicensedEvidence(
  input: {
    sourcePolicy: string;
    rightsHolder: string | null;
    licenseBasis: string | null;
    licenseReference: string | null;
    licenseEvidenceChecksumSha256: string | null;
    licenseEvidenceCheckedAt: Date | string | null;
    licensedAt: Date | string | null;
    licenseExpiresAt: Date | string | null;
  },
  todayIso: string,
) {
  const endOfToday = new Date(`${todayIso}T23:59:59.999-03:00`);
  const licensedAt = input.licensedAt ? new Date(input.licensedAt) : null;
  const evidenceCheckedAt = input.licenseEvidenceCheckedAt
    ? new Date(input.licenseEvidenceCheckedAt)
    : null;
  const expiresAt = input.licenseExpiresAt
    ? new Date(input.licenseExpiresAt)
    : null;
  return (
    input.sourcePolicy === "licensed_content" &&
    Boolean(input.rightsHolder?.trim()) &&
    Boolean(input.licenseBasis?.trim()) &&
    Boolean(input.licenseReference?.trim()) &&
    Boolean(
      input.licenseEvidenceChecksumSha256?.match(/^[a-f0-9]{64}$/u),
    ) &&
    evidenceCheckedAt !== null &&
    !Number.isNaN(evidenceCheckedAt.getTime()) &&
    evidenceCheckedAt <= endOfToday &&
    licensedAt !== null &&
    !Number.isNaN(licensedAt.getTime()) &&
    licensedAt <= endOfToday &&
    (input.licenseExpiresAt === null ||
      (expiresAt !== null &&
        !Number.isNaN(expiresAt.getTime()) &&
        expiresAt >= endOfToday))
  );
}

/**
 * Finalidade do gabarito da edição.
 *
 * `definitive_document` (ou nulo, nas edições anteriores à migração 0055) exige a
 * **ausência** do ato: nenhum ato pode ser pendurado numa edição que já tem
 * gabarito definitivo próprio. `preliminary_plus_maintenance_act` exige o ato
 * presente, aprovado, oficial, fresco e com título que não o apresente como
 * gabarito definitivo.
 *
 * Esta é a metade de aplicação da coerência que o banco não impõe: o CHECK de
 * `contest_product_exam_references` garante o formato do par de colunas, mas a
 * correspondência com `exam_editions.answer_key_finality` envolve duas tabelas.
 */
function validateAnswerKeyFinalityScope(
  scope: ExamReferenceScope,
  todayIso: string,
  requireLicense: boolean,
): ExamReferenceScopeDecision {
  const finality = scope.editionAnswerKeyFinality ?? "definitive_document";
  if (!isAnswerKeyFinality(finality)) {
    return {
      valid: false,
      reason: "A finalidade do gabarito desta edição não é reconhecida.",
    };
  }
  const hasDecisionDocument =
    scope.answerKeyDecisionDocumentId !== null &&
    scope.answerKeyDecisionDocumentId !== undefined;

  if (!requiresAnswerKeyMaintenanceAct(finality)) {
    if (hasDecisionDocument) {
      return {
        valid: false,
        reason:
          "Esta edição tem gabarito definitivo próprio e não admite ato de manutenção de gabaritos.",
      };
    }
    // Caminho inalterado: o rótulo do gabarito definitivo continua sendo conferido
    // na revisão do documento, não aqui. Nenhum requisito novo para MPMT/PGE-AC.
    return { valid: true };
  }

  if (requireLicense) {
    return {
      valid: false,
      reason:
        "Evidência composta vale apenas como link externo oficial, sem licença de conteúdo.",
    };
  }
  if (!hasDecisionDocument) {
    return {
      valid: false,
      reason:
        "Sem gabarito definitivo, o vínculo exige também o ato oficial que manteve todos os gabaritos.",
    };
  }
  if (
    scope.answerKeyDecisionDocumentExamEditionId !== scope.editionId ||
    scope.answerKeyDecisionDocumentId === scope.documentId ||
    scope.answerKeyDecisionDocumentId === scope.answerKeyDocumentId ||
    scope.answerKeyDecisionDocumentType !== "answer_key_decision" ||
    scope.answerKeyDecisionDocumentStatus !== "approved" ||
    (scope.answerKeyDecisionDocumentHttpStatus ?? 0) < 200 ||
    (scope.answerKeyDecisionDocumentHttpStatus ?? 0) > 399 ||
    scope.answerKeyDecisionDocumentContentType
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() !== "application/pdf" ||
    scope.answerKeyDecisionDocumentIsOfficialSource !== true ||
    scope.answerKeyDecisionDocumentSourcePolicy !== "metadata_only" ||
    scope.answerKeyDecisionDocumentDistributionMode !== "external_link" ||
    scope.answerKeyDecisionDocumentExpectedQuestionCount !== null ||
    !scope.answerKeyDecisionDocumentSourceCheckedAt ||
    !isFreshSourceCheck(scope.answerKeyDecisionDocumentSourceCheckedAt, todayIso)
  ) {
    return {
      valid: false,
      reason: `O ato oficial que manteve os gabaritos precisa estar aprovado, acessível como PDF externo e verificado nos últimos ${OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS} dias.`,
    };
  }
  // Nenhum dos dois documentos pode ser apresentado com o papel do outro.
  if (
    !answerKeyTitleFitsRole("preliminary_answer_key", scope.answerKeyDocumentTitle ?? "") ||
    !answerKeyTitleFitsRole(
      "answer_key_maintenance_act",
      scope.answerKeyDecisionDocumentTitle ?? "",
    )
  ) {
    return {
      valid: false,
      reason:
        "Os títulos precisam declarar o papel real de cada documento: gabarito preliminar e ato de manutenção, nunca gabarito definitivo.",
    };
  }
  return { valid: true };
}

/** Validação fechada da identidade banca + cargo/especialidade + edição. */
export function validateExamReferenceScope(
  scope: ExamReferenceScope,
  todayIso: string,
  options: { requireLicense?: boolean } = {},
): ExamReferenceScopeDecision {
  const requireLicense = options.requireLicense ?? true;
  if (scope.productStatus !== "draft") {
    return {
      valid: false,
      reason:
        "O produto precisa permanecer em rascunho durante a troca da prova anterior.",
    };
  }
  if (scope.opportunityEditorialStatus !== "reviewed") {
    return {
      valid: false,
      reason: "A oportunidade ainda não possui revisão editorial concluída.",
    };
  }
  if (!scope.responsibleBankId) {
    return {
      valid: false,
      reason: "A banca desta edição ainda não foi confirmada por fonte revisada.",
    };
  }
  if (scope.editionStatus !== "published" && scope.editionStatus !== "held") {
    return {
      valid: false,
      reason: "A edição histórica ainda não foi confirmada como prova publicada.",
    };
  }
  if (
    !scope.editionIsOfficialSource ||
    !isOfficialExamSourceFresh(
      scope.editionSourceCheckedAt,
      new Date(`${todayIso}T23:59:59.999-03:00`),
    )
  ) {
    return {
      valid: false,
      reason: `A página oficial da edição precisa ter sido verificada nos últimos ${OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS} dias.`,
    };
  }
  if (
    scope.opportunityCareerTrackId !== scope.editionCareerTrackId ||
    scope.opportunitySpecializationId !== scope.editionSpecializationId
  ) {
    return {
      valid: false,
      reason:
        "A prova anterior não pertence ao mesmo cargo/especialidade do produto.",
    };
  }
  if (
    !scope.editionInstitutionAcronym ||
    !scope.editionJurisdictionCode ||
    scope.opportunityInstitutionAcronym !== scope.editionInstitutionAcronym ||
    scope.opportunityJurisdictionCode !== scope.editionJurisdictionCode
  ) {
    return {
      valid: false,
      reason:
        "A prova anterior não pertence ao mesmo órgão e à mesma jurisdição do produto.",
    };
  }
  // Decisão do proprietário em 02/10/2026: vale a última prova do mesmo órgão,
  // cargo e jurisdição mesmo aplicada por outra banca (TJ-RS: FAURGS antes da
  // FGV); a página mostra a banca da prova. A banca do edital atual continua
  // exigida acima.
  if (
    scope.documentExamEditionId !== scope.editionId ||
    scope.documentType !== "question_booklet"
  ) {
    return {
      valid: false,
      reason: "Selecione o caderno principal pertencente à edição histórica.",
    };
  }
  if (
    scope.documentStatus !== "approved" ||
    scope.documentHttpStatus < 200 ||
    scope.documentHttpStatus > 399 ||
    scope.documentContentType?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/pdf" ||
    !scope.documentIsOfficialSource ||
    !isFreshSourceCheck(scope.documentSourceCheckedAt, todayIso)
  ) {
    return {
      valid: false,
      reason: `O caderno oficial precisa estar acessível, revisado e verificado nos últimos ${OFFICIAL_EXAM_SOURCE_MAX_AGE_DAYS} dias.`,
    };
  }
  if (
    requireLicense &&
    !hasCurrentLicensedEvidence(
      {
        sourcePolicy: scope.documentSourcePolicy,
        rightsHolder: scope.documentRightsHolder,
        licenseBasis: scope.documentLicenseBasis,
        licenseReference: scope.documentLicenseReference,
        licenseEvidenceChecksumSha256:
          scope.documentLicenseEvidenceChecksumSha256,
        licenseEvidenceCheckedAt: scope.documentLicenseEvidenceCheckedAt,
        licensedAt: scope.documentLicensedAt,
        licenseExpiresAt: scope.documentLicenseExpiresAt,
      },
      todayIso,
    )
  ) {
    return {
      valid: false,
      reason: "O caderno principal precisa possuir licença escrita vigente e revisada.",
    };
  }
  if (
    scope.answerKeyDocumentExamEditionId !== scope.editionId ||
    scope.answerKeyDocumentId === scope.documentId ||
    scope.answerKeyDocumentType !== "answer_key" ||
    scope.answerKeyDocumentStatus !== "approved" ||
    scope.answerKeyDocumentHttpStatus < 200 ||
    scope.answerKeyDocumentHttpStatus > 399 ||
    scope.answerKeyDocumentContentType
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() !== "application/pdf" ||
    !scope.answerKeyDocumentIsOfficialSource ||
    !isFreshSourceCheck(scope.answerKeyDocumentSourceCheckedAt, todayIso) ||
    (requireLicense && !hasCurrentLicensedEvidence(
      {
        sourcePolicy: scope.answerKeyDocumentSourcePolicy,
        rightsHolder: scope.answerKeyDocumentRightsHolder,
        licenseBasis: scope.answerKeyDocumentLicenseBasis,
        licenseReference: scope.answerKeyDocumentLicenseReference,
        licenseEvidenceChecksumSha256:
          scope.answerKeyDocumentLicenseEvidenceChecksumSha256,
        licenseEvidenceCheckedAt:
          scope.answerKeyDocumentLicenseEvidenceCheckedAt,
        licensedAt: scope.answerKeyDocumentLicensedAt,
        licenseExpiresAt: scope.answerKeyDocumentLicenseExpiresAt,
      },
      todayIso,
    ))
  ) {
    return {
      valid: false,
      reason:
        requireLicense
          ? "Selecione o gabarito oficial exato, aprovado, licenciado e vigente desta edição."
          : "Selecione o gabarito oficial exato, aprovado e vigente desta edição.",
    };
  }
  const finalityDecision = validateAnswerKeyFinalityScope(
    scope,
    todayIso,
    requireLicense,
  );
  if (!finalityDecision.valid) return finalityDecision;
  if (
    !Number.isInteger(scope.documentExpectedQuestionCount) ||
    (scope.documentExpectedQuestionCount ?? 0) < 1
  ) {
    return {
      valid: false,
      reason: "Informe a quantidade total de questões do caderno oficial.",
    };
  }

  const cutoff = scope.preparationMode === "historical_training" ? todayIso : (scope.opportunityExamDate ?? todayIso);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(scope.editionExamDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(cutoff) ||
    scope.editionExamDate >= cutoff ||
    scope.editionExamDate >= todayIso
  ) {
    return {
      valid: false,
      reason:
        "A prova de referência deve ser anterior à prova atual — ou anterior a hoje quando a data atual não estiver definida.",
    };
  }

  if (scope.newerEligibleEditionExists) {
    return {
      valid: false,
      reason:
        "Existe uma prova oficial mais recente da mesma banca, carreira e especialidade antes do concurso atual.",
    };
  }

  return { valid: true };
}
