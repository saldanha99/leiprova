"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  auditLogs,
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  questionStyleProfiles,
  quizBanks,
  quizSubjects,
  quizTopics,
} from "@/lib/db/schema";
import {
  EDITORIAL_BATCH_LIMIT,
  generatedDraftBatchClaimSchema,
  generatedDraftClaimSchema,
  isGeneratedAuthorshipMethod,
  originalQuestionDraftSchema,
  validateHumanReview,
} from "@/lib/editorial/clean-room";
import {
  findMostSimilarQuestion,
  ORIGINALITY_REJECTION_THRESHOLD_BPS,
} from "@/lib/editorial/originality";
import {
  evaluateOriginalQuestionApproval,
  matchConfirmedDossiers,
  MISSING_ATTESTATION_REASON,
  MISSING_REVIEWER_CONFIRMATION_REASON,
  parseReviewerConfirmation,
  UNEXPECTED_APPROVAL_FAILURE_REASON,
} from "@/lib/editorial/approval-eligibility";
import { buildDossierFingerprint } from "@/lib/editorial/dossier-fingerprint";
import { toQuestionDossier } from "@/lib/db/editorial-admin";
import { currentLegalSourceExists, lockApprovalScope } from "@/lib/editorial/approval-lock";



/**
 * Falha esperada e explicável ao revisor. Qualquer outro erro vira mensagem
 * genérica, para não expor SQL, nome de restrição ou estrutura interna.
 */
class ExpectedActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectedActionError";
  }
}

export type EditorialActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function errorState(message: string): EditorialActionState {
  return { status: "error", message };
}

function readOptions(formData: FormData, type: string) {
  const keys = type === "true_false" ? ["C", "E"] : ["A", "B", "C", "D", "E"];
  const correctOption = String(formData.get("correctOption") ?? "");

  return keys.map((key) => ({
    key,
    text: String(formData.get(`option_${key}`) ?? ""),
    rationale: String(formData.get(`rationale_${key}`) ?? ""),
    isCorrect: correctOption === key,
  }));
}

