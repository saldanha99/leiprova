import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  type ExamReferenceScope,
  validateExamReferenceScope,
} from "../src/lib/exams/admin-exam-reference-policy";

const actionsSource = readFileSync(
  new URL(
    "../src/app/admin/provas-anteriores/actions.ts",
    import.meta.url,
  ),
  "utf8",
);

const validScope: ExamReferenceScope = {
  productStatus: "draft",
  opportunityEditorialStatus: "reviewed",
  opportunityExamDate: "2026-12-13",
  opportunityInstitutionAcronym: "MPSP",
  opportunityJurisdictionCode: "SP",
  opportunityCareerTrackId: 4,
  opportunitySpecializationId: 9,
  responsibleBankId: 2,
  editionStatus: "published",
  editionExamDate: "2024-11-10",
  editionSourceCheckedAt: "2026-09-11T12:00:00.000Z",
  editionIsOfficialSource: true,
  editionInstitutionAcronym: "MPSP",
  editionJurisdictionCode: "SP",
  editionCareerTrackId: 4,
  editionSpecializationId: 9,
  editionBankId: 2,
  documentId: 101,
  documentStatus: "approved",
  documentType: "question_booklet",
  documentExamEditionId: 77,
  editionId: 77,
  documentHttpStatus: 200,
  documentContentType: "application/pdf",
  documentExpectedQuestionCount: 100,
  documentSourceCheckedAt: "2026-09-11T12:00:00.000Z",
  documentIsOfficialSource: true,
  documentSourcePolicy: "licensed_content",
  documentRightsHolder: "Titular de QA",
  documentLicenseBasis: "Autorização escrita integral de QA",
  documentLicenseReference: "https://example.invalid/licenca",
  documentLicenseEvidenceChecksumSha256: "a".repeat(64),
  documentLicenseEvidenceCheckedAt: "2026-09-10T03:00:00.000Z",
  documentLicensedAt: "2026-09-01T03:00:00.000Z",
  documentLicenseExpiresAt: "2027-09-12T02:59:59.999Z",
  answerKeyDocumentId: 102,
  answerKeyDocumentStatus: "approved",
  answerKeyDocumentType: "answer_key",
  answerKeyDocumentExamEditionId: 77,
  answerKeyDocumentHttpStatus: 200,
  answerKeyDocumentContentType: "application/pdf",
  answerKeyDocumentSourceCheckedAt: "2026-09-11T12:00:00.000Z",
  answerKeyDocumentIsOfficialSource: true,
  answerKeyDocumentSourcePolicy: "licensed_content",
  answerKeyDocumentRightsHolder: "Titular de QA",
  answerKeyDocumentLicenseBasis: "Autorização escrita integral de QA",
  answerKeyDocumentLicenseReference: "https://example.invalid/licenca-gabarito",
  answerKeyDocumentLicenseEvidenceChecksumSha256: "b".repeat(64),
  answerKeyDocumentLicenseEvidenceCheckedAt: "2026-09-10T03:00:00.000Z",
  answerKeyDocumentLicensedAt: "2026-09-01T03:00:00.000Z",
  answerKeyDocumentLicenseExpiresAt: "2027-09-12T02:59:59.999Z",
  newerEligibleEditionExists: false,
};

