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
  originalQuestionBatchReviewSchema,
  originalQuestionDraftSchema,
  validateHumanReview,
} from "@/lib/editorial/clean-room";
import {
  findMostSimilarQuestion,
  ORIGINALITY_REJECTION_THRESHOLD_BPS,
} from "@/lib/editorial/originality";

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
    draft.authorshipMethod !== "ai_assisted" ||
    !draft.generatorModel ||
    !draft.promptVersion
  ) {
    return errorState("O rascunho não possui a procedência autoral e os metadados de IA exigidos.");
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

      if (!updated[0]) throw new Error("O rascunho já foi assumido por outro editor.");

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
    return errorState(error instanceof Error ? error.message : "Não foi possível assumir o rascunho.");
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
      draft.authorshipMethod !== "ai_assisted" ||
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

        if (!updated[0]) throw new Error("O lote mudou enquanto era processado. Recarregue e tente novamente.");
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
    return errorState(error instanceof Error ? error.message : "Não foi possível assumir o lote.");
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
  const [question] = await db
    .select({
      id: questions.id,
      status: questions.editorialStatus,
      creatorUserId: questions.createdByUserId,
      cleanRoomAttestedAt: questions.cleanRoomAttestedAt,
    })
    .from(questions)
    .where(and(eq(questions.publicId, parsed.data.publicId), eq(questions.quizMode, "original_style")))
    .limit(1);

  if (!question) return errorState("Questão autoral não encontrada.");

  const review = validateHumanReview({
    status: question.status,
    creatorUserId: question.creatorUserId,
    cleanRoomAttestedAt: question.cleanRoomAttestedAt,
  });
  if (!review.allowed) return errorState(review.reason);

  const approved = parsed.data.decision === "approve";
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      const updated = await transaction
        .update(questions)
        .set({
          editorialStatus: approved ? "reviewed" : "suspended",
          reviewedByUserId: user.id,
          reviewNotes: parsed.data.notes || null,
          verifiedAt: approved ? now : undefined,
          updatedAt: now,
        })
        .where(and(eq(questions.id, question.id), eq(questions.editorialStatus, "pending_review")))
        .returning({ id: questions.id });

      if (!updated[0]) throw new Error("A questão já foi decidida por outro revisor.");

      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: approved ? "editorial.original_question.approved" : "editorial.original_question.rejected",
        entityType: "question",
        entityId: parsed.data.publicId,
        metadata: { notes: parsed.data.notes || null },
      });
    });
  } catch (error) {
    console.error("Falha ao revisar questão autoral.", error);
    return errorState(error instanceof Error ? error.message : "Não foi possível concluir a revisão.");
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
  const parsed = originalQuestionBatchReviewSchema.safeParse({
    reviewAttestation: formData.get("reviewAttestation") === "on",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Confirme a revisão humana do lote.");
  }

  const db = getDb();
  const candidateRows = await db
    .select({
      id: questions.id,
      publicId: questions.publicId,
      status: questions.editorialStatus,
      creatorUserId: questions.createdByUserId,
      cleanRoomAttestedAt: questions.cleanRoomAttestedAt,
      originalityCheckedAt: questions.originalityCheckedAt,
      similarityMaxBps: questions.similarityMaxBps,
      prompt: questions.prompt,
      type: questions.type,
      questionSourceRights: questions.sourceRights,
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
        eq(questions.editorialStatus, "pending_review"),
        isNotNull(questions.createdByUserId),
      ),
    )
    .orderBy(questions.submittedAt, questions.id)
    .limit(EDITORIAL_BATCH_LIMIT);

  if (!candidateRows.length) {
    return errorState("Não há questões pendentes elegíveis para aprovação em lote.");
  }

  const [optionRows, existingQuestions] = await Promise.all([
    db
      .select({
        questionId: questionOptions.questionId,
        total: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${questionOptions.isCorrect})::int`,
      })
      .from(questionOptions)
      .where(inArray(questionOptions.questionId, candidateRows.map((candidate) => candidate.id)))
      .groupBy(questionOptions.questionId),
    db
      .select({ publicId: questions.publicId, prompt: questions.prompt })
      .from(questions)
      .where(eq(questions.sourceRights, "original_authorial")),
  ]);
  const optionStats = new Map(
    optionRows.map((row) => [row.questionId, { total: row.total, correct: row.correct }]),
  );

  for (const candidate of candidateRows) {
    const humanReview = validateHumanReview({
      status: candidate.status,
      creatorUserId: candidate.creatorUserId,
      cleanRoomAttestedAt: candidate.cleanRoomAttestedAt,
    });
    if (!humanReview.allowed) return errorState(humanReview.reason);

    if (
      candidate.questionSourceRights !== "original_authorial" ||
      candidate.articleStatus !== "reviewed" ||
      candidate.articleSourceRights !== "official_text" ||
      candidate.versionStatus !== "current" ||
      !candidate.sourceUrl ||
      !candidate.actIsActive
    ) {
      return errorState(`A fonte oficial da questão ${candidate.publicId} precisa ser revisada.`);
    }
    if (!candidate.profileIsActive || !candidate.bankIsActive || candidate.profileFormat !== candidate.type) {
      return errorState(`O perfil editorial da questão ${candidate.publicId} não está elegível.`);
    }
    if (
      !candidate.originalityCheckedAt ||
      candidate.similarityMaxBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS
    ) {
      return errorState(`A questão ${candidate.publicId} não possui verificação de originalidade válida.`);
    }

    const expectedOptionCount = candidate.type === "true_false" ? 2 : 5;
    const stats = optionStats.get(candidate.id) ?? { total: 0, correct: 0 };
    if (stats.total !== expectedOptionCount || stats.correct !== 1) {
      return errorState(`A questão ${candidate.publicId} possui alternativas ou gabarito inválidos.`);
    }

    const similarity = findMostSimilarQuestion(
      candidate.prompt,
      existingQuestions.filter((question) => question.publicId !== candidate.publicId),
    );
    if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
      return errorState(
        `A questão ${candidate.publicId} passou a conflitar com outro item interno (${Math.round(similarity.scoreBps / 100)}%).`,
      );
    }
  }

  const now = new Date();
  const batchId = randomUUID();
  const reviewNote =
    parsed.data.notes || "Aprovação editorial em lote após revisão humana confirmada pelo revisor.";
  const candidateIds = candidateRows.map((candidate) => candidate.id);

  try {
    await db.transaction(async (transaction) => {
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
            inArray(questions.id, candidateIds),
            eq(questions.editorialStatus, "pending_review"),
            isNotNull(questions.createdByUserId),
          ),
        )
        .returning({ id: questions.id });

      if (updated.length !== candidateRows.length) {
        throw new Error("O lote mudou enquanto era processado. Recarregue e tente novamente.");
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
            notes: reviewNote,
          },
        })),
      );
    });
  } catch (error) {
    console.error("Falha ao aprovar lote autoral.", error);
    return errorState(error instanceof Error ? error.message : "Não foi possível aprovar o lote.");
  }

  revalidatePath("/admin/fabrica-autoral");
  revalidatePath("/app/questoes");
  return {
    status: "success",
    message: `${candidateRows.length} questões foram aprovadas e liberadas no catálogo.`,
  };
}
