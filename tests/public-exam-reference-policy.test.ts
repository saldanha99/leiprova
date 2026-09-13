import { describe, expect, it } from "vitest";

import {
  buildPublicContestExamReference,
  toPublicExamDocument,
  type PublicExamReferenceCandidateRow,
} from "@/lib/exams/public-exam-reference-policy";

const now = new Date("2026-09-12T12:00:00.000Z");

function candidate(
  overrides: Partial<PublicExamReferenceCandidateRow> = {},
): PublicExamReferenceCandidateRow {
  return {
    referenceId: 11,
    referencePublicId: "ref-pc-ba-2026",
    referenceStatus: "approved",
    relationship: "latest_previous_exam",
    primaryDocumentId: 21,
    answerKeyDocumentId: 23,
    referenceReviewedByUserId: 91,
    referenceReviewedAt: new Date("2026-09-11T12:00:00.000Z"),
    selectionVerifiedAt: new Date("2026-09-10T12:00:00.000Z"),
    editionId: 31,
    editionPublicId: "pc-ba-delegado-2022",
    editionTitle: "PC-BA 2022 — Delegado",
    examDate: "2022-07-24",
    editionStatus: "published",
    editionOfficialUrl: "https://www.cebraspe.org.br/concursos/pc-ba-2022",
    editionSourceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
    opportunityInstitutionAcronym: "PCBA",
    opportunityJurisdictionCode: "BA",
    editionInstitutionAcronym: "PCBA",
    editionJurisdictionCode: "BA",
    bankSlug: "cebraspe",
    bankName: "Cebraspe",
    documentId: 21,
    documentPublicId: "pc-ba-2022-caderno",
    documentExamEditionId: 31,
    documentType: "question_booklet",
    documentTitle: "Caderno de questões — Delegado",
    sourceUrl: "https://cdn.cebraspe.org.br/pc-ba-2022/prova.pdf",
    sourceHost: "cdn.cebraspe.org.br",
    sourceCheckedAt: new Date("2026-09-10T13:00:00.000Z"),
    httpStatus: 200,
    contentType: "application/pdf",
    expectedQuestionCount: 100,
    distributionMode: "external_link",
    sourcePolicy: "licensed_content",
    rightsHolder: "Titular contratual de QA",
    licenseBasis: "Autorizacao escrita sintetica de QA",
    licenseReference: "https://licencas.example.invalid/evidencias/qa-21",
    licenseEvidenceChecksumSha256: "a".repeat(64),
    licenseEvidenceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
    licensedAt: new Date("2026-09-01T12:00:00.000Z"),
    licenseExpiresAt: new Date("2027-09-01T12:00:00.000Z"),
    documentStatus: "approved",
    documentReviewedByUserId: 92,
    documentReviewedAt: new Date("2026-09-11T14:00:00.000Z"),
    ...overrides,
  };
}

