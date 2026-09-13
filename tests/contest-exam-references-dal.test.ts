import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicExamReferenceCandidateRow } from "@/lib/exams/public-exam-reference-policy";

const mocks = vi.hoisted(() => {
  const query = {
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  const from = vi.fn(() => query);
  const select = vi.fn(() => ({ from }));
  return { query, from, select };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({ select: mocks.select }),
}));

import { getApprovedContestExamReference } from "@/lib/db/contest-exam-references";

const dalSource = readFileSync(
  new URL("../src/lib/db/contest-exam-references.ts", import.meta.url),
  "utf8",
);

function approvedRow(): PublicExamReferenceCandidateRow {
  return {
    referenceId: 1,
    referencePublicId: "ref-1",
    referenceStatus: "approved",
    relationship: "latest_previous_exam",
    primaryDocumentId: 2,
    answerKeyDocumentId: 3,
    referenceReviewedByUserId: 3,
    referenceReviewedAt: new Date("2026-09-10T12:00:00.000Z"),
    selectionVerifiedAt: new Date("2026-09-10T12:00:00.000Z"),
    editionId: 4,
    editionPublicId: "edicao-2025",
    editionTitle: "Edição 2025",
    examDate: "2025-08-10",
    editionStatus: "published",
    editionOfficialUrl: "https://www.cebraspe.org.br/concursos/exemplo",
    editionSourceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
    opportunityInstitutionAcronym: "PCBA",
    opportunityJurisdictionCode: "BA",
    editionInstitutionAcronym: "PCBA",
    editionJurisdictionCode: "BA",
    bankSlug: "cebraspe",
    bankName: "Cebraspe",
    documentId: 2,
    documentPublicId: "caderno-2025",
    documentExamEditionId: 4,
    documentType: "question_booklet",
    documentTitle: "Caderno oficial",
    sourceUrl: "https://cdn.cebraspe.org.br/caderno.pdf",
    sourceHost: "cdn.cebraspe.org.br",
    sourceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
    httpStatus: 200,
    contentType: "application/pdf",
    expectedQuestionCount: 100,
    distributionMode: "external_link",
    sourcePolicy: "licensed_content",
    rightsHolder: "Titular de QA",
    licenseBasis: "Autorização escrita integral de QA",
    licenseReference: "https://example.invalid/licenca",
    licenseEvidenceChecksumSha256: "a".repeat(64),
    licenseEvidenceCheckedAt: new Date("2026-09-09T12:00:00.000Z"),
    licensedAt: new Date("2026-09-01T12:00:00.000Z"),
    licenseExpiresAt: new Date("2027-09-01T12:00:00.000Z"),
    documentStatus: "approved",
    documentReviewedByUserId: 5,
    documentReviewedAt: new Date("2026-09-10T12:00:00.000Z"),
  };
}

function approvedAnswerKeyRow(): PublicExamReferenceCandidateRow {
  return {
    ...approvedRow(),
    documentId: 3,
    documentPublicId: "gabarito-2025",
    documentType: "answer_key",
    documentTitle: "Gabarito oficial",
    sourceUrl: "https://cdn.cebraspe.org.br/gabarito.pdf",
    expectedQuestionCount: null,
    licenseReference: "https://example.invalid/licenca-gabarito",
    licenseEvidenceChecksumSha256: "b".repeat(64),
  };
}

describe("consulta pública da última prova", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.innerJoin.mockReturnValue(mocks.query);
    mocks.query.where.mockReturnValue(mocks.query);
  });

  it("consulta o recorte aprovado e devolve apenas o DTO sanitizado", async () => {
    mocks.query.orderBy.mockResolvedValueOnce([
      approvedAnswerKeyRow(),
      approvedRow(),
    ]);

    const result = await getApprovedContestExamReference(
      " concurso-teste ",
      new Date("2026-09-12T12:00:00.000Z"),
    );

    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.query.innerJoin).toHaveBeenCalledTimes(5);
    expect(mocks.query.where).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      edition: { publicId: "edicao-2025", bank: { name: "Cebraspe" } },
      questionBooklet: {
        officialUrl: "https://cdn.cebraspe.org.br/caderno.pdf",
        accessType: "external_link",
      },
    });
    expect(result).not.toHaveProperty("questionBooklet.licenseReference");
    expect(result).not.toHaveProperty("questionBooklet.storageKey");
  });

  it("não toca no banco para identificador vazio", async () => {
    await expect(getApprovedContestExamReference("   ")).resolves.toBeNull();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("não reapresenta uma edição antiga quando existe edição posterior pendente de fonte", () => {
    expect(dalSource).toContain("from exam_editions newer_edition");
    expect(dalSource).not.toContain("newer_edition.official_url");
    expect(dalSource).not.toContain("newer_edition.source_checked_at");
  });

  it("degrada para ausência segura enquanto a migração não existe", async () => {
    mocks.query.orderBy.mockRejectedValueOnce(
      Object.assign(new Error("undefined table"), { code: "42P01" }),
    );
    await expect(getApprovedContestExamReference("concurso-teste")).resolves.toBeNull();
  });

  it("não esconde falhas operacionais inesperadas", async () => {
    mocks.query.orderBy.mockRejectedValueOnce(new Error("conexão indisponível"));
    await expect(
      getApprovedContestExamReference("concurso-teste"),
    ).rejects.toThrow("conexão indisponível");
  });
});