export async function createOriginalQuestionAction(
  _previousState: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  const user = await requireAdmin();
  const type = String(formData.get("type") ?? "");
  const parsed = originalQuestionDraftSchema.safeParse({
    styleBankId: formData.get("styleBankId"),
    legalArticleId: formData.get("legalArticleId"),
    subjectId: formData.get("subjectId"),
    topicId: formData.get("topicId"),
    type,
    learningObjective: formData.get("learningObjective"),
    prompt: formData.get("prompt"),
    explanation: formData.get("explanation"),
    difficulty: formData.get("difficulty"),
    authorshipMethod: formData.get("authorshipMethod"),
    generatorModel: formData.get("generatorModel"),
    promptVersion: formData.get("promptVersion"),
    cleanRoomAttestation: formData.get("cleanRoomAttestation") === "on",
    options: readOptions(formData, type),
  });

  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Revise os campos da questão.");
  }

  const input = parsed.data;
  const db = getDb();

  const [profile, article, topic, existingQuestions] = await Promise.all([
    db
      .select({
        bankId: quizBanks.id,
        bankSlug: quizBanks.slug,
        format: questionStyleProfiles.format,
      })
      .from(questionStyleProfiles)
      .innerJoin(quizBanks, eq(questionStyleProfiles.quizBankId, quizBanks.id))
      .where(
        and(
          eq(quizBanks.id, input.styleBankId),
          eq(quizBanks.isActive, true),
          eq(questionStyleProfiles.isActive, true),
        ),
      )
      .limit(1),
    db
      .select({
        id: legalArticles.id,
        articleRef: legalArticles.articleRef,
        actTitle: legalActs.shortTitle,
        sourceUrl: legalVersions.sourceUrl,
        sourceVerifiedAt: legalVersions.verifiedAt,
      })
      .from(legalArticles)
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(
        and(
          eq(legalArticles.id, input.legalArticleId),
          eq(legalArticles.editorialStatus, "reviewed"),
          eq(legalArticles.sourceRights, "official_text"),
          eq(legalVersions.status, "current"),
          eq(legalActs.isActive, true),
        ),
      )
      .limit(1),
    db
      .select({ id: quizTopics.id, name: quizTopics.name })
      .from(quizTopics)
      .innerJoin(quizSubjects, eq(quizTopics.subjectId, quizSubjects.id))
      .where(
        and(
          eq(quizTopics.id, input.topicId),
          eq(quizTopics.subjectId, input.subjectId),
          eq(quizTopics.isActive, true),
          eq(quizSubjects.isActive, true),
        ),
      )
      .limit(1),
    db
      .select({ publicId: questions.publicId, prompt: questions.prompt })
      .from(questions)
      .where(eq(questions.sourceRights, "original_authorial")),
  ]);

  if (!profile[0]) return errorState("Selecione um perfil editorial ativo.");
  if (!article[0]) return errorState("A fonte legal precisa estar vigente, revisada e vinculada a uma URL oficial.");
  if (!topic[0]) return errorState("O assunto selecionado não pertence à matéria informada.");
  if (profile[0].format !== input.type) {
    return errorState("O formato da questão precisa seguir o perfil editorial da banca selecionada.");
  }

  const similarity = findMostSimilarQuestion(input.prompt, existingQuestions);
  if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
    return errorState(
      `O enunciado está muito próximo de outro item interno (${Math.round(similarity.scoreBps / 100)}%). Reescreva-o de forma genuinamente nova.`,
    );
  }

  const now = new Date();
  const publicId = randomUUID();

  try {
    await db.transaction(async (transaction) => {
      const [question] = await transaction
        .insert(questions)
        .values({
          publicId,
          legalArticleId: article[0].id,
          subjectId: input.subjectId,
          topicId: input.topicId,
          quizMode: "original_style",
          styleBankId: profile[0].bankId,
          type: input.type,
          prompt: input.prompt,
          explanation: input.explanation,
          learningObjective: input.learningObjective,
          topic: topic[0].name,
          difficulty: input.difficulty,
          examBoardStyle: profile[0].bankSlug,
          editorialStatus: "pending_review",
          sourceRights: "original_authorial",
          sourceTitle: `${article[0].actTitle} — ${article[0].articleRef}`,
          sourceUrl: article[0].sourceUrl,
          authorshipMethod: input.authorshipMethod,
          generatorModel: input.authorshipMethod === "ai_assisted" ? input.generatorModel : null,
          promptVersion: input.authorshipMethod === "ai_assisted" ? input.promptVersion : null,
          createdByUserId: user.id,
          cleanRoomAttestedAt: now,
          submittedAt: now,
          similarityMaxBps: similarity.scoreBps,
          similarityReferencePublicId: similarity.referencePublicId,
          originalityCheckedAt: now,
          verifiedAt: article[0].sourceVerifiedAt,
        })
        .returning({ id: questions.id });

      await transaction.insert(questionOptions).values(
        input.options.map((option, sortOrder) => ({
          questionId: question.id,
          optionKey: option.key,
          text: option.text,
          isCorrect: option.isCorrect,
          rationale: option.rationale || null,
          sortOrder,
        })),
      );

      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: "editorial.original_question.submitted",
        entityType: "question",
        entityId: publicId,
        metadata: {
          styleBank: profile[0].bankSlug,
          legalArticleId: article[0].id,
          sourceUrl: article[0].sourceUrl,
          cleanRoomAttested: true,
          authorshipMethod: input.authorshipMethod,
          similarityMaxBps: similarity.scoreBps,
          similarityReferencePublicId: similarity.referencePublicId,
        },
      });
    });
  } catch (error) {
    console.error("Falha ao criar questão autoral.", error);
    return errorState("Não foi possível registrar a questão. Tente novamente.");
  }

  revalidatePath("/admin/fabrica-autoral");
  return {
    status: "success",
    message: "Questão enviada à revisão. Ela ainda não está publicada.",
  };
}