describe("identidade da última prova por produto", () => {
  it("aceita apenas o mesmo recorte de banca, cargo e especialidade", () => {
    expect(validateExamReferenceScope(validScope, "2026-09-12")).toEqual({
      valid: true,
    });

    for (const change of [
      { responsibleBankId: 3 },
      { editionCareerTrackId: 7 },
      { editionSpecializationId: 10 },
      { editionIsOfficialSource: false },
      { editionSourceCheckedAt: "2026-07-01T12:00:00.000Z" },
      { editionInstitutionAcronym: "PCRJ" },
      { editionJurisdictionCode: "RJ" },
    ]) {
      expect(
        validateExamReferenceScope({ ...validScope, ...change }, "2026-09-12")
          .valid,
      ).toBe(false);
    }
  });

  it("permite vincular apenas o link oficial quando a reprodução não foi licenciada", () => {
    const metadataOnly = {
      ...validScope,
      documentSourcePolicy: "metadata_only",
      documentRightsHolder: null,
      documentLicenseBasis: null,
      documentLicenseReference: null,
      documentLicenseEvidenceChecksumSha256: null,
      documentLicenseEvidenceCheckedAt: null,
      documentLicensedAt: null,
      documentLicenseExpiresAt: null,
      answerKeyDocumentSourcePolicy: "metadata_only",
      answerKeyDocumentRightsHolder: null,
      answerKeyDocumentLicenseBasis: null,
      answerKeyDocumentLicenseReference: null,
      answerKeyDocumentLicenseEvidenceChecksumSha256: null,
      answerKeyDocumentLicenseEvidenceCheckedAt: null,
      answerKeyDocumentLicensedAt: null,
      answerKeyDocumentLicenseExpiresAt: null,
    };

    expect(validateExamReferenceScope(metadataOnly, "2026-09-12").valid).toBe(
      false,
    );
    expect(
      validateExamReferenceScope(metadataOnly, "2026-09-12", {
        requireLicense: false,
      }),
    ).toEqual({ valid: true });
  });

  it("recusa documento pendente, outra edição ou arquivo que não seja caderno", () => {
    for (const change of [
      { documentStatus: "pending_review" },
      { documentExamEditionId: 78 },
      { documentType: "answer_key" },
      { documentHttpStatus: 404 },
      { documentContentType: "text/html" },
      { documentExpectedQuestionCount: null },
      { documentIsOfficialSource: false },
      { documentSourceCheckedAt: "2026-07-01T12:00:00.000Z" },
    ]) {
      expect(
        validateExamReferenceScope({ ...validScope, ...change }, "2026-09-12")
          .valid,
      ).toBe(false);
    }
  });

  it("recusa prova futura e produto já exposto", () => {
    expect(
      validateExamReferenceScope(
        { ...validScope, editionExamDate: "2026-12-13" },
        "2026-09-12",
      ).valid,
    ).toBe(false);
    expect(
      validateExamReferenceScope(
        { ...validScope, productStatus: "released" },
        "2026-09-12",
      ).valid,
    ).toBe(false);
    expect(
      validateExamReferenceScope(
        { ...validScope, newerEligibleEditionExists: true },
        "2026-09-12",
      ).valid,
    ).toBe(false);
  });

  it("falha fechado diante de edição posterior ainda não validada", () => {
    expect(actionsSource).toContain("from exam_editions newer_edition");
    expect(actionsSource).not.toContain("newer_edition.official_url");
    expect(actionsSource).not.toContain("newer_edition.source_checked_at");
  });

  it("usa hoje como corte quando o edital ainda não informa a prova atual", () => {
    expect(
      validateExamReferenceScope(
        {
          ...validScope,
          opportunityExamDate: null,
          editionExamDate: "2026-09-11",
        },
        "2026-09-12",
      ).valid,
    ).toBe(true);
    expect(
      validateExamReferenceScope(
        {
          ...validScope,
          opportunityExamDate: null,
          editionExamDate: "2026-09-12",
        },
        "2026-09-12",
      ).valid,
    ).toBe(false);
  });

  it("serializa a decisão pelo lock delimitado sem exigir UPDATE no catálogo", () => {
    expect(actionsSource).toContain(
      "select public.lock_product_binding_review_product(${reference.productSlug})",
    );
    expect(actionsSource).not.toMatch(
      /from contest_store_products where slug = \$\{reference\.productSlug\} for update/u,
    );
  });

  it("exige identidade territorial, PDF completo e fonte oficial recente", () => {
    for (const change of [
      { opportunityInstitutionAcronym: "PCRJ" },
      { opportunityJurisdictionCode: "RJ" },
      { documentExpectedQuestionCount: 0 },
      { documentContentType: "text/html" },
      { documentIsOfficialSource: false },
      { documentSourceCheckedAt: "2026-08-01T12:00:00.000Z" },
    ]) {
      expect(
        validateExamReferenceScope({ ...validScope, ...change }, "2026-09-12")
          .valid,
      ).toBe(false);
    }
  });

  it("considera inválida até a edição realizada na própria data de hoje", () => {
    expect(
      validateExamReferenceScope(
        {
          ...validScope,
          opportunityExamDate: "2026-12-13",
          editionExamDate: "2026-09-12",
        },
        "2026-09-12",
      ).valid,
    ).toBe(false);
  });

  it("registra a revisão somente depois da nova verificação do PDF", () => {
    const reviewStart = actionsSource.indexOf(
      "export async function reviewExamDocumentAction",
    );
    const verification = actionsSource.indexOf(
      "checked = await verifyOfficialExamUrl",
      reviewStart,
    );
    const reviewedAt = actionsSource.indexOf(
      "const reviewedAt = new Date();",
      verification,
    );
    const documentLock = actionsSource.indexOf(
      "select public.lock_exam_document_review_edition(${candidate.examEditionId})",
      reviewedAt,
    );

    expect(verification).toBeGreaterThan(reviewStart);
    expect(reviewedAt).toBeGreaterThan(verification);
    expect(documentLock).toBeGreaterThan(reviewedAt);
  });

  it("oferece retirada imediata auditada e bloqueia dependências", () => {
    expect(actionsSource).toContain(
      "export async function revokeExamDocumentAction",
    );
    expect(actionsSource).toContain(
      'action: "editorial.exam_document.revoked"',
    );
    expect(actionsSource).toContain(
      'eq(questions.quizMode, "previous_exam")',
    );
    expect(actionsSource).toContain(
      "eq(questions.examEditionDocumentId, document.id)",
    );
    expect(actionsSource).toContain(
      'set({ editorialStatus: "suspended", updatedAt: now })',
    );
    expect(actionsSource).toContain(
      "export async function revokeProductExamReferenceAction",
    );
    expect(actionsSource).toContain(
      "export async function suspendPreviousExamQuestionAction",
    );
  });
});
