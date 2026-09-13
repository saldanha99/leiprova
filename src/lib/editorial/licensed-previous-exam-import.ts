import { createHash, randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";

import * as schema from "@/lib/db/schema";

const IMPORT_BATCH_ACTION = "editorial.previous_exam_booklet.imported";
const IMPORT_QUESTION_ACTION = "editorial.previous_exam_question.imported";

/** Mantém o POST do Server Action abaixo do limite padrão de 1 MB, inclusive
 * com o overhead de multipart/form-data. O lote continua aceitando até 300
 * questões, mas falha fechado quando o JSON integral ultrapassa este teto. */
export const MAX_LICENSED_PREVIOUS_EXAM_JSON_BYTES = 750_000;

const safeText = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine((value) => !value.includes("\u0000"), "O texto contém caractere inválido.");

const optionKeySchema = safeText(1, 10).regex(
  /^[A-Z0-9]+$/u,
  "Use uma chave curta em letras maiúsculas ou números.",
);

const optionSchema = z
  .object({
    key: optionKeySchema,
    text: safeText(1, 5_000),
    rationale: safeText(10, 5_000),
  })
  .strict();

const questionSchema = z
  .object({
    order: z.number().int().min(1).max(300),
    number: safeText(1, 80),
    subjectId: z.number().int().positive(),
    topic: safeText(2, 500),
    prompt: safeText(20, 20_000),
    explanation: safeText(20, 20_000),
    difficulty: z.number().int().min(1).max(5),
    type: z.enum(["true_false", "multiple_choice"]),
    correctOption: optionKeySchema,
    options: z.array(optionSchema).min(2).max(5),
  })
  .strict()
  .superRefine((question, context) => {
    const keys = new Set(question.options.map((option) => option.key));
    const expectedOptionCount = question.type === "true_false" ? 2 : null;
    if (
      keys.size !== question.options.length ||
      (expectedOptionCount !== null && question.options.length !== expectedOptionCount) ||
      (question.type === "multiple_choice" &&
        ![4, 5].includes(question.options.length))
    ) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message:
          question.type === "true_false"
            ? "Questão certo/errado exige duas alternativas com chaves únicas."
            : "Questão de múltipla escolha exige quatro ou cinco alternativas com chaves únicas.",
      });
    }
    if (!keys.has(question.correctOption)) {
      context.addIssue({
        code: "custom",
        path: ["correctOption"],
        message: "A resposta correta precisa corresponder a uma alternativa do item.",
      });
    }

    const normalizedTexts = question.options.map((option) =>
      option.text
        .normalize("NFKC")
        .replace(/\s+/gu, " ")
        .trim()
        .toLocaleLowerCase("pt-BR"),
    );
    if (new Set(normalizedTexts).size !== normalizedTexts.length) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "As alternativas precisam ter textos distintos.",
      });
    }
  });

const payloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    booklet: safeText(1, 200).optional(),
    questions: z.array(questionSchema).min(1).max(300),
  })
  .strict();

export type LicensedPreviousExamPayload = z.infer<typeof payloadSchema>;

export class LicensedPreviousExamImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicensedPreviousExamImportError";
  }
}

function firstValidationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "O JSON do caderno é inválido.";
  const location = issue.path.length ? ` (${issue.path.join(".")})` : "";
  return `${issue.message}${location}`;
}

export function parseLicensedPreviousExamPayload(raw: string) {
  if (!raw.trim()) {
    throw new LicensedPreviousExamImportError("Cole o JSON integral do caderno.");
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_LICENSED_PREVIOUS_EXAM_JSON_BYTES) {
    throw new LicensedPreviousExamImportError(
      "O JSON ultrapassa o limite seguro desta importação administrativa.",
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new LicensedPreviousExamImportError("O conteúdo informado não é um JSON válido.");
  }

  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new LicensedPreviousExamImportError(firstValidationMessage(parsed.error));
  }
  return parsed.data;
}

export function validateCompleteLicensedQuestionSet(
  payload: LicensedPreviousExamPayload,
  expectedQuestionCount: number,
) {
  if (
    !Number.isSafeInteger(expectedQuestionCount) ||
    expectedQuestionCount < 1 ||
    expectedQuestionCount > 300
  ) {
    throw new LicensedPreviousExamImportError(
      "O caderno aprovado não possui uma quantidade total válida.",
    );
  }
  if (payload.questions.length !== expectedQuestionCount) {
    throw new LicensedPreviousExamImportError(
      `O lote precisa conter exatamente ${expectedQuestionCount} questões; recebeu ${payload.questions.length}.`,
    );
  }

  const byOrder = [...payload.questions].sort((left, right) => left.order - right.order);
  for (let index = 0; index < byOrder.length; index += 1) {
    if (byOrder[index]?.order !== index + 1) {
      throw new LicensedPreviousExamImportError(
        `As ordens precisam formar a sequência completa de 1 a ${expectedQuestionCount}, sem lacunas ou repetições.`,
      );
    }
  }

  const normalizedNumbers = byOrder.map((question) =>
    question.number
      .normalize("NFKC")
      .replace(/\s+/gu, " ")
      .trim()
      .toLocaleLowerCase("pt-BR"),
  );
  if (new Set(normalizedNumbers).size !== normalizedNumbers.length) {
    throw new LicensedPreviousExamImportError(
      "Os números originais das questões não podem se repetir no mesmo caderno.",
    );
  }

  return byOrder;
}

type LicensedDocumentContext = {
  id: number;
  publicId: string;
  examEditionId: number;
  documentType: string;
  title: string;
  sourceUrl: string;
  sourceCheckedAt: Date;
  httpStatus: number;
  contentType: string | null;
  distributionMode: string;
  sourcePolicy: string;
  expectedQuestionCount: number | null;
  rightsHolder: string | null;
  licenseBasis: string | null;
  licenseReference: string | null;
  licenseEvidenceChecksumSha256: string | null;
  licenseEvidenceCheckedAt: Date | null;
  licensedAt: Date | null;
  licenseExpiresAt: Date | null;
  status: string;
  initiatedByUserId: number | null;
  reviewedByUserId: number | null;
  reviewedAt: Date | null;
  editionStatus: string;
  careerTrackId: number;
  bankSlug: string;
  bankIsActive: boolean;
  careerIsActive: boolean;
};

type CompatibleSubject = {
  id: number;
  name: string;
};

