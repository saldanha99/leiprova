"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
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
  originalQuestionDraftSchema,
  validateIndependentReview,
} from "@/lib/editorial/clean-room";

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

  const [profile, article, topic] = await Promise.all([
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
  ]);

  if (!profile[0]) return errorState("Selecione um perfil editorial ativo.");
  if (!article[0]) return errorState("A fonte legal precisa estar vigente, revisada e vinculada a uma URL oficial.");
  if (!topic[0]) return errorState("O assunto selecionado não pertence à matéria informada.");
  if (profile[0].format !== input.type) {
    return errorState("O formato da questão precisa seguir o perfil editorial da banca selecionada.");
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

  const review = validateIndependentReview({
    status: question.status,
    creatorUserId: question.creatorUserId,
    reviewerUserId: user.id,
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
