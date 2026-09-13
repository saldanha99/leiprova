import { describe, expect, it } from "vitest";

import {
  assertLicensedDocumentCanBeImported,
  buildLicensedPreviousExamReviewFingerprint,
  LicensedPreviousExamImportError,
  parseLicensedPreviousExamPayload,
  prepareLicensedPreviousExamRows,
  validateCompleteLicensedQuestionSet,
  validateLicensedPreviousExamReviewBatch,
} from "@/lib/editorial/licensed-previous-exam-import";

const now = new Date("2026-09-12T15:00:00.000Z");
const sourceCheckedAt = new Date("2026-09-10T15:00:00.000Z");

function option(key: "A" | "B" | "C" | "D" | "E", suffix: string) {
  return {
    key,
    text: `Alternativa sintética ${suffix}`,
    rationale: `Justificativa sintética e completa da alternativa ${suffix}.`,
  };
}

function question(order: number) {
  return {
    order,
    number: String(order),
    subjectId: 41,
    topic: "Tema inteiramente fictício de QA",
    prompt: `Enunciado sintético número ${order}, criado somente para testar o contrato do importador.`,
    explanation:
      "Explicação sintética longa o suficiente para validar a fila sem conteúdo jurídico real.",
    difficulty: 3,
    type: "multiple_choice" as const,
    correctOption: "C" as const,
    options: [
      option("A", `${order}-A`),
      option("B", `${order}-B`),
      option("C", `${order}-C`),
      option("D", `${order}-D`),
      option("E", `${order}-E`),
    ],
  };
}

function payload(questionCount = 2) {
  return parseLicensedPreviousExamPayload(
    JSON.stringify({
      schemaVersion: 1,
      booklet: "Caderno fictício de QA",
      questions: Array.from({ length: questionCount }, (_, index) =>
        question(index + 1),
      ),
    }),
  );
}

function licensedDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 71,
    publicId: "10000000-0000-4000-8000-000000000071",
    examEditionId: 19,
    documentType: "question_booklet",
    title: "Caderno fictício aprovado",
    sourceUrl: "https://provas.example.invalid/caderno.pdf",
    sourceCheckedAt,
    httpStatus: 200,
    contentType: "application/pdf; charset=binary",
    distributionMode: "external_link",
    sourcePolicy: "licensed_content",
    expectedQuestionCount: 2,
    rightsHolder: "Titular fictício de QA",
    licenseBasis:
      "Autorização sintética de teste para reprodução, sem validade jurídica.",
    licenseReference: "https://licencas.example.invalid/evidencias/qa-71",
    licenseEvidenceChecksumSha256: "a".repeat(64),
    licenseEvidenceCheckedAt: new Date("2026-09-10T12:00:00.000Z"),
    licensedAt: new Date("2026-09-01T12:00:00.000Z"),
    licenseExpiresAt: new Date("2027-09-01T12:00:00.000Z"),
    status: "approved",
    initiatedByUserId: 10,
    reviewedByUserId: 11,
    reviewedAt: new Date("2026-09-11T12:00:00.000Z"),
    editionStatus: "published",
    careerTrackId: 7,
    bankSlug: "banca-ficticia",
    bankIsActive: true,
    careerIsActive: true,
    ...overrides,
  };
}

function licensedAnswerKey(overrides: Record<string, unknown> = {}) {
  return licensedDocument({
    id: 72,
    publicId: "10000000-0000-4000-8000-000000000072",
    documentType: "answer_key",
    title: "Gabarito fictício aprovado",
    sourceUrl: "https://provas.example.invalid/gabarito.pdf",
    expectedQuestionCount: null,
    licenseReference: "https://licencas.example.invalid/evidencias/qa-72",
    licenseEvidenceChecksumSha256: "b".repeat(64),
    ...overrides,
  });
}