function assertLicensedDocumentCanSupportImport(
  document: LicensedDocumentContext,
  now: Date,
  expectedType: "question_booklet" | "answer_key",
) {
  if (
    document.documentType !== expectedType ||
    document.status !== "approved" ||
    document.sourcePolicy !== "licensed_content"
  ) {
    throw new LicensedPreviousExamImportError(
      expectedType === "question_booklet"
        ? "Selecione um caderno de questões aprovado e com licença escrita."
        : "Selecione o gabarito oficial exato, aprovado e com licença escrita.",
    );
  }
  if (
    !["held", "published"].includes(document.editionStatus) ||
    !document.bankIsActive ||
    !document.careerIsActive
  ) {
    throw new LicensedPreviousExamImportError(
      "A edição, a banca ou a carreira deixou de estar elegível.",
    );
  }
  if (
    document.httpStatus < 200 ||
    document.httpStatus > 399 ||
    document.distributionMode !== "external_link" ||
    document.contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/pdf"
  ) {
    throw new LicensedPreviousExamImportError(
      "O documento aprovado precisa continuar identificado como PDF oficial externo.",
    );
  }
  if (
    !document.rightsHolder?.trim() ||
    !document.licenseBasis?.trim() ||
    !document.licenseReference?.trim() ||
    !document.licenseEvidenceChecksumSha256?.match(/^[a-f0-9]{64}$/u) ||
    !document.licenseEvidenceCheckedAt ||
    !document.licensedAt ||
    !document.reviewedByUserId ||
    !document.reviewedAt
  ) {
    throw new LicensedPreviousExamImportError(
      "O documento não possui a cadeia completa de licença e revisão.",
    );
  }
  if (
    document.initiatedByUserId !== null &&
    document.initiatedByUserId === document.reviewedByUserId
  ) {
    throw new LicensedPreviousExamImportError(
      "A licença do documento não possui revisão administrativa independente.",
    );
  }
  if (
    document.sourceCheckedAt > now ||
    document.licenseEvidenceCheckedAt > now ||
    document.licensedAt > now ||
    document.reviewedAt > now ||
    document.licenseEvidenceCheckedAt > document.reviewedAt ||
    (document.licenseExpiresAt !== null && document.licenseExpiresAt <= now)
  ) {
    throw new LicensedPreviousExamImportError(
      "A licença ainda não começou, venceu ou possui revisão com data futura.",
    );
  }

  let evidenceUrl: URL;
  try {
    evidenceUrl = new URL(document.licenseReference);
  } catch {
    throw new LicensedPreviousExamImportError(
      "A referência da licença precisa ser uma URL HTTPS de evidência.",
    );
  }
  if (
    evidenceUrl.protocol !== "https:" ||
    evidenceUrl.username ||
    evidenceUrl.password ||
    !evidenceUrl.hostname
  ) {
    throw new LicensedPreviousExamImportError(
      "A referência da licença precisa ser uma URL HTTPS de evidência.",
    );
  }
  return evidenceUrl.toString();
}

export function assertLicensedDocumentCanBeImported(
  document: LicensedDocumentContext,
  now: Date,
) {
  return assertLicensedDocumentCanSupportImport(document, now, "question_booklet");
}

export function assertLicensedAnswerKeyCanBeImported(
  document: LicensedDocumentContext,
  now: Date,
) {
  return assertLicensedDocumentCanSupportImport(document, now, "answer_key");
}

export function prepareLicensedPreviousExamRows(input: {
  payload: LicensedPreviousExamPayload;
  document: LicensedDocumentContext;
  answerKeyDocument: LicensedDocumentContext;
  compatibleSubjects: readonly CompatibleSubject[];
  actorUserId: number;
  now: Date;
  makePublicId?: () => string;
}) {
  const licenseEvidenceUrl = assertLicensedDocumentCanBeImported(
    input.document,
    input.now,
  );
  const answerKeyLicenseEvidenceUrl = assertLicensedAnswerKeyCanBeImported(
    input.answerKeyDocument,
    input.now,
  );
  if (
    input.answerKeyDocument.examEditionId !== input.document.examEditionId ||
    input.answerKeyDocument.id === input.document.id
  ) {
    throw new LicensedPreviousExamImportError(
      "O gabarito precisa pertencer à mesma edição e ser distinto do caderno.",
    );
  }
  const ordered = validateCompleteLicensedQuestionSet(
    input.payload,
    input.document.expectedQuestionCount ?? 0,
  );
  const subjectMap = new Map(
    input.compatibleSubjects.map((subject) => [subject.id, subject] as const),
  );
  const invalidSubject = ordered.find((question) => !subjectMap.has(question.subjectId));
  if (invalidSubject) {
    throw new LicensedPreviousExamImportError(
      `A matéria ${invalidSubject.subjectId} da questão ${invalidSubject.order} não pertence à carreira desta edição.`,
    );
  }

  const makePublicId = input.makePublicId ?? randomUUID;
  const publicIds = ordered.map(() => makePublicId());
  if (new Set(publicIds).size !== publicIds.length) {
    throw new LicensedPreviousExamImportError(
      "Não foi possível gerar identificações únicas para o lote.",
    );
  }
  const booklet = input.payload.booklet ?? input.document.title;
  const questionRows = ordered.map((question, index) => ({
    publicId: publicIds[index]!,
    legalArticleId: null,
    subjectId: question.subjectId,
    topicId: null,
    quizMode: "previous_exam",
    styleBankId: null,
    examEditionId: input.document.examEditionId,
    examEditionDocumentId: input.document.id,
    examEditionAnswerKeyDocumentId: input.answerKeyDocument.id,
    examEditionAnswerKeyDocumentType: "answer_key",
    type: question.type,
    prompt: question.prompt,
    explanation: question.explanation,
    learningObjective: null,
    topic: question.topic,
    difficulty: question.difficulty,
    mutationKind: null,
    examBoardStyle: input.document.bankSlug,
    editorialStatus: "pending_review",
    sourceRights: "licensed",
    sourceTitle: input.document.title,
    sourceUrl: input.document.sourceUrl,
    sourceRightsHolder: input.document.rightsHolder!,
    licenseBasis: input.document.licenseBasis!,
    licenseReference: input.document.licenseReference!,
    licensedAt: input.document.licensedAt!,
    licenseExpiresAt: input.document.licenseExpiresAt,
    originalQuestionNumber: question.number,
    originalQuestionOrder: question.order,
    originalBooklet: booklet,
    authorshipMethod: "human",
    generatorModel: null,
    promptVersion: null,
    createdByUserId: input.actorUserId,
    reviewedByUserId: null,
    cleanRoomAttestedAt: null,
    submittedAt: input.now,
    reviewNotes: null,
    similarityMaxBps: 0,
    similarityReferencePublicId: null,
    originalityCheckedAt: null,
    verifiedAt:
      input.document.sourceCheckedAt >= input.answerKeyDocument.sourceCheckedAt
        ? input.document.sourceCheckedAt
        : input.answerKeyDocument.sourceCheckedAt,
  }));
  const optionsByQuestion = ordered.map((question, questionIndex) =>
    question.options.map((option, sortOrder) => ({
        questionPublicId: publicIds[questionIndex]!,
        optionKey: option.key,
        text: option.text,
        isCorrect: option.key === question.correctOption,
        mutationKind: null,
        rationale: option.rationale,
        sortOrder,
      })),
  );
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        documentPublicId: input.document.publicId,
        answerKeyDocumentPublicId: input.answerKeyDocument.publicId,
        licenseEvidenceUrl,
        licenseEvidenceChecksumSha256:
          input.document.licenseEvidenceChecksumSha256,
        licenseEvidenceCheckedAt:
          input.document.licenseEvidenceCheckedAt?.toISOString(),
        answerKeyLicenseEvidenceUrl,
        answerKeyLicenseEvidenceChecksumSha256:
          input.answerKeyDocument.licenseEvidenceChecksumSha256,
        answerKeyLicenseEvidenceCheckedAt:
          input.answerKeyDocument.licenseEvidenceCheckedAt?.toISOString(),
        questions: ordered,
      }),
    )
    .digest("hex");

  return {
    ordered,
    questionRows,
    optionsByQuestion,
    fingerprint,
    licenseEvidenceUrl,
    answerKeyLicenseEvidenceUrl,
    licenseEvidenceVersion: input.document.licenseEvidenceChecksumSha256!,
    answerKeyLicenseEvidenceVersion:
      input.answerKeyDocument.licenseEvidenceChecksumSha256!,
  };
}