describe("política pública da última prova", () => {
  it("entrega somente o caderno e o gabarito exatos em DTO sanitizado", () => {
    const rows = [
      candidate(),
      candidate({
        documentId: 23,
        documentPublicId: "gabarito-final",
        documentType: "answer_key",
        expectedQuestionCount: null,
        documentTitle: "Gabarito definitivo",
        sourceUrl: "https://cdn.cebraspe.org.br/pc-ba-2022/final.pdf",
        rightsHolder: "Titular contratual",
        licenseBasis: "Autorização escrita",
        licenseReference: "CONTRATO-INTERNO-QUE-NAO-DEVE-SAIR",
        licenseEvidenceChecksumSha256: "b".repeat(64),
      }),
      candidate({
        documentId: 22,
        documentPublicId: "gabarito-preliminar",
        documentType: "answer_key",
        expectedQuestionCount: null,
        documentTitle: "Gabarito preliminar",
        sourceUrl: "https://cdn.cebraspe.org.br/pc-ba-2022/preliminar.pdf",
        licenseEvidenceChecksumSha256: "c".repeat(64),
      }),
    ];

    const result = buildPublicContestExamReference(rows, now);

    expect(result).toEqual({
      edition: {
        publicId: "pc-ba-delegado-2022",
        title: "PC-BA 2022 — Delegado",
        examDate: "2022-07-24",
        bank: { slug: "cebraspe", name: "Cebraspe" },
      },
      questionBooklet: {
        publicId: "pc-ba-2022-caderno",
        documentType: "question_booklet",
        title: "Caderno de questões — Delegado",
        officialUrl: "https://cdn.cebraspe.org.br/pc-ba-2022/prova.pdf",
        accessType: "external_link",
        licenseLabel: "Licença de uso registrada",
        sourceCheckedAt: new Date("2026-09-10T13:00:00.000Z"),
        questionCount: 100,
      },
      answerKeys: [
        expect.objectContaining({
          publicId: "gabarito-final",
          licenseLabel: "Licença de uso registrada",
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain("CONTRATO-INTERNO");
    expect(JSON.stringify(result)).not.toContain("Titular contratual");
  });

  it("não publica cópia hospedada enquanto não existe entrega autenticada", () => {
    expect(
      buildPublicContestExamReference(
        [candidate({ distributionMode: "hosted_copy" })],
        now,
      ),
    ).toBeNull();
  });

  it("recusa a referência inteira quando o gabarito exato está com licença vencida", () => {
    const expired = candidate({
      documentId: 23,
      documentPublicId: "gabarito-vencido",
      documentType: "answer_key",
      expectedQuestionCount: null,
      documentTitle: "Gabarito vencido",
      sourcePolicy: "licensed_content",
      rightsHolder: "Titular",
      licenseBasis: "Contrato",
      licenseReference: "referência privada",
      licensedAt: new Date("2026-01-01T12:00:00.000Z"),
      licenseExpiresAt: new Date("2026-09-12T11:59:59.000Z"),
    });

    expect(buildPublicContestExamReference([candidate(), expired], now)).toBeNull();
    expect(toPublicExamDocument(expired, now)).toBeNull();
  });

  it.each([
    { sourcePolicy: "metadata_only" },
    { licenseEvidenceChecksumSha256: null },
    { licenseEvidenceChecksumSha256: "A".repeat(64) },
    { licenseEvidenceCheckedAt: null },
    { licenseEvidenceCheckedAt: new Date("2026-09-11T14:00:00.001Z") },
  ])("recusa documento sem evidência de licença íntegra: %o", (overrides) => {
    expect(toPublicExamDocument(candidate(overrides), now)).toBeNull();
  });

  it.each([
    { referenceStatus: "pending_review" },
    { referenceReviewedByUserId: null },
    { relationship: "outra" },
    { editionStatus: "scheduled" },
    { examDate: "2027-01-01" },
    { editionOfficialUrl: "https://example.com/prova" },
    { editionSourceCheckedAt: new Date("2026-07-01T12:00:00.000Z") },
    { editionInstitutionAcronym: "PCRJ" },
    { editionJurisdictionCode: "RJ" },
  ])("recusa referência sem cadeia editorial aprovada: %o", (overrides) => {
    expect(buildPublicContestExamReference([candidate(overrides)], now)).toBeNull();
  });

  it.each([
    { documentStatus: "pending_review" },
    { documentReviewedByUserId: null },
    { httpStatus: 404 },
    { contentType: "text/html" },
    { expectedQuestionCount: null },
    { sourceCheckedAt: new Date("2026-07-01T12:00:00.000Z") },
    { sourceUrl: "http://cdn.cebraspe.org.br/prova.pdf" },
    { sourceUrl: "https://usuario:senha@cdn.cebraspe.org.br/prova.pdf" },
    { sourceUrl: "https://cdn.cebraspe.org.br:8443/prova.pdf" },
    { sourceUrl: "https://provas.example.gov.br/prova.pdf", sourceHost: "provas.example.gov.br" },
    { sourceHost: "outro.example" },
    { documentExamEditionId: 999 },
  ])("recusa documento que não atende a publicação segura: %o", (overrides) => {
    expect(toPublicExamDocument(candidate(overrides), now)).toBeNull();
  });
});