describe("importação administrativa de prova anterior licenciada", () => {
  it("prepara o caderno completo como pendente e copia a licença do documento", () => {
    const ids = [
      "20000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000002",
    ];
    const document = licensedDocument();
    const plan = prepareLicensedPreviousExamRows({
      payload: payload(),
      document,
      answerKeyDocument: licensedAnswerKey(),
      compatibleSubjects: [{ id: 41, name: "Matéria sintética" }],
      actorUserId: 99,
      now,
      makePublicId: () => ids.shift()!,
    });

    expect(plan.questionRows).toHaveLength(2);
    expect(plan.optionsByQuestion.flat()).toHaveLength(10);
    expect(plan.optionsByQuestion[0]?.filter((item) => item.isCorrect)).toEqual([
      expect.objectContaining({ optionKey: "C", sortOrder: 2 }),
    ]);
    expect(plan.questionRows[0]).toMatchObject({
      quizMode: "previous_exam",
      examEditionId: 19,
      examEditionDocumentId: 71,
      examEditionAnswerKeyDocumentId: 72,
      type: "multiple_choice",
      editorialStatus: "pending_review",
      sourceRights: "licensed",
      sourceRightsHolder: document.rightsHolder,
      licenseBasis: document.licenseBasis,
      licenseReference: document.licenseReference,
      licensedAt: document.licensedAt,
      licenseExpiresAt: document.licenseExpiresAt,
      createdByUserId: 99,
      reviewedByUserId: null,
      reviewNotes: null,
      submittedAt: now,
      verifiedAt: sourceCheckedAt,
    });
    expect(plan.licenseEvidenceUrl).toBe(document.licenseReference);
    expect(plan.licenseEvidenceVersion).toBe(
      document.licenseEvidenceChecksumSha256,
    );
    expect(plan.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("recusa lote parcial, lacunas e números originais repetidos", () => {
    expect(() => validateCompleteLicensedQuestionSet(payload(1), 2)).toThrow(
      "exatamente 2 questões",
    );

    const gap = payload();
    gap.questions[1]!.order = 3;
    expect(() => validateCompleteLicensedQuestionSet(gap, 2)).toThrow(
      "sequência completa",
    );

    const duplicateNumber = payload();
    duplicateNumber.questions[1]!.number = " 1 ";
    expect(() => validateCompleteLicensedQuestionSet(duplicateNumber, 2)).toThrow(
      "números originais",
    );
  });

  it("aceita Cebraspe certo/errado e múltipla escolha com quatro ou cinco opções", () => {
    const trueFalse = {
      ...question(1),
      type: "true_false" as const,
      correctOption: "C",
      options: [option("C", "certo"), option("E", "errado")],
    };
    expect(() =>
      parseLicensedPreviousExamPayload(
        JSON.stringify({ schemaVersion: 1, questions: [trueFalse] }),
      ),
    ).not.toThrow();

    const base = question(1);
    const fourOptions = { ...base, options: base.options.slice(0, 4) };
    expect(() =>
      parseLicensedPreviousExamPayload(
        JSON.stringify({ schemaVersion: 1, questions: [fourOptions] }),
      ),
    ).not.toThrow();
  });

  it("exige a quantidade do tipo, chaves/textos distintos e justificativas", () => {
    const invalid = question(1);
    invalid.options[4] = { ...invalid.options[3]!, key: "D" };
    expect(() =>
      parseLicensedPreviousExamPayload(
        JSON.stringify({ schemaVersion: 1, questions: [invalid] }),
      ),
    ).toThrow("chaves únicas");

    const repeatedText = question(1);
    repeatedText.options[4]!.text = repeatedText.options[0]!.text.toUpperCase();
    expect(() =>
      parseLicensedPreviousExamPayload(
        JSON.stringify({ schemaVersion: 1, questions: [repeatedText] }),
      ),
    ).toThrow("textos distintos");

    const noRationale = question(1);
    noRationale.options[0]!.rationale = "curta";
    expect(() =>
      parseLicensedPreviousExamPayload(
        JSON.stringify({ schemaVersion: 1, questions: [noRationale] }),
      ),
    ).toThrow();

    const wrongTrueFalseCount = {
      ...question(1),
      type: "true_false",
      options: [
        option("C", "certo"),
        option("E", "errado"),
        {
          key: "X",
          text: "Alternativa sintética extra",
          rationale: "Justificativa sintética extra para QA.",
        },
      ],
      correctOption: "C",
    };
    expect(() =>
      parseLicensedPreviousExamPayload(
        JSON.stringify({ schemaVersion: 1, questions: [wrongTrueFalseCount] }),
      ),
    ).toThrow("duas alternativas");

    const missingCorrectKey = { ...question(1), correctOption: "Z" };
    expect(() =>
      parseLicensedPreviousExamPayload(
        JSON.stringify({ schemaVersion: 1, questions: [missingCorrectKey] }),
      ),
    ).toThrow("corresponder a uma alternativa");
  });

  it("inclui conteúdo, gabarito e licença na impressão da revisão", () => {
    const document = licensedDocument();
    const plan = prepareLicensedPreviousExamRows({
      payload: payload(),
      document,
      answerKeyDocument: licensedAnswerKey(),
      compatibleSubjects: [{ id: 41, name: "Matéria sintética" }],
      actorUserId: 99,
      now,
      makePublicId: (() => {
        let value = 0;
        return () => `30000000-0000-4000-8000-${String(++value).padStart(12, "0")}`;
      })(),
    });
    const questions = plan.questionRows.map((row, index) => ({
      id: index + 1,
      ...row,
    }));
    const options = plan.optionsByQuestion.flatMap((group, index) =>
      group.map((item) => ({
        questionId: index + 1,
        optionKey: item.optionKey,
        text: item.text,
        isCorrect: item.isCorrect,
        rationale: item.rationale,
        sortOrder: item.sortOrder,
      })),
    );
    const fingerprint = buildLicensedPreviousExamReviewFingerprint(
      questions,
      options,
    );
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      buildLicensedPreviousExamReviewFingerprint(
        questions,
        options.map((item, index) =>
          index === 0 ? { ...item, isCorrect: !item.isCorrect } : item,
        ),
      ),
    ).not.toBe(fingerprint);
    expect(
      buildLicensedPreviousExamReviewFingerprint(
        questions.map((item, index) =>
          index === 0 ? { ...item, licenseReference: "https://changed.invalid" } : item,
        ),
        options,
      ),
    ).not.toBe(fingerprint);
  });

  it("só permite revisão integral por outro administrador", () => {
    const document = licensedDocument();
    const answerKeyDocument = licensedAnswerKey();
    let sequence = 0;
    const plan = prepareLicensedPreviousExamRows({
      payload: payload(),
      document,
      answerKeyDocument,
      compatibleSubjects: [{ id: 41, name: "Matéria sintética" }],
      actorUserId: 99,
      now,
      makePublicId: () =>
        `40000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    });
    const questions = plan.questionRows.map((row, index) => ({
      id: index + 1,
      ...row,
    }));
    const options = plan.optionsByQuestion.flatMap((group, index) =>
      group.map((item) => ({
        questionId: index + 1,
        optionKey: item.optionKey,
        text: item.text,
        isCorrect: item.isCorrect,
        rationale: item.rationale,
        sortOrder: item.sortOrder,
      })),
    );
    const batch = {
      batchPublicId: "50000000-0000-4000-8000-000000000001",
      documentPublicId: document.publicId,
      answerKeyDocumentPublicId: answerKeyDocument.publicId,
      importedAt: now,
      importedByUserId: 99,
      expectedQuestionCount: 2,
      licenseEvidenceVersion: document.licenseEvidenceChecksumSha256,
      answerKeyLicenseEvidenceVersion:
        answerKeyDocument.licenseEvidenceChecksumSha256,
      questions,
      options,
    };
    const review = {
      batch,
      document,
      answerKeyDocument,
      compatibleSubjects: [{ id: 41, name: "Matéria sintética" }],
      reviewerUserId: 100,
      now,
    };

    expect(() => validateLicensedPreviousExamReviewBatch(review)).not.toThrow();
    expect(() =>
      validateLicensedPreviousExamReviewBatch({ ...review, reviewerUserId: 99 }),
    ).toThrow("outro administrador");
    expect(() =>
      validateLicensedPreviousExamReviewBatch({
        ...review,
        reviewerUserId: 99,
        decision: "reject",
      }),
    ).not.toThrow();
    expect(() =>
      validateLicensedPreviousExamReviewBatch({
        ...review,
        batch: {
          ...batch,
          questions: batch.questions.map((item, index) =>
            index === 0 ? { ...item, editorialStatus: "reviewed" } : item,
          ),
        },
      }),
    ).toThrow("deixou de atender");
    expect(() =>
      validateLicensedPreviousExamReviewBatch({
        ...review,
        batch: { ...batch, options: batch.options.slice(2) },
      }),
    ).toThrow("alternativas");
    expect(() =>
      validateLicensedPreviousExamReviewBatch({
        ...review,
        batch: {
          ...batch,
          questions: batch.questions.map((item, index) =>
            index === 0 ? { ...item, examEditionDocumentId: 999 } : item,
          ),
        },
      }),
    ).toThrow("dossiê licenciado");
    expect(() =>
      validateLicensedPreviousExamReviewBatch({
        ...review,
        batch: {
          ...batch,
          questions: batch.questions.map((item, index) =>
            index === 0
              ? { ...item, verifiedAt: new Date("2026-09-09T15:00:00.000Z") }
              : item,
          ),
        },
      }),
    ).toThrow("dossiê licenciado");
  });

  it("recusa matéria fora da carreira antes de construir qualquer linha", () => {
    expect(() =>
      prepareLicensedPreviousExamRows({
        payload: payload(),
        document: licensedDocument(),
        answerKeyDocument: licensedAnswerKey(),
        compatibleSubjects: [{ id: 88, name: "Outra matéria" }],
        actorUserId: 99,
        now,
      }),
    ).toThrow("não pertence à carreira");
  });

  it("falha fechado sem licença aprovada, vigente e versionada por URL HTTPS", () => {
    for (const overrides of [
      { sourcePolicy: "metadata_only" },
      { status: "pending_review" },
      { licenseReference: "contrato interno sem URL" },
      { licenseExpiresAt: new Date("2026-09-12T14:59:59.000Z") },
      { reviewedByUserId: 10 },
      { sourceCheckedAt: new Date("2026-09-12T15:00:01.000Z") },
    ]) {
      expect(() =>
        assertLicensedDocumentCanBeImported(licensedDocument(overrides), now),
      ).toThrow(LicensedPreviousExamImportError);
    }
  });

  it("não aceita campos inesperados nem JSON malformado", () => {
    expect(() => parseLicensedPreviousExamPayload("{incompleto")).toThrow(
      "não é um JSON válido",
    );
    expect(() =>
      parseLicensedPreviousExamPayload(
        JSON.stringify({
          schemaVersion: 1,
          questions: [question(1)],
          approveAutomatically: true,
        }),
      ),
    ).toThrow();
  });
});