type Database = PostgresJsDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

async function loadLicensedDocumentContext(
  transaction: Executor,
  documentPublicId: string,
) {
  const [document] = await transaction
    .select({
      id: schema.examEditionDocuments.id,
      publicId: schema.examEditionDocuments.publicId,
      examEditionId: schema.examEditionDocuments.examEditionId,
      documentType: schema.examEditionDocuments.documentType,
      title: schema.examEditionDocuments.title,
      sourceUrl: schema.examEditionDocuments.sourceUrl,
      sourceCheckedAt: schema.examEditionDocuments.sourceCheckedAt,
      httpStatus: schema.examEditionDocuments.httpStatus,
      contentType: schema.examEditionDocuments.contentType,
      distributionMode: schema.examEditionDocuments.distributionMode,
      sourcePolicy: schema.examEditionDocuments.sourcePolicy,
      expectedQuestionCount: schema.examEditionDocuments.expectedQuestionCount,
      rightsHolder: schema.examEditionDocuments.rightsHolder,
      licenseBasis: schema.examEditionDocuments.licenseBasis,
      licenseReference: schema.examEditionDocuments.licenseReference,
      licenseEvidenceChecksumSha256:
        schema.examEditionDocuments.licenseEvidenceChecksumSha256,
      licenseEvidenceCheckedAt:
        schema.examEditionDocuments.licenseEvidenceCheckedAt,
      licensedAt: schema.examEditionDocuments.licensedAt,
      licenseExpiresAt: schema.examEditionDocuments.licenseExpiresAt,
      status: schema.examEditionDocuments.status,
      initiatedByUserId: schema.examEditionDocuments.initiatedByUserId,
      reviewedByUserId: schema.examEditionDocuments.reviewedByUserId,
      reviewedAt: schema.examEditionDocuments.reviewedAt,
      editionStatus: schema.examEditions.status,
      careerTrackId: schema.examEditions.careerTrackId,
      bankSlug: schema.quizBanks.slug,
      bankIsActive: schema.quizBanks.isActive,
      careerIsActive: schema.quizCareerTracks.isActive,
    })
    .from(schema.examEditionDocuments)
    .innerJoin(
      schema.examEditions,
      eq(schema.examEditionDocuments.examEditionId, schema.examEditions.id),
    )
    .innerJoin(schema.quizBanks, eq(schema.examEditions.bankId, schema.quizBanks.id))
    .innerJoin(
      schema.quizCareerTracks,
      eq(schema.examEditions.careerTrackId, schema.quizCareerTracks.id),
    )
    .where(eq(schema.examEditionDocuments.publicId, documentPublicId))
    .limit(1);
  return document ?? null;
}

async function lockExamDocumentsForShare(
  transaction: Transaction,
  documentIds: readonly number[],
) {
  const ids = [...new Set(documentIds)].sort((left, right) => left - right);
  if (!ids.length) {
    throw new LicensedPreviousExamImportError("Documentos do lote inválidos.");
  }
  const locked = await transaction.execute(sql`
    select ${schema.examEditionDocuments.id}
    from ${schema.examEditionDocuments}
    where ${schema.examEditionDocuments.id} in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by ${schema.examEditionDocuments.id}
    for share
  `);
  if (locked.count !== ids.length) {
    throw new LicensedPreviousExamImportError(
      "Um dos documentos do lote deixou de existir.",
    );
  }
}

/** Importa apenas um caderno integral previamente licenciado. Não baixa PDF,
 * não raspa a banca, não cria vínculo comercial e nunca grava status reviewed. */