export async function claimGeneratedDraftAction(
  _previousState: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  const user = await requireAdmin();
  const parsed = generatedDraftClaimSchema.safeParse({
    publicId: formData.get("publicId"),
    cleanRoomAttestation: formData.get("cleanRoomAttestation") === "on",
  });

  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Revise a declaração editorial.");
  }

  const db = getDb();
  const [draftRows, optionRows, existingQuestions] = await Promise.all([
    db
      .select({
        id: questions.id,
        status: questions.editorialStatus,
        creatorUserId: questions.createdByUserId,
        prompt: questions.prompt,
        type: questions.type,
        questionSourceRights: questions.sourceRights,
        authorshipMethod: questions.authorshipMethod,
        generatorModel: questions.generatorModel,
        promptVersion: questions.promptVersion,
        articleStatus: legalArticles.editorialStatus,
        articleSourceRights: legalArticles.sourceRights,
        versionStatus: legalVersions.status,
        sourceUrl: legalVersions.sourceUrl,
        actIsActive: legalActs.isActive,
        profileFormat: questionStyleProfiles.format,
        profileIsActive: questionStyleProfiles.isActive,
        bankIsActive: quizBanks.isActive,
      })
      .from(questions)
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .innerJoin(questionStyleProfiles, eq(questions.styleBankId, questionStyleProfiles.quizBankId))
      .innerJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
      .where(
        and(
          eq(questions.publicId, parsed.data.publicId),
          eq(questions.quizMode, "original_style"),
        ),
      )
      .limit(1),
    db
      .select({
        total: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${questionOptions.isCorrect})::int`,
      })
      .from(questionOptions)
      .innerJoin(questions, eq(questionOptions.questionId, questions.id))
      .where(eq(questions.publicId, parsed.data.publicId)),
    db
      .select({ publicId: questions.publicId, prompt: questions.prompt })
      .from(questions)
      .where(
        and(
          eq(questions.sourceRights, "original_authorial"),
          ne(questions.publicId, parsed.data.publicId),
        ),
      ),
  ]);

  const draft = draftRows[0];
  if (!draft) return errorState("Rascunho autoral não encontrado.");
  if (draft.status !== "draft" || draft.creatorUserId) {
    return errorState("Este rascunho já foi assumido ou encaminhado por outra pessoa.");
  }
  if (
    draft.questionSourceRights !== "original_authorial" ||
    !isGeneratedAuthorshipMethod(draft.authorshipMethod) ||
    !draft.generatorModel ||
    !draft.promptVersion
  ) {
    return errorState("O rascunho não possui a procedência autoral e os metadados de geração exigidos.");
  }
  if (
    draft.articleStatus !== "reviewed" ||
    draft.articleSourceRights !== "official_text" ||
    draft.versionStatus !== "current" ||
    !draft.sourceUrl ||
    !draft.actIsActive
  ) {
    return errorState("A fonte legal deixou de estar vigente, oficial ou revisada.");
  }
  if (!draft.profileIsActive || !draft.bankIsActive || draft.profileFormat !== draft.type) {
    return errorState("O perfil editorial do rascunho não está ativo ou não corresponde ao formato.");
  }

  const expectedOptionCount = draft.type === "true_false" ? 2 : 5;
  const optionStats = optionRows[0] ?? { total: 0, correct: 0 };
  if (optionStats.total !== expectedOptionCount || optionStats.correct !== 1) {
    return errorState("O rascunho possui alternativas incompletas ou resposta inválida.");
  }

  const similarity = findMostSimilarQuestion(draft.prompt, existingQuestions);
  if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
    return errorState(
      `O enunciado passou a conflitar com outro item interno (${Math.round(similarity.scoreBps / 100)}%). Revise antes de enviar.`,
    );
  }

  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      const updated = await transaction
        .update(questions)
        .set({
          editorialStatus: "pending_review",
          createdByUserId: user.id,
          cleanRoomAttestedAt: now,
          submittedAt: now,
          similarityMaxBps: similarity.scoreBps,
          similarityReferencePublicId: similarity.referencePublicId,
          originalityCheckedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(questions.id, draft.id),
            eq(questions.editorialStatus, "draft"),
            isNull(questions.createdByUserId),
          ),
        )
        .returning({ id: questions.id });

      if (!updated[0]) throw new ExpectedActionError("O rascunho já foi assumido por outro editor.");

      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: "editorial.generated_draft.claimed",
        entityType: "question",
        entityId: parsed.data.publicId,
        metadata: {
          cleanRoomAttested: true,
          generatorModel: draft.generatorModel,
          promptVersion: draft.promptVersion,
          similarityMaxBps: similarity.scoreBps,
          similarityReferencePublicId: similarity.referencePublicId,
        },
      });
    });
  } catch (error) {
    console.error("Falha ao assumir rascunho autoral.", error);
    return errorState(
      error instanceof ExpectedActionError ? error.message : UNEXPECTED_APPROVAL_FAILURE_REASON,
    );
  }

  revalidatePath("/admin/fabrica-autoral");
  return {
    status: "success",
    message: "Rascunho assumido e enviado à revisão. Outra pessoa deverá decidir a publicação.",
  };
}

export async function claimGeneratedDraftBatchAction(
  _previousState: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  const user = await requireAdmin();
  const parsed = generatedDraftBatchClaimSchema.safeParse({
    cleanRoomAttestation: formData.get("cleanRoomAttestation") === "on",
  });

  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Confirme a declaração editorial do lote.");
  }

  const db = getDb();
  const draftRows = await db
    .select({
      id: questions.id,
      publicId: questions.publicId,
      status: questions.editorialStatus,
      creatorUserId: questions.createdByUserId,
      prompt: questions.prompt,
      type: questions.type,
      questionSourceRights: questions.sourceRights,
      authorshipMethod: questions.authorshipMethod,
      generatorModel: questions.generatorModel,
      promptVersion: questions.promptVersion,
      articleStatus: legalArticles.editorialStatus,
      articleSourceRights: legalArticles.sourceRights,
      versionStatus: legalVersions.status,
      sourceUrl: legalVersions.sourceUrl,
      actIsActive: legalActs.isActive,
      profileFormat: questionStyleProfiles.format,
      profileIsActive: questionStyleProfiles.isActive,
      bankIsActive: quizBanks.isActive,
    })
    .from(questions)
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .innerJoin(questionStyleProfiles, eq(questions.styleBankId, questionStyleProfiles.quizBankId))
    .innerJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
    .where(
      and(
        eq(questions.quizMode, "original_style"),
        eq(questions.editorialStatus, "draft"),
        isNull(questions.createdByUserId),
      ),
    )
    .orderBy(questions.createdAt, questions.id)
    .limit(EDITORIAL_BATCH_LIMIT);

  if (!draftRows.length) return errorState("Não há rascunhos elegíveis para assumir neste lote.");

  const [optionRows, existingQuestions] = await Promise.all([
    db
      .select({
        questionId: questionOptions.questionId,
        total: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${questionOptions.isCorrect})::int`,
      })
      .from(questionOptions)
      .where(inArray(questionOptions.questionId, draftRows.map((draft) => draft.id)))
      .groupBy(questionOptions.questionId),
    db
      .select({ publicId: questions.publicId, prompt: questions.prompt })
      .from(questions)
      .where(eq(questions.sourceRights, "original_authorial")),
  ]);

  const optionStats = new Map(
    optionRows.map((row) => [row.questionId, { total: row.total, correct: row.correct }]),
  );
  const prepared: Array<{
    id: number;
    publicId: string;
    generatorModel: string;
    promptVersion: string;
    similarityMaxBps: number;
    similarityReferencePublicId: string | null;
  }> = [];

  for (const draft of draftRows) {
    if (
      draft.status !== "draft" ||
      draft.creatorUserId ||
      draft.questionSourceRights !== "original_authorial" ||
      !isGeneratedAuthorshipMethod(draft.authorshipMethod) ||
      !draft.generatorModel ||
      !draft.promptVersion
    ) {
      return errorState(`O rascunho ${draft.publicId} não possui procedência autoral completa.`);
    }
    if (
      draft.articleStatus !== "reviewed" ||
      draft.articleSourceRights !== "official_text" ||
      draft.versionStatus !== "current" ||
      !draft.sourceUrl ||
      !draft.actIsActive
    ) {
      return errorState(`A fonte oficial do rascunho ${draft.publicId} precisa ser revisada.`);
    }
    if (!draft.profileIsActive || !draft.bankIsActive || draft.profileFormat !== draft.type) {
      return errorState(`O perfil editorial do rascunho ${draft.publicId} não está elegível.`);
    }

    const expectedOptionCount = draft.type === "true_false" ? 2 : 5;
    const stats = optionStats.get(draft.id) ?? { total: 0, correct: 0 };
    if (stats.total !== expectedOptionCount || stats.correct !== 1) {
      return errorState(`O rascunho ${draft.publicId} possui alternativas ou gabarito inválidos.`);
    }

    const similarity = findMostSimilarQuestion(
      draft.prompt,
      existingQuestions.filter((question) => question.publicId !== draft.publicId),
    );
    if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
      return errorState(
        `O rascunho ${draft.publicId} conflita com outro item interno (${Math.round(similarity.scoreBps / 100)}%).`,
      );
    }

    prepared.push({
      id: draft.id,
      publicId: draft.publicId,
      generatorModel: draft.generatorModel,
      promptVersion: draft.promptVersion,
      similarityMaxBps: similarity.scoreBps,
      similarityReferencePublicId: similarity.referencePublicId,
    });
  }

  const now = new Date();
  const batchId = randomUUID();

  try {
    await db.transaction(async (transaction) => {
      for (const draft of prepared) {
        const updated = await transaction
          .update(questions)
          .set({
            editorialStatus: "pending_review",
            createdByUserId: user.id,
            cleanRoomAttestedAt: now,
            submittedAt: now,
            similarityMaxBps: draft.similarityMaxBps,
            similarityReferencePublicId: draft.similarityReferencePublicId,
            originalityCheckedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(questions.id, draft.id),
              eq(questions.editorialStatus, "draft"),
              isNull(questions.createdByUserId),
            ),
          )
          .returning({ id: questions.id });

        if (!updated[0]) throw new ExpectedActionError("O lote mudou enquanto era processado. Recarregue e tente novamente.");
      }

      await transaction.insert(auditLogs).values(
        prepared.map((draft) => ({
          actorUserId: user.id,
          action: "editorial.generated_draft.batch_claimed",
          entityType: "question",
          entityId: draft.publicId,
          metadata: {
            batchId,
            batchSize: prepared.length,
            cleanRoomAttested: true,
            generatorModel: draft.generatorModel,
            promptVersion: draft.promptVersion,
            similarityMaxBps: draft.similarityMaxBps,
            similarityReferencePublicId: draft.similarityReferencePublicId,
          },
        })),
      );
    });
  } catch (error) {
    console.error("Falha ao assumir lote autoral.", error);
    return errorState(
      error instanceof ExpectedActionError ? error.message : UNEXPECTED_APPROVAL_FAILURE_REASON,
    );
  }

  revalidatePath("/admin/fabrica-autoral");
  return {
    status: "success",
    message: `${prepared.length} rascunhos foram assumidos e enviados à revisão humana.`,
  };
}

