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
// A consulta de escopo foi extraída para uso também pelo comando de servidor.
const reviewQueriesSource = readFileSync(
  new URL("../src/lib/exams/previous-exam-review.ts", import.meta.url),
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
  it("permite própria edição realizada somente no treino histórico, com todos os demais gates", () => {
    const same = {...validScope,opportunityExamDate:"2024-11-10",preparationMode:"historical_training"};
    expect(validateExamReferenceScope(same,"2026-09-12").valid).toBe(true);
    expect(validateExamReferenceScope({...same,preparationMode:"current_notice"},"2026-09-12").valid).toBe(false);
    expect(validateExamReferenceScope({...same,preparationMode:"pre_notice"},"2026-09-12").valid).toBe(false);
    expect(validateExamReferenceScope({...same,preparationMode:undefined},"2026-09-12").valid).toBe(false);
    for(const changed of [{editionExamDate:"2026-09-12"},{editionExamDate:"2026-09-13"},{newerEligibleEditionExists:true},{editionCareerTrackId:10},{editionJurisdictionCode:"MT"},{editionInstitutionAcronym:"MPMT"}])
      expect(validateExamReferenceScope({...same,...changed},"2026-09-12").valid).toBe(false);
    expect(reviewQueriesSource).toContain("preparationMode: contestStoreProducts.preparationMode");
    expect(reviewQueriesSource).toContain("case when ${contestStoreProducts.preparationMode} = 'historical_training' then ${todayIso}::date");
  });
  it("aceita apenas o mesmo órgão, cargo e especialidade, com a banca do edital confirmada", () => {
    expect(validateExamReferenceScope(validScope, "2026-09-12")).toEqual({
      valid: true,
    });
    // Prova anterior de outra banca vale (decisão de 02/10/2026; TJ-RS: FAURGS antes da FGV).
    expect(validateExamReferenceScope({ ...validScope, responsibleBankId: 3 }, "2026-09-12")).toEqual({
      valid: true,
    });

    for (const change of [
      { responsibleBankId: null },
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
    expect(reviewQueriesSource).toContain("from exam_editions newer_edition");
    expect(reviewQueriesSource).not.toContain("newer_edition.official_url");
    expect(reviewQueriesSource).not.toContain("newer_edition.source_checked_at");
    expect(actionsSource).toContain('from "@/lib/exams/previous-exam-review"');
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

describe("finalidade do gabarito no escopo do vínculo", () => {
  // Escopo sem licença, como o caminho de link externo oficial usa.
  const externalScope: ExamReferenceScope = {
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

  const compositeScope: ExamReferenceScope = {
    ...externalScope,
    editionAnswerKeyFinality: "preliminary_plus_maintenance_act",
    answerKeyDocumentTitle: "Gabarito oficial preliminar da prova preambular",
    answerKeyDecisionDocumentId: 103,
    answerKeyDecisionDocumentStatus: "approved",
    answerKeyDecisionDocumentType: "answer_key_decision",
    answerKeyDecisionDocumentTitle:
      "Aviso de 22/06/2026: julgados os recursos, mantidos os gabaritos da prova preambular",
    answerKeyDecisionDocumentExamEditionId: 77,
    answerKeyDecisionDocumentHttpStatus: 200,
    answerKeyDecisionDocumentContentType: "application/pdf",
    answerKeyDecisionDocumentSourceCheckedAt: "2026-09-11T12:00:00.000Z",
    answerKeyDecisionDocumentIsOfficialSource: true,
    answerKeyDecisionDocumentSourcePolicy: "metadata_only",
    answerKeyDecisionDocumentDistributionMode: "external_link",
    answerKeyDecisionDocumentExpectedQuestionCount: null,
  };

  it("não muda nada para edições com gabarito definitivo próprio (MPMT, PGE-AC e anteriores)", () => {
    // Campo ausente, como nas edições anteriores à migração 0055.
    expect(validateExamReferenceScope(validScope, "2026-09-12")).toEqual({ valid: true });
    expect(
      validateExamReferenceScope(
        { ...validScope, editionAnswerKeyFinality: "definitive_document" },
        "2026-09-12",
      ),
    ).toEqual({ valid: true });
    expect(
      validateExamReferenceScope(externalScope, "2026-09-12", { requireLicense: false }),
    ).toEqual({ valid: true });
  });

  it("recusa ato de manutenção pendurado em edição com gabarito definitivo", () => {
    for (const finality of [undefined, "definitive_document"]) {
      const decision = validateExamReferenceScope(
        {
          ...externalScope,
          editionAnswerKeyFinality: finality,
          answerKeyDecisionDocumentId: 103,
          answerKeyDecisionDocumentType: "answer_key_decision",
        },
        "2026-09-12",
        { requireLicense: false },
      );
      expect(decision.valid).toBe(false);
      expect(decision).toMatchObject({ reason: expect.stringContaining("não admite ato") });
    }
  });

  it("aceita o escopo composto completo e recusa a ausência do ato", () => {
    expect(
      validateExamReferenceScope(compositeScope, "2026-09-12", { requireLicense: false }),
    ).toEqual({ valid: true });
    const withoutAct = validateExamReferenceScope(
      {
        ...compositeScope,
        answerKeyDecisionDocumentId: null,
        answerKeyDecisionDocumentType: null,
      },
      "2026-09-12",
      { requireLicense: false },
    );
    expect(withoutAct.valid).toBe(false);
    expect(withoutAct).toMatchObject({
      reason: expect.stringContaining("ato oficial que manteve todos os gabaritos"),
    });
  });

  it("recusa ato de outra edição, duplicado, não aprovado, não PDF, vencido ou com licença", () => {
    const changes: Partial<ExamReferenceScope>[] = [
      { answerKeyDecisionDocumentExamEditionId: 78 },
      { answerKeyDecisionDocumentId: compositeScope.documentId },
      { answerKeyDecisionDocumentId: compositeScope.answerKeyDocumentId },
      { answerKeyDecisionDocumentType: "answer_key" },
      { answerKeyDecisionDocumentStatus: "pending_review" },
      { answerKeyDecisionDocumentHttpStatus: 404 },
      { answerKeyDecisionDocumentContentType: "text/html" },
      { answerKeyDecisionDocumentIsOfficialSource: false },
      { answerKeyDecisionDocumentSourcePolicy: "licensed_content" },
      { answerKeyDecisionDocumentDistributionMode: "hosted_copy" },
      { answerKeyDecisionDocumentExpectedQuestionCount: 100 },
      { answerKeyDecisionDocumentSourceCheckedAt: "2026-07-01T12:00:00.000Z" },
      { answerKeyDecisionDocumentSourceCheckedAt: null },
    ];
    for (const change of changes) {
      expect(
        validateExamReferenceScope({ ...compositeScope, ...change }, "2026-09-12", {
          requireLicense: false,
        }).valid,
      ).toBe(false);
    }
    // Evidência composta vale só como link externo: exigir licença invalida.
    expect(
      validateExamReferenceScope(compositeScope, "2026-09-12", { requireLicense: true }).valid,
    ).toBe(false);
  });

  it("recusa relabelamento dos títulos nos dois sentidos", () => {
    const relabeledKey = validateExamReferenceScope(
      {
        ...compositeScope,
        answerKeyDocumentTitle:
          "Gabarito definitivo, provisório até o julgamento dos recursos",
      },
      "2026-09-12",
      { requireLicense: false },
    );
    expect(relabeledKey.valid).toBe(false);
    expect(relabeledKey).toMatchObject({
      reason: expect.stringContaining("papel real de cada documento"),
    });
    for (const title of [
      "Gabarito oficial definitivo da prova preambular",
      "Resultado final do concurso",
    ]) {
      expect(
        validateExamReferenceScope(
          { ...compositeScope, answerKeyDecisionDocumentTitle: title },
          "2026-09-12",
          { requireLicense: false },
        ).valid,
      ).toBe(false);
    }
  });

  it("recusa finalidade desconhecida gravada na edição", () => {
    expect(
      validateExamReferenceScope(
        { ...externalScope, editionAnswerKeyFinality: "gabarito_mantido" },
        "2026-09-12",
        { requireLicense: false },
      ).valid,
    ).toBe(false);
  });

  it("a consulta de escopo carrega o terceiro documento por leftJoin e a finalidade da edição", () => {
    expect(reviewQueriesSource).toContain("export const answerKeyDecisionDocuments = alias(");
    expect(reviewQueriesSource).toContain("editionAnswerKeyFinality: examEditions.answerKeyFinality");
    expect(reviewQueriesSource).toContain(".leftJoin(");
    expect(reviewQueriesSource).toContain("answerKeyDecisionDocumentPublicId: z.string().uuid().optional()");
    expect(actionsSource).toContain('"answer_key_decision"');
    expect(actionsSource).toContain("answerKeyDecisionDocumentId:");
  });
});