export async function importLicensedPreviousExamBooklet(
  db: Database,
  request: {
    documentPublicId: string;
    answerKeyDocumentPublicId: string;
    payload: LicensedPreviousExamPayload;
    actorUserId: number;
  },
) {
  if (!Number.isSafeInteger(request.actorUserId) || request.actorUserId < 1) {
    throw new LicensedPreviousExamImportError("Operador administrativo inválido.");
  }

  return db.transaction(
    async (transaction) => {
      await transaction.execute(sql`set local statement_timeout = '30s'`);
      await transaction.execute(sql`set local lock_timeout = '5s'`);

      const [actor] = await transaction
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(eq(schema.users.id, request.actorUserId), eq(schema.users.role, "admin")),
        )
        .limit(1);
      if (!actor) {
        throw new LicensedPreviousExamImportError(
          "O operador deixou de possuir autorização administrativa.",
        );
      }

      const pointer = await loadLicensedDocumentContext(
        transaction,
        request.documentPublicId,
      );
      if (!pointer) {
        throw new LicensedPreviousExamImportError("Caderno licenciado não encontrado.");
      }
      const answerKeyPointer = await loadLicensedDocumentContext(
        transaction,
        request.answerKeyDocumentPublicId,
      );
      if (
        !answerKeyPointer ||
        answerKeyPointer.examEditionId !== pointer.examEditionId ||
        answerKeyPointer.id === pointer.id
      ) {
        throw new LicensedPreviousExamImportError(
          "Gabarito oficial licenciado incompatível com o caderno.",
        );
      }
      await transaction.execute(
        sql`select public.lock_exam_document_review_edition(${pointer.examEditionId})`,
      );
      await lockExamDocumentsForShare(transaction, [
        pointer.id,
        answerKeyPointer.id,
      ]);
      const document = await loadLicensedDocumentContext(
        transaction,
        request.documentPublicId,
      );
      const answerKeyDocument = await loadLicensedDocumentContext(
        transaction,
        request.answerKeyDocumentPublicId,
      );
      if (
        !document ||
        !answerKeyDocument ||
        document.examEditionId !== pointer.examEditionId ||
        answerKeyDocument.id !== answerKeyPointer.id ||
        answerKeyDocument.examEditionId !== document.examEditionId
      ) {
        throw new LicensedPreviousExamImportError(
          "O caderno ou o gabarito mudou durante a conferência. Recarregue o painel.",
        );
      }

      const subjectIds = [
        ...new Set(request.payload.questions.map((question) => question.subjectId)),
      ].sort((left, right) => left - right);
      const compatibleSubjects = await transaction
        .select({ id: schema.quizSubjects.id, name: schema.quizSubjects.name })
        .from(schema.quizCareerSubjects)
        .innerJoin(
          schema.quizSubjects,
          eq(schema.quizCareerSubjects.subjectId, schema.quizSubjects.id),
        )
        .where(
          and(
            eq(schema.quizCareerSubjects.careerTrackId, document.careerTrackId),
            eq(schema.quizSubjects.isActive, true),
            inArray(schema.quizSubjects.id, subjectIds),
          ),
        );

      const now = new Date();
      const plan = prepareLicensedPreviousExamRows({
        payload: request.payload,
        document,
        answerKeyDocument,
        compatibleSubjects,
        actorUserId: actor.id,
        now,
      });
      const orders = plan.ordered.map((question) => question.order);
      const activeDuplicates = await transaction
        .select({ order: schema.questions.originalQuestionOrder })
        .from(schema.questions)
        .where(
          and(
            eq(schema.questions.examEditionDocumentId, document.id),
            eq(schema.questions.quizMode, "previous_exam"),
            inArray(schema.questions.originalQuestionOrder, orders),
            ne(schema.questions.editorialStatus, "suspended"),
          ),
        );
      if (activeDuplicates.length) {
        const duplicateOrders = activeDuplicates
          .map((item) => item.order)
          .filter((order): order is number => order !== null)
          .sort((left, right) => left - right);
        throw new LicensedPreviousExamImportError(
          `O caderno já possui versões ativas nas ordens ${duplicateOrders.join(", ")}. Suspenda-as antes de importar uma nova versão.`,
        );
      }

      const inserted = await transaction
        .insert(schema.questions)
        .values(plan.questionRows)
        .returning({ id: schema.questions.id, publicId: schema.questions.publicId });
      if (inserted.length !== plan.questionRows.length) {
        throw new LicensedPreviousExamImportError(
          "O banco não confirmou o caderno completo; toda a importação foi cancelada.",
        );
      }
      const idsByPublicId = new Map(
        inserted.map((question) => [question.publicId, question.id] as const),
      );
      const optionRows = plan.optionsByQuestion.flatMap((options) =>
        options.map(({ questionPublicId, ...option }) => {
          const questionId = idsByPublicId.get(questionPublicId);
          if (!questionId) {
            throw new LicensedPreviousExamImportError(
              "Uma questão perdeu o vínculo com suas alternativas.",
            );
          }
          return { ...option, questionId };
        }),
      );
      await transaction.insert(schema.questionOptions).values(optionRows);

      const batchPublicId = randomUUID();
      await transaction.insert(schema.auditLogs).values([
        {
          actorUserId: actor.id,
          action: IMPORT_BATCH_ACTION,
          entityType: "exam_edition_document",
          entityId: document.publicId,
          metadata: {
            batchPublicId,
            importedQuestions: inserted.length,
            expectedQuestionCount: document.expectedQuestionCount,
            examEditionDocumentId: document.id,
            examEditionAnswerKeyDocumentId: answerKeyDocument.id,
            answerKeyDocumentPublicId: answerKeyDocument.publicId,
            contentFingerprint: plan.fingerprint,
            licenseEvidenceUrl: plan.licenseEvidenceUrl,
            licenseEvidenceVersion: plan.licenseEvidenceVersion,
            answerKeyLicenseEvidenceUrl: plan.answerKeyLicenseEvidenceUrl,
            answerKeyLicenseEvidenceVersion:
              plan.answerKeyLicenseEvidenceVersion,
            storedDocumentCopy: false,
            automaticApproval: false,
            resultingStatus: "pending_review",
          },
        },
        ...plan.questionRows.map((question) => ({
          actorUserId: actor.id,
          action: IMPORT_QUESTION_ACTION,
          entityType: "question",
          entityId: question.publicId,
          metadata: {
            batchPublicId,
            examEditionDocumentId: document.id,
            documentPublicId: document.publicId,
            examEditionAnswerKeyDocumentId: answerKeyDocument.id,
            answerKeyDocumentPublicId: answerKeyDocument.publicId,
            originalQuestionOrder: question.originalQuestionOrder,
            subjectId: question.subjectId,
            licenseEvidenceVersion: plan.licenseEvidenceVersion,
            answerKeyLicenseEvidenceVersion:
              plan.answerKeyLicenseEvidenceVersion,
            automaticApproval: false,
          },
        })),
      ]);

      return {
        batchPublicId,
        importedQuestions: inserted.length,
        editorialStatus: "pending_review" as const,
        automaticApproval: false as const,
        licenseEvidenceVersion: plan.licenseEvidenceVersion,
        answerKeyLicenseEvidenceVersion: plan.answerKeyLicenseEvidenceVersion,
      };
    },
    { isolationLevel: "serializable" },
  );
}