const reviewSchema = z.object({
  publicId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(1500),
});

export async function reviewOriginalQuestionAction(
  _previousState: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  const user = await requireAdmin();
  const parsed = reviewSchema.safeParse({
    publicId: formData.get("publicId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return errorState("Revise os dados da decisão editorial.");
  if (parsed.data.decision === "reject" && parsed.data.notes.length < 10) {
    return errorState("Explique o motivo da devolução em pelo menos 10 caracteres.");
  }

  const db = getDb();
  const approved = parsed.data.decision === "approve";
  const now = new Date();
  // Impressão do dossiê exibido. Obrigatória para aprovar: sem ela não há como
  // saber se o conteúdo aprovado é o conteúdo que o revisor leu. Reprovar não a
  // exige, para que um item defeituoso sempre possa sair da fila.
  const submittedFingerprint = String(formData.get("dossierFingerprint") ?? "").trim();
  if (approved && !submittedFingerprint) {
    return errorState(
      "Recarregue a tela antes de aprovar: a conferência precisa vir vinculada à versão exibida do dossiê.",
    );
  }

  try {
    await db.transaction(async (transaction) => {
      // Leitura, validação e gravação na mesma transação, com a linha travada:
      // antes a validação acontecia fora dela e a norma podia mudar no intervalo.
      const [target] = await transaction
        .select({
          id: questions.id,
          legalArticleId: questions.legalArticleId,
          styleBankId: questions.styleBankId,
        })
        .from(questions)
        .where(and(eq(questions.publicId, parsed.data.publicId), eq(questions.quizMode, "original_style")))
        .limit(1);

      if (!target) throw new ExpectedActionError("Questão autoral não encontrada.");

      // Trava o escopo inteiro, não só a questão: alternativas, norma, banca e
      // perfil precisam permanecer estáveis entre a validação e a gravação.
      await lockApprovalScope(transaction, {
        questionIds: [target.id],
        legalArticleIds: target.legalArticleId === null ? [] : [target.legalArticleId],
        styleBankIds: target.styleBankId === null ? [] : [target.styleBankId],
      });

      const locked = target;

      const [question] = await transaction
        .select({
          id: questions.id,
          publicId: questions.publicId,
          status: questions.editorialStatus,
          creatorUserId: questions.createdByUserId,
          cleanRoomAttestedAt: questions.cleanRoomAttestedAt,
          originalityCheckedAt: questions.originalityCheckedAt,
          similarityMaxBps: questions.similarityMaxBps,
          prompt: questions.prompt,
          explanation: questions.explanation,
          learningObjective: questions.learningObjective,
          difficulty: questions.difficulty,
          type: questions.type,
          questionSourceRights: questions.sourceRights,
          articleRef: legalArticles.articleRef,
          literalText: legalArticles.literalText,
          articleStatus: legalArticles.editorialStatus,
          articleSourceRights: legalArticles.sourceRights,
          versionStatus: legalVersions.status,
          sourceUrl: legalVersions.sourceUrl,
          sourceVerifiedAt: legalVersions.verifiedAt,
          actIsActive: legalActs.isActive,
          profileFormat: questionStyleProfiles.format,
          profileIsActive: questionStyleProfiles.isActive,
          bankIsActive: quizBanks.isActive,
        })
        .from(questions)
        .leftJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
        .leftJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
        .leftJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
        .leftJoin(questionStyleProfiles, eq(questions.styleBankId, questionStyleProfiles.quizBankId))
        .leftJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
        .where(eq(questions.id, locked.id))
        .limit(1);

      if (!question) throw new ExpectedActionError("Questão autoral não encontrada.");

      if (approved) {
        const optionRows = await transaction
          .select({
            optionKey: questionOptions.optionKey,
            text: questionOptions.text,
            isCorrect: questionOptions.isCorrect,
            rationale: questionOptions.rationale,
          })
          .from(questionOptions)
          .where(eq(questionOptions.questionId, question.id));

        const currentFingerprint = buildDossierFingerprint(toQuestionDossier(question, optionRows));
        if (currentFingerprint !== submittedFingerprint) {
          throw new ExpectedActionError(
            "A questão mudou depois da sua conferência (enunciado, alternativas, gabarito ou fonte). Revise novamente antes de aprovar.",
          );
        }

        const approval = evaluateOriginalQuestionApproval({
          ...question,
          optionTotal: optionRows.length,
          optionCorrect: optionRows.filter((option) => option.isCorrect).length,
        });
        if (!approval.allowed) throw new ExpectedActionError(approval.reason);

        const peers = await transaction
          .select({ publicId: questions.publicId, prompt: questions.prompt })
          .from(questions)
          .where(
            and(
              eq(questions.sourceRights, "original_authorial"),
              ne(questions.publicId, question.publicId),
            ),
          );
        const similarity = findMostSimilarQuestion(question.prompt, peers);
        if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
          throw new ExpectedActionError(
            `A questão ${question.publicId} passou a conflitar com outro item interno (${Math.round(similarity.scoreBps / 100)}%).`,
          );
        }
      } else {
        const review = validateHumanReview({
          status: question.status,
          creatorUserId: question.creatorUserId,
          cleanRoomAttestedAt: question.cleanRoomAttestedAt,
        });
        if (!review.allowed) throw new ExpectedActionError(review.reason);
      }

      const updated = await transaction
        .update(questions)
        .set({
          editorialStatus: approved ? "reviewed" : "suspended",
          reviewedByUserId: user.id,
          reviewNotes: parsed.data.notes || null,
          verifiedAt: approved ? now : undefined,
          updatedAt: now,
        })
        .where(
          and(
            eq(questions.id, question.id),
            eq(questions.editorialStatus, "pending_review"),
            approved ? currentLegalSourceExists() : undefined,
          ),
        )
        .returning({ id: questions.id });

      if (!updated[0]) {
        throw new ExpectedActionError(
          approved
            ? "A questão já foi decidida por outro revisor ou a fonte legal deixou de estar vigente."
            : "A questão já foi decidida por outro revisor.",
        );
      }

      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: approved ? "editorial.original_question.approved" : "editorial.original_question.rejected",
        entityType: "question",
        entityId: parsed.data.publicId,
        metadata: {
          notes: parsed.data.notes || null,
          dossierFingerprint: approved ? submittedFingerprint : null,
        },
      });
    });
  } catch (error) {
    if (!(error instanceof ExpectedActionError)) {
      console.error("Falha ao revisar questão autoral.", error);
    }
    return errorState(
      error instanceof ExpectedActionError ? error.message : UNEXPECTED_APPROVAL_FAILURE_REASON,
    );
  }

  revalidatePath("/admin/fabrica-autoral");
  revalidatePath("/app/questoes");
  return {
    status: "success",
    message: approved ? "Questão aprovada e liberada no catálogo." : "Questão reprovada e retirada da fila.",
  };
}