export type LicensedPreviousExamReviewQuestion = {
  id: number;
  publicId: string;
  examEditionId: number | null;
  examEditionDocumentId: number | null;
  examEditionAnswerKeyDocumentId: number | null;
  examEditionAnswerKeyDocumentType: string | null;
  type: string;
  prompt: string;
  explanation: string;
  topic: string;
  difficulty: number;
  editorialStatus: string;
  sourceRights: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceRightsHolder: string | null;
  licenseBasis: string | null;
  licenseReference: string | null;
  licensedAt: Date | null;
  licenseExpiresAt: Date | null;
  originalQuestionNumber: string | null;
  originalQuestionOrder: number | null;
  originalBooklet: string | null;
  subjectId: number | null;
  createdByUserId: number | null;
  reviewedByUserId: number | null;
  submittedAt: Date | null;
  reviewNotes: string | null;
  verifiedAt: Date;
};

export type LicensedPreviousExamReviewOption = {
  questionId: number;
  optionKey: string;
  text: string;
  isCorrect: boolean;
  rationale: string | null;
  sortOrder: number;
};

function stableDate(value: Date | null) {
  return value?.toISOString() ?? null;
}

export function buildLicensedPreviousExamReviewFingerprint(
  questions: readonly LicensedPreviousExamReviewQuestion[],
  options: readonly LicensedPreviousExamReviewOption[],
  dossier?: {
    documentPublicId: string;
    answerKeyDocumentPublicId: string;
    licenseEvidenceVersion: string;
    answerKeyLicenseEvidenceVersion: string;
  },
) {
  const stableQuestions = [...questions]
    .sort(
      (left, right) =>
        (left.originalQuestionOrder ?? 0) - (right.originalQuestionOrder ?? 0) ||
        left.id - right.id,
    )
    .map((question) => ({
      ...question,
      licensedAt: stableDate(question.licensedAt),
      licenseExpiresAt: stableDate(question.licenseExpiresAt),
      submittedAt: stableDate(question.submittedAt),
      verifiedAt: question.verifiedAt.toISOString(),
    }));
  const stableOptions = [...options]
    .sort(
      (left, right) =>
        left.questionId - right.questionId || left.sortOrder - right.sortOrder,
    )
    .map((option) => ({ ...option }));
  return createHash("sha256")
    .update(
      JSON.stringify({
        dossier: dossier ?? null,
        questions: stableQuestions,
        options: stableOptions,
      }),
    )
    .digest("hex");
}

export type ImportedLicensedPreviousExamBatch = {
  batchPublicId: string;
  documentPublicId: string;
  answerKeyDocumentPublicId: string;
  importedAt: Date;
  importedByUserId: number | null;
  expectedQuestionCount: number | null;
  licenseEvidenceVersion: string;
  answerKeyLicenseEvidenceVersion: string;
  questions: LicensedPreviousExamReviewQuestion[];
  options: LicensedPreviousExamReviewOption[];
};

async function loadImportedBatch(
  executor: Executor,
  batchPublicId: string,
): Promise<ImportedLicensedPreviousExamBatch | null> {
  const [batch] = await executor
    .select({
      documentPublicId: schema.auditLogs.entityId,
      importedAt: schema.auditLogs.createdAt,
      importedByUserId: schema.auditLogs.actorUserId,
      expectedQuestionCount:
        sql<number | null>`nullif(${schema.auditLogs.metadata}->>'expectedQuestionCount', '')::integer`,
      answerKeyDocumentPublicId: sql<string | null>`${schema.auditLogs.metadata}->>'answerKeyDocumentPublicId'`,
      licenseEvidenceVersion: sql<string | null>`${schema.auditLogs.metadata}->>'licenseEvidenceVersion'`,
      answerKeyLicenseEvidenceVersion: sql<string | null>`${schema.auditLogs.metadata}->>'answerKeyLicenseEvidenceVersion'`,
    })
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.action, IMPORT_BATCH_ACTION),
        eq(schema.auditLogs.entityType, "exam_edition_document"),
        sql`${schema.auditLogs.metadata}->>'batchPublicId' = ${batchPublicId}`,
      ),
    )
    .orderBy(desc(schema.auditLogs.id))
    .limit(1);
  if (
    !batch?.documentPublicId ||
    !batch.answerKeyDocumentPublicId ||
    !batch.licenseEvidenceVersion?.match(/^[a-f0-9]{64}$/u) ||
    !batch.answerKeyLicenseEvidenceVersion?.match(/^[a-f0-9]{64}$/u)
  ) {
    return null;
  }

  const questions = await executor
    .select({
      id: schema.questions.id,
      publicId: schema.questions.publicId,
      examEditionId: schema.questions.examEditionId,
      examEditionDocumentId: schema.questions.examEditionDocumentId,
      examEditionAnswerKeyDocumentId:
        schema.questions.examEditionAnswerKeyDocumentId,
      examEditionAnswerKeyDocumentType:
        schema.questions.examEditionAnswerKeyDocumentType,
      type: schema.questions.type,
      prompt: schema.questions.prompt,
      explanation: schema.questions.explanation,
      topic: schema.questions.topic,
      difficulty: schema.questions.difficulty,
      editorialStatus: schema.questions.editorialStatus,
      sourceRights: schema.questions.sourceRights,
      sourceTitle: schema.questions.sourceTitle,
      sourceUrl: schema.questions.sourceUrl,
      sourceRightsHolder: schema.questions.sourceRightsHolder,
      licenseBasis: schema.questions.licenseBasis,
      licenseReference: schema.questions.licenseReference,
      licensedAt: schema.questions.licensedAt,
      licenseExpiresAt: schema.questions.licenseExpiresAt,
      originalQuestionNumber: schema.questions.originalQuestionNumber,
      originalQuestionOrder: schema.questions.originalQuestionOrder,
      originalBooklet: schema.questions.originalBooklet,
      subjectId: schema.questions.subjectId,
      createdByUserId: schema.questions.createdByUserId,
      reviewedByUserId: schema.questions.reviewedByUserId,
      submittedAt: schema.questions.submittedAt,
      reviewNotes: schema.questions.reviewNotes,
      verifiedAt: schema.questions.verifiedAt,
    })
    .from(schema.auditLogs)
    .innerJoin(
      schema.questions,
      eq(schema.auditLogs.entityId, schema.questions.publicId),
    )
    .where(
      and(
        eq(schema.auditLogs.action, IMPORT_QUESTION_ACTION),
        eq(schema.auditLogs.entityType, "question"),
        sql`${schema.auditLogs.metadata}->>'batchPublicId' = ${batchPublicId}`,
      ),
    )
    .orderBy(asc(schema.questions.originalQuestionOrder), asc(schema.questions.id));
  if (!questions.length) return null;
  const options = await executor
    .select({
      questionId: schema.questionOptions.questionId,
      optionKey: schema.questionOptions.optionKey,
      text: schema.questionOptions.text,
      isCorrect: schema.questionOptions.isCorrect,
      rationale: schema.questionOptions.rationale,
      sortOrder: schema.questionOptions.sortOrder,
    })
    .from(schema.questionOptions)
    .where(
      inArray(
        schema.questionOptions.questionId,
        questions.map((question) => question.id),
      ),
    )
    .orderBy(
      asc(schema.questionOptions.questionId),
      asc(schema.questionOptions.sortOrder),
    );

  return {
    batchPublicId,
    documentPublicId: batch.documentPublicId,
    answerKeyDocumentPublicId: batch.answerKeyDocumentPublicId,
    importedAt: batch.importedAt,
    importedByUserId: batch.importedByUserId,
    expectedQuestionCount: batch.expectedQuestionCount,
    licenseEvidenceVersion: batch.licenseEvidenceVersion,
    answerKeyLicenseEvidenceVersion:
      batch.answerKeyLicenseEvidenceVersion,
    questions,
    options,
  };
}

export function validateLicensedPreviousExamReviewBatch(input: {
  batch: ImportedLicensedPreviousExamBatch;
  document: LicensedDocumentContext;
  answerKeyDocument: LicensedDocumentContext;
  compatibleSubjects: readonly CompatibleSubject[];
  reviewerUserId: number;
  decision?: "approve" | "reject";
  now: Date;
}) {
  assertLicensedDocumentCanBeImported(input.document, input.now);
  assertLicensedAnswerKeyCanBeImported(input.answerKeyDocument, input.now);
  if (
    input.answerKeyDocument.examEditionId !== input.document.examEditionId ||
    input.answerKeyDocument.id === input.document.id ||
    input.batch.documentPublicId !== input.document.publicId ||
    input.batch.answerKeyDocumentPublicId !== input.answerKeyDocument.publicId
  ) {
    throw new LicensedPreviousExamImportError(
      "O gabarito auditado não corresponde ao caderno desta edição.",
    );
  }
  if (
    input.batch.licenseEvidenceVersion !==
      input.document.licenseEvidenceChecksumSha256 ||
    input.batch.answerKeyLicenseEvidenceVersion !==
      input.answerKeyDocument.licenseEvidenceChecksumSha256
  ) {
    throw new LicensedPreviousExamImportError(
      "A versão auditada da autorização não corresponde mais ao dossiê jurídico.",
    );
  }
  const expected = input.document.expectedQuestionCount ?? 0;
  if (
    input.batch.expectedQuestionCount !== expected ||
    input.batch.questions.length !== expected
  ) {
    throw new LicensedPreviousExamImportError(
      "O lote auditado não corresponde mais ao total integral do caderno.",
    );
  }
  if (
    input.batch.importedByUserId === null ||
    (input.decision !== "reject" &&
      input.batch.importedByUserId === input.reviewerUserId)
  ) {
    throw new LicensedPreviousExamImportError(
      "A revisão do caderno precisa ser feita por outro administrador.",
    );
  }

  const subjectIds = new Set(input.compatibleSubjects.map((subject) => subject.id));
  const optionsByQuestion = new Map<number, LicensedPreviousExamReviewOption[]>();
  for (const option of input.batch.options) {
    const current = optionsByQuestion.get(option.questionId) ?? [];
    current.push(option);
    optionsByQuestion.set(option.questionId, current);
  }
  const orders: number[] = [];
  const questionNumbers = new Set<string>();
  for (const question of input.batch.questions) {
    if (
      question.editorialStatus !== "pending_review" ||
      question.reviewedByUserId !== null ||
      question.createdByUserId !== input.batch.importedByUserId ||
      question.examEditionId !== input.document.examEditionId ||
      question.examEditionDocumentId !== input.document.id ||
      question.examEditionAnswerKeyDocumentId !== input.answerKeyDocument.id ||
      question.examEditionAnswerKeyDocumentType !== "answer_key" ||
      question.sourceRights !== "licensed" ||
      question.sourceTitle !== input.document.title ||
      question.sourceUrl !== input.document.sourceUrl ||
      question.sourceRightsHolder !== input.document.rightsHolder ||
      question.licenseBasis !== input.document.licenseBasis ||
      question.licenseReference !== input.document.licenseReference ||
      question.licensedAt?.getTime() !== input.document.licensedAt?.getTime() ||
      question.licenseExpiresAt?.getTime() !==
        input.document.licenseExpiresAt?.getTime() ||
      question.verifiedAt.getTime() !==
        Math.max(
          input.document.sourceCheckedAt.getTime(),
          input.answerKeyDocument.sourceCheckedAt.getTime(),
        ) ||
      question.submittedAt === null ||
      question.subjectId === null ||
      !subjectIds.has(question.subjectId) ||
      question.originalQuestionOrder === null ||
      question.originalQuestionNumber === null ||
      question.originalQuestionNumber.trim().length < 1 ||
      question.originalQuestionNumber.trim().length > 80 ||
      question.originalBooklet === null ||
      question.originalBooklet.trim().length < 1 ||
      question.originalBooklet.trim().length > 200 ||
      question.difficulty < 1 ||
      question.difficulty > 5 ||
      question.prompt.trim().length < 20 ||
      question.prompt.trim().length > 20_000 ||
      question.explanation.trim().length < 20 ||
      question.explanation.trim().length > 20_000 ||
      question.topic.trim().length < 2 ||
      question.topic.trim().length > 500 ||
      !["true_false", "multiple_choice"].includes(question.type)
    ) {
      throw new LicensedPreviousExamImportError(
        `A questão ${question.originalQuestionOrder ?? question.publicId} deixou de atender ao dossiê licenciado.`,
      );
    }
    orders.push(question.originalQuestionOrder);
    const normalizedNumber = question.originalQuestionNumber
      .normalize("NFKC")
      .replace(/\s+/gu, " ")
      .trim()
      .toLocaleLowerCase("pt-BR");
    if (questionNumbers.has(normalizedNumber)) {
      throw new LicensedPreviousExamImportError(
        "O lote possui números originais repetidos.",
      );
    }
    questionNumbers.add(normalizedNumber);

    const options = optionsByQuestion.get(question.id) ?? [];
    const expectedOptions = question.type === "true_false" ? [2] : [4, 5];
    const optionKeys = new Set(options.map((option) => option.optionKey));
    const optionTexts = new Set(
      options.map((option) =>
        option.text
          .normalize("NFKC")
          .replace(/\s+/gu, " ")
          .trim()
          .toLocaleLowerCase("pt-BR"),
      ),
    );
    if (
      !expectedOptions.includes(options.length) ||
      optionKeys.size !== options.length ||
      optionTexts.size !== options.length ||
      options.filter((option) => option.isCorrect).length !== 1 ||
      options.some(
        (option) =>
          !option.optionKey.trim() ||
          option.optionKey.length > 10 ||
          !/^[A-Z0-9]+$/u.test(option.optionKey) ||
          !option.text.trim() ||
          option.text.length > 5_000 ||
          !option.rationale ||
          option.rationale.trim().length < 10 ||
          option.rationale.length > 5_000,
      )
    ) {
      throw new LicensedPreviousExamImportError(
        `As alternativas da questão ${question.originalQuestionOrder} deixaram de atender ao dossiê.`,
      );
    }
  }
  orders.sort((left, right) => left - right);
  if (orders.some((order, index) => order !== index + 1)) {
    throw new LicensedPreviousExamImportError(
      "O lote deixou de representar as ordens completas do caderno.",
    );
  }
}