export async function approveOriginalQuestionBatchAction(
  _previousState: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  const user = await requireAdmin();

  // A declaração de revisão precisa ser um ato do revisor. Antes vinha em campo
  // oculto com valor fixo, o que a tornava automática.
  if (formData.get("reviewAttestation") !== "on") {
    return errorState(MISSING_ATTESTATION_REASON);
  }

  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 1500) {
    return errorState("A nota do lote deve ter no máximo 1.500 caracteres.");
  }

  const confirmation = parseReviewerConfirmation(
    formData.getAll("reviewedPublicIds"),
    formData.getAll("reviewedFingerprints"),
  );
  if (confirmation.mode !== "reviewer_confirmed") {
    return errorState(
      confirmation.mode === "invalid" ? confirmation.reason : MISSING_REVIEWER_CONFIRMATION_REASON,
    );
  }
  if (confirmation.items.length > EDITORIAL_BATCH_LIMIT) {
    return errorState(`Aprove no máximo ${EDITORIAL_BATCH_LIMIT} questões por vez.`);
  }

  const selectedPublicIds = confirmation.items.map((item) => item.publicId);
  const db = getDb();
  const now = new Date();
  const batchId = randomUUID();
  const reviewNote = notes || "Aprovação editorial após conferência item a item registrada pelo revisor.";

  try {
    const approvedCount = await db.transaction(async (transaction) => {
      // Identifica o escopo antes de travar: além da questão, é preciso travar
      // alternativas, norma, banca e perfil. A linha da questão não cobre nada
      // disso, e sem isso a conferência pode ser invalidada por uma transação
      // concorrente entre a validação e a gravação.
      const targetRows = await transaction
        .select({
          id: questions.id,
          publicId: questions.publicId,
          legalArticleId: questions.legalArticleId,
          styleBankId: questions.styleBankId,
        })
        .from(questions)
        .where(
          and(
            inArray(questions.publicId, selectedPublicIds),
            eq(questions.quizMode, "original_style"),
            eq(questions.editorialStatus, "pending_review"),
            isNotNull(questions.createdByUserId),
          ),
        );

      if (targetRows.length !== selectedPublicIds.length) {
        throw new ExpectedActionError(
          "Alguma questão selecionada deixou de estar pendente. Recarregue a tela e revise novamente.",
        );
      }

      const lockedIds = targetRows.map((row) => row.id);

      await lockApprovalScope(transaction, {
        questionIds: lockedIds,
        legalArticleIds: targetRows
          .map((row) => row.legalArticleId)
          .filter((value): value is number => value !== null),
        styleBankIds: targetRows
          .map((row) => row.styleBankId)
          .filter((value): value is number => value !== null),
      });

      // Reconfere o estado depois do travamento: entre a identificação do
      // escopo e o lock, outra transação pode ter decidido a questão.
      const stillPending = await transaction
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            inArray(questions.id, lockedIds),
            eq(questions.editorialStatus, "pending_review"),
            isNotNull(questions.createdByUserId),
          ),
        );
      if (stillPending.length !== lockedIds.length) {
        throw new ExpectedActionError(
          "Alguma questão selecionada deixou de estar pendente. Recarregue a tela e revise novamente.",
        );
      }

      const candidateRows = await transaction
        .select({
          id: questions.id,
          publicId: questions.publicId,
          status: questions.editorialStatus,
          creatorUserId: questions.createdByUserId,
          cleanRoomAttestedAt: questions.cleanRoomAttestedAt,
          originalityCheckedAt: questions.originalityCheckedAt,
          similarityMaxBps: questions.similarityMaxBps,
          prompt: questions.prompt,
          explanation: questions.explanation,
          learningObjective: questions.learningObjective,
          difficulty: questions.difficulty,
          type: questions.type,
          questionSourceRights: questions.sourceRights,
          articleRef: legalArticles.articleRef,
          literalText: legalArticles.literalText,
          articleStatus: legalArticles.editorialStatus,
          articleSourceRights: legalArticles.sourceRights,
          versionStatus: legalVersions.status,
          sourceUrl: legalVersions.sourceUrl,
          sourceVerifiedAt: legalVersions.verifiedAt,
          actIsActive: legalActs.isActive,
          profileFormat: questionStyleProfiles.format,
          profileIsActive: questionStyleProfiles.isActive,
          bankIsActive: quizBanks.isActive,
        })
        .from(questions)
        .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
        .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
        .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
        .innerJoin(questionStyleProfiles, eq(questions.styleBankId, questionStyleProfiles.quizBankId))
        .innerJoin(quizBanks, eq(questions.styleBankId, quizBanks.id))
        .where(inArray(questions.id, lockedIds));

      if (candidateRows.length !== lockedIds.length) {
        throw new ExpectedActionError(
          "Alguma questão selecionada perdeu o vínculo com a fonte oficial ou com o perfil editorial.",
        );
      }

      const optionRows = await transaction
        .select({
          questionId: questionOptions.questionId,
          optionKey: questionOptions.optionKey,
          text: questionOptions.text,
          isCorrect: questionOptions.isCorrect,
          rationale: questionOptions.rationale,
        })
        .from(questionOptions)
        .where(inArray(questionOptions.questionId, lockedIds));

      const optionsByQuestion = new Map<number, typeof optionRows>();
      for (const option of optionRows) {
        const current = optionsByQuestion.get(option.questionId) ?? [];
        current.push(option);
        optionsByQuestion.set(option.questionId, current);
      }

      // Impressão recalculada agora, sob a mesma transação que fará o UPDATE.
      const currentFingerprints = new Map<string, string>();
      for (const candidate of candidateRows) {
        const options = optionsByQuestion.get(candidate.id) ?? [];
        currentFingerprints.set(
          candidate.publicId,
          buildDossierFingerprint(toQuestionDossier(candidate, options)),
        );
      }

      const dossierMatch = matchConfirmedDossiers(confirmation, currentFingerprints);
      if (!dossierMatch.allowed) throw new ExpectedActionError(dossierMatch.reason);

      const peers = await transaction
        .select({ publicId: questions.publicId, prompt: questions.prompt })
        .from(questions)
        .where(eq(questions.sourceRights, "original_authorial"));

      for (const candidate of candidateRows) {
        const options = optionsByQuestion.get(candidate.id) ?? [];
        const approval = evaluateOriginalQuestionApproval({
          ...candidate,
          optionTotal: options.length,
          optionCorrect: options.filter((option) => option.isCorrect).length,
        });
        if (!approval.allowed) throw new ExpectedActionError(approval.reason);

        const similarity = findMostSimilarQuestion(
          candidate.prompt,
          peers.filter((peer) => peer.publicId !== candidate.publicId),
        );
        if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
          throw new ExpectedActionError(
            `A questão ${candidate.publicId} passou a conflitar com outro item interno (${Math.round(similarity.scoreBps / 100)}%).`,
          );
        }
      }

      const updated = await transaction
        .update(questions)
        .set({
          editorialStatus: "reviewed",
          reviewedByUserId: user.id,
          reviewNotes: reviewNote,
          verifiedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            inArray(questions.id, lockedIds),
            eq(questions.editorialStatus, "pending_review"),
            currentLegalSourceExists(),
          ),
        )
        .returning({ id: questions.id });

      if (updated.length !== lockedIds.length) {
        throw new ExpectedActionError(
          "O lote mudou enquanto era processado. Recarregue a tela e revise novamente.",
        );
      }

      await transaction.insert(auditLogs).values(
        candidateRows.map((candidate) => ({
          actorUserId: user.id,
          action: "editorial.original_question.batch_approved",
          entityType: "question",
          entityId: candidate.publicId,
          metadata: {
            batchId,
            batchSize: candidateRows.length,
            reviewAttested: true,
            itemBindingMode: "reviewer_confirmed_dossier",
            dossierFingerprint: currentFingerprints.get(candidate.publicId) ?? null,
            notes: reviewNote,
          },
        })),
      );

      return updated.length;
    });

    revalidatePath("/admin/fabrica-autoral");
    revalidatePath("/app/questoes");
    return {
      status: "success",
      message: `${approvedCount} ${approvedCount === 1 ? "questão conferida foi aprovada e liberada" : "questões conferidas foram aprovadas e liberadas"} no catálogo.`,
    };
  } catch (error) {
    if (error instanceof ExpectedActionError) return errorState(error.message);
    console.error("Falha ao aprovar lote autoral.", error);
    return errorState(UNEXPECTED_APPROVAL_FAILURE_REASON);
  }
}