export type LicensedPreviousExamReviewBatch = ImportedLicensedPreviousExamBatch & {
  documentTitle: string;
  answerKeyDocumentTitle: string;
  rightsHolder: string;
  licenseEvidenceUrl: string;
  licenseEvidenceVersion: string;
  answerKeyLicenseEvidenceUrl: string;
  answerKeyLicenseEvidenceVersion: string;
  fingerprint: string;
};

/** DTO administrativo limitado aos lotes recentes que ainda aguardam decisão. */
export async function listLicensedPreviousExamReviewBatches(
  db: Database,
  limit = 3,
): Promise<LicensedPreviousExamReviewBatch[]> {
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const candidates = await db
    .select({
      batchPublicId: sql<string>`${schema.auditLogs.metadata}->>'batchPublicId'`,
    })
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.action, IMPORT_BATCH_ACTION),
        eq(schema.auditLogs.entityType, "exam_edition_document"),
      ),
    )
    .orderBy(desc(schema.auditLogs.id))
    .limit(safeLimit * 3);
  const results: LicensedPreviousExamReviewBatch[] = [];
  for (const candidate of candidates) {
    if (results.length >= safeLimit) break;
    if (!candidate.batchPublicId) continue;
    const batch = await loadImportedBatch(db, candidate.batchPublicId);
    if (
      !batch ||
      !batch.questions.every(
        (question) => question.editorialStatus === "pending_review",
      )
    ) {
      continue;
    }
    const document = await loadLicensedDocumentContext(db, batch.documentPublicId);
    const answerKeyDocument = await loadLicensedDocumentContext(
      db,
      batch.answerKeyDocumentPublicId,
    );
    if (
      !document?.rightsHolder ||
      !document.licenseReference ||
      document.status !== "approved" ||
      !answerKeyDocument?.licenseReference ||
      answerKeyDocument.status !== "approved" ||
      answerKeyDocument.examEditionId !== document.examEditionId ||
      batch.licenseEvidenceVersion !==
        document.licenseEvidenceChecksumSha256 ||
      batch.answerKeyLicenseEvidenceVersion !==
        answerKeyDocument.licenseEvidenceChecksumSha256
    ) {
      continue;
    }
    let licenseEvidenceUrl: string;
    let answerKeyLicenseEvidenceUrl: string;
    try {
      licenseEvidenceUrl = assertLicensedDocumentCanBeImported(
        document,
        new Date(),
      );
      answerKeyLicenseEvidenceUrl = assertLicensedAnswerKeyCanBeImported(
        answerKeyDocument,
        new Date(),
      );
    } catch {
      continue;
    }
    results.push({
      ...batch,
      documentTitle: document.title,
      answerKeyDocumentTitle: answerKeyDocument.title,
      rightsHolder: document.rightsHolder,
      licenseEvidenceUrl,
      licenseEvidenceVersion: batch.licenseEvidenceVersion,
      answerKeyLicenseEvidenceUrl,
      answerKeyLicenseEvidenceVersion:
        batch.answerKeyLicenseEvidenceVersion,
      fingerprint: buildLicensedPreviousExamReviewFingerprint(
        batch.questions,
        batch.options,
        {
          documentPublicId: batch.documentPublicId,
          answerKeyDocumentPublicId: batch.answerKeyDocumentPublicId,
          licenseEvidenceVersion: batch.licenseEvidenceVersion,
          answerKeyLicenseEvidenceVersion:
            batch.answerKeyLicenseEvidenceVersion,
        },
      ),
    });
  }
  return results;
}

/** Decide o lote inteiro na mesma transação. Aprovar uma parte é proibido: uma
 * falha em questão, alternativa, licença ou fingerprint desfaz todas as linhas. */
export async function reviewLicensedPreviousExamBooklet(
  db: Database,
  request: {
    batchPublicId: string;
    reviewerUserId: number;
    decision: "approve" | "reject";
    notes: string;
    fingerprint: string;
  },
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      request.batchPublicId,
    ) ||
    !/^[a-f0-9]{64}$/u.test(request.fingerprint) ||
    !Number.isSafeInteger(request.reviewerUserId) ||
    request.reviewerUserId < 1 ||
    request.notes.trim().length < 20 ||
    request.notes.trim().length > 1_500
  ) {
    throw new LicensedPreviousExamImportError(
      "A decisão, a nota ou a versão exibida do dossiê é inválida.",
    );
  }

  return db.transaction(
    async (transaction) => {
      await transaction.execute(sql`set local statement_timeout = '30s'`);
      await transaction.execute(sql`set local lock_timeout = '5s'`);
      const [reviewer] = await transaction
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.id, request.reviewerUserId),
            eq(schema.users.role, "admin"),
          ),
        )
        .limit(1);
      if (!reviewer) {
        throw new LicensedPreviousExamImportError(
          "O revisor deixou de possuir autorização administrativa.",
        );
      }

      const pointer = await loadImportedBatch(transaction, request.batchPublicId);
      if (!pointer) {
        throw new LicensedPreviousExamImportError("Lote importado não encontrado.");
      }
      const pointerDocument = await loadLicensedDocumentContext(
        transaction,
        pointer.documentPublicId,
      );
      if (!pointerDocument) {
        throw new LicensedPreviousExamImportError("Documento do lote não encontrado.");
      }
      const pointerAnswerKeyDocument = await loadLicensedDocumentContext(
        transaction,
        pointer.answerKeyDocumentPublicId,
      );
      if (
        !pointerAnswerKeyDocument ||
        pointerAnswerKeyDocument.examEditionId !== pointerDocument.examEditionId ||
        pointerAnswerKeyDocument.id === pointerDocument.id
      ) {
        throw new LicensedPreviousExamImportError(
          "Gabarito oficial do lote não encontrado ou incompatível.",
        );
      }
      await transaction.execute(
        sql`select public.lock_exam_document_review_edition(${pointerDocument.examEditionId})`,
      );
      await lockExamDocumentsForShare(transaction, [
        pointerDocument.id,
        pointerAnswerKeyDocument.id,
      ]);
      const questionIds = [...new Set(pointer.questions.map((question) => question.id))]
        .sort((left, right) => left - right);
      await transaction.execute(sql`
        select ${schema.questions.id}
        from ${schema.questions}
        where ${schema.questions.id} in (${sql.join(
          questionIds.map((id) => sql`${id}`),
          sql`, `,
        )})
        order by ${schema.questions.id}
        for update
      `);

      const batch = await loadImportedBatch(transaction, request.batchPublicId);
      const document = batch
        ? await loadLicensedDocumentContext(transaction, batch.documentPublicId)
        : null;
      const answerKeyDocument = batch
        ? await loadLicensedDocumentContext(
            transaction,
            batch.answerKeyDocumentPublicId,
          )
        : null;
      if (
        !batch ||
        !document ||
        !answerKeyDocument ||
        document.id !== pointerDocument.id ||
        answerKeyDocument.id !== pointerAnswerKeyDocument.id ||
        answerKeyDocument.examEditionId !== document.examEditionId
      ) {
        throw new LicensedPreviousExamImportError(
          "O lote, o caderno ou o gabarito mudou durante a revisão.",
        );
      }
      const currentFingerprint = buildLicensedPreviousExamReviewFingerprint(
        batch.questions,
        batch.options,
        {
          documentPublicId: batch.documentPublicId,
          answerKeyDocumentPublicId: batch.answerKeyDocumentPublicId,
          licenseEvidenceVersion: batch.licenseEvidenceVersion,
          answerKeyLicenseEvidenceVersion:
            batch.answerKeyLicenseEvidenceVersion,
        },
      );
      if (currentFingerprint !== request.fingerprint) {
        throw new LicensedPreviousExamImportError(
          "O caderno mudou depois de ser exibido. Recarregue e revise o lote completo novamente.",
        );
      }

      const subjectIds = [
        ...new Set(
          batch.questions
            .map((question) => question.subjectId)
            .filter((id): id is number => id !== null),
        ),
      ];
      const compatibleSubjects = await transaction
        .select({ id: schema.quizSubjects.id, name: schema.quizSubjects.name })
        .from(schema.quizCareerSubjects)
        .innerJoin(
          schema.quizSubjects,
          eq(schema.quizCareerSubjects.subjectId, schema.quizSubjects.id),
        )
        .where(
          and(
            eq(schema.quizCareerSubjects.careerTrackId, document.careerTrackId),
            eq(schema.quizSubjects.isActive, true),
            inArray(schema.quizSubjects.id, subjectIds),
          ),
        );
      const now = new Date();
      validateLicensedPreviousExamReviewBatch({
        batch,
        document,
        answerKeyDocument,
        compatibleSubjects,
        reviewerUserId: reviewer.id,
        decision: request.decision,
        now,
      });

      const resultingStatus =
        request.decision === "approve" ? "reviewed" : "suspended";
      const updated = await transaction
        .update(schema.questions)
        .set({
          editorialStatus: resultingStatus,
          reviewedByUserId: reviewer.id,
          reviewNotes: request.notes.trim(),
          updatedAt: now,
        })
        .where(
          and(
            inArray(schema.questions.id, batch.questions.map((question) => question.id)),
            eq(schema.questions.quizMode, "previous_exam"),
            eq(schema.questions.editorialStatus, "pending_review"),
          ),
        )
        .returning({ id: schema.questions.id, publicId: schema.questions.publicId });
      if (updated.length !== batch.questions.length) {
        throw new LicensedPreviousExamImportError(
          "O lote não pôde ser decidido integralmente; nenhuma questão foi alterada.",
        );
      }

      const reviewAction =
        request.decision === "approve"
          ? "editorial.previous_exam_question.approved"
          : "editorial.previous_exam_question.rejected";
      await transaction.insert(schema.auditLogs).values([
        {
          actorUserId: reviewer.id,
          action:
            request.decision === "approve"
              ? "editorial.previous_exam_booklet.approved"
              : "editorial.previous_exam_booklet.rejected",
          entityType: "exam_edition_document",
          entityId: document.publicId,
          metadata: {
            batchPublicId: batch.batchPublicId,
            decision: request.decision,
            notes: request.notes.trim(),
            dossierFingerprint: currentFingerprint,
            reviewedQuestions: updated.length,
            examEditionDocumentId: document.id,
            examEditionAnswerKeyDocumentId: answerKeyDocument.id,
            licenseEvidenceVersion: batch.licenseEvidenceVersion,
            answerKeyLicenseEvidenceVersion:
              batch.answerKeyLicenseEvidenceVersion,
            automaticApproval: false,
          },
        },
        ...updated.map((question) => ({
          actorUserId: reviewer.id,
          action: reviewAction,
          entityType: "question",
          entityId: question.publicId,
          metadata: {
            batchPublicId: batch.batchPublicId,
            examEditionDocumentId: document.id,
            documentPublicId: document.publicId,
            examEditionAnswerKeyDocumentId: answerKeyDocument.id,
            answerKeyDocumentPublicId: answerKeyDocument.publicId,
            notes: request.notes.trim(),
            dossierFingerprint: currentFingerprint,
            resultingStatus,
          },
        })),
      ]);

      return {
        reviewedQuestions: updated.length,
        decision: request.decision,
        resultingStatus,
        automaticPublication: false as const,
      };
    },
    { isolationLevel: "serializable" },
  );
}
