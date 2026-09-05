import { and, eq, isNull, ne } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";
import {
  auditLogs,
  contestOpportunities,
  legalActs,
  legalArticles,
  legalVersions,
  opportunityOrganizerAssignments,
  opportunityDocumentSnapshots,
  opportunityRequirements,
  opportunitySourceDocuments,
  questionOpportunities,
  questionOptions,
  questions,
  questionStyleProfiles,
  quizBanks,
  quizSubjects,
  quizTopics,
} from "@/lib/db/schema";
import {
  buildNoticeQuestionDraft,
  deterministicNoticeQuestionUuid,
  NOTICE_QUESTION_GENERATOR_VERSION,
} from "@/lib/editorial/notice-question-generator";
import {
  findMostSimilarQuestion,
  ORIGINALITY_REJECTION_THRESHOLD_BPS,
} from "@/lib/editorial/originality";

export class NoticeDraftGenerationError extends Error {}

export async function generateNoticeQuestionDraftForRequirement(
  db: PostgresJsDatabase<typeof schema>,
  requirementId: number,
  actorUserId: number,
) {
  const [requirementRows, assignmentRows] = await Promise.all([
    db
      .select({
        id: opportunityRequirements.id,
        status: opportunityRequirements.editorialStatus,
        requirementText: opportunityRequirements.requirementText,
        sourceLocator: opportunityRequirements.sourceLocator,
        opportunityId: opportunityRequirements.opportunityId,
        opportunityPublicId: contestOpportunities.publicId,
        opportunityStatus: contestOpportunities.editorialStatus,
        sourceStatus: opportunitySourceDocuments.status,
        sourceSnapshotId: opportunityRequirements.sourceSnapshotId,
        snapshotStatus: opportunityDocumentSnapshots.status,
        subjectId: opportunityRequirements.subjectId,
        topicId: opportunityRequirements.topicId,
        topicName: quizTopics.name,
        legalArticleId: opportunityRequirements.legalArticleId,
        articleRef: legalArticles.articleRef,
        literalText: legalArticles.literalText,
        articleStatus: legalArticles.editorialStatus,
        articleRights: legalArticles.sourceRights,
        actTitle: legalActs.shortTitle,
        actIsActive: legalActs.isActive,
        versionStatus: legalVersions.status,
        sourceUrl: legalVersions.sourceUrl,
        verifiedAt: legalVersions.verifiedAt,
      })
      .from(opportunityRequirements)
      .innerJoin(
        contestOpportunities,
        eq(opportunityRequirements.opportunityId, contestOpportunities.id),
      )
      .innerJoin(
        opportunitySourceDocuments,
        eq(opportunityRequirements.sourceDocumentId, opportunitySourceDocuments.id),
      )
      .innerJoin(quizSubjects, eq(opportunityRequirements.subjectId, quizSubjects.id))
      .leftJoin(opportunityDocumentSnapshots, eq(opportunityRequirements.sourceSnapshotId, opportunityDocumentSnapshots.id))
      .innerJoin(quizTopics, eq(opportunityRequirements.topicId, quizTopics.id))
      .innerJoin(legalArticles, eq(opportunityRequirements.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(eq(opportunityRequirements.id, requirementId))
      .limit(1),
    db
      .select({
        opportunityId: opportunityOrganizerAssignments.opportunityId,
        role: opportunityOrganizerAssignments.role,
        bankId: quizBanks.id,
        bankSlug: quizBanks.slug,
        format: questionStyleProfiles.format,
      })
      .from(opportunityOrganizerAssignments)
      .innerJoin(quizBanks, eq(opportunityOrganizerAssignments.quizBankId, quizBanks.id))
      .innerJoin(
        questionStyleProfiles,
        eq(opportunityOrganizerAssignments.quizBankId, questionStyleProfiles.quizBankId),
      )
      .where(
        and(
          eq(opportunityOrganizerAssignments.status, "reviewed"),
          eq(opportunityOrganizerAssignments.opportunityId,
            db.select({ id: opportunityRequirements.opportunityId })
              .from(opportunityRequirements).where(eq(opportunityRequirements.id, requirementId))),
          isNull(opportunityOrganizerAssignments.validUntil),
          eq(quizBanks.isActive, true),
          eq(questionStyleProfiles.isActive, true),
        ),
      ),
  ]);

  const requirement = requirementRows[0];
  if (!requirement || requirement.status !== "reviewed") {
    throw new NoticeDraftGenerationError("O requisito precisa estar revisado antes da geração.");
  }
  if (
    requirement.sourceStatus !== "approved" ||
    requirement.opportunityStatus !== "reviewed" ||
    (requirement.sourceSnapshotId !== null && requirement.snapshotStatus !== "approved")
  ) {
    throw new NoticeDraftGenerationError(
      "O concurso e sua fonte oficial precisam estar aprovados.",
    );
  }
  if (
    !requirement.subjectId ||
    !requirement.topicId ||
    !requirement.legalArticleId ||
    requirement.articleStatus !== "reviewed" ||
    requirement.articleRights !== "official_text" ||
    requirement.versionStatus !== "current" ||
    !requirement.actIsActive
  ) {
    throw new NoticeDraftGenerationError(
      "O requisito perdeu o vínculo com uma norma oficial vigente e revisada.",
    );
  }

  const candidates = assignmentRows.filter(
    (assignment) => assignment.opportunityId === requirement.opportunityId,
  );
  const assignment =
    candidates.find((candidate) => candidate.role === "examination_provider") ??
    candidates[0];
  if (!assignment) {
    throw new NoticeDraftGenerationError(
      "Vincule e revise a banca organizadora antes de gerar a questão.",
    );
  }
  if (assignment.format !== "multiple_choice" && assignment.format !== "true_false") {
    throw new NoticeDraftGenerationError(
      "O perfil editorial da banca possui um formato incompatível.",
    );
  }

  // Identidade vem antes da similaridade: repetir não pode rejeitar o próprio rascunho.
  const publicId = deterministicNoticeQuestionUuid(
    [
      NOTICE_QUESTION_GENERATOR_VERSION,
      requirement.id,
      requirement.requirementText,
      requirement.literalText,
      assignment.bankId,
    ].join("|"),
  );
  const [existing] = await db.select({ publicId: questions.publicId }).from(questions)
    .where(eq(questions.publicId, publicId)).limit(1);
  if (existing) return { created: false, publicId };

  let generated: ReturnType<typeof buildNoticeQuestionDraft>;
  try {
    generated = buildNoticeQuestionDraft({
      bankSlug: assignment.bankSlug,
      format: assignment.format,
      requirementText: requirement.requirementText,
      sourceLocator: requirement.sourceLocator,
      topicName: requirement.topicName,
      actTitle: requirement.actTitle,
      articleRef: requirement.articleRef,
      literalText: requirement.literalText,
    });
  } catch (error) {
    throw new NoticeDraftGenerationError(
      error instanceof Error ? error.message : "A geração segura falhou.",
    );
  }

  const existingQuestions = await db
    .select({ publicId: questions.publicId, prompt: questions.prompt })
    .from(questions)
    .where(and(eq(questions.sourceRights, "original_authorial"), ne(questions.publicId, publicId)));
  const similarity = findMostSimilarQuestion(generated.prompt, existingQuestions);
  if (similarity.scoreBps >= ORIGINALITY_REJECTION_THRESHOLD_BPS) {
    throw new NoticeDraftGenerationError(
      `O enunciado ficou muito próximo de outro item interno (${Math.round(similarity.scoreBps / 100)}%).`,
    );
  }

  const now = new Date();
  const created = await db.transaction(async (transaction) => {
    const [question] = await transaction
      .insert(questions)
      .values({
        publicId,
        legalArticleId: requirement.legalArticleId,
        subjectId: requirement.subjectId,
        topicId: requirement.topicId,
        quizMode: "original_style",
        styleBankId: assignment.bankId,
        type: generated.type,
        prompt: generated.prompt,
        explanation: generated.explanation,
        learningObjective: generated.learningObjective,
        topic: requirement.topicName,
        difficulty: generated.difficulty,
        mutationKind: generated.mutationKind,
        examBoardStyle: assignment.bankSlug,
        editorialStatus: "draft",
        sourceRights: "original_authorial",
        sourceTitle: `${requirement.actTitle} — ${requirement.articleRef}`,
        sourceUrl: requirement.sourceUrl,
        authorshipMethod: "rule_based",
        generatorModel: "leiprova-rule-engine",
        promptVersion: NOTICE_QUESTION_GENERATOR_VERSION,
        createdByUserId: null,
        cleanRoomAttestedAt: null,
        submittedAt: null,
        similarityMaxBps: similarity.scoreBps,
        similarityReferencePublicId: similarity.referencePublicId,
        originalityCheckedAt: now,
        verifiedAt: requirement.verifiedAt,
      })
      .onConflictDoNothing({ target: questions.publicId })
      .returning({ id: questions.id });
    if (!question) return false;

    await transaction.insert(questionOptions).values(
      generated.options.map((option, sortOrder) => ({
        questionId: question.id,
        optionKey: option.key,
        text: option.text,
        isCorrect: option.isCorrect,
        mutationKind: option.mutationKind,
        rationale: option.rationale,
        sortOrder,
      })),
    );
    await transaction.insert(questionOpportunities).values({
      questionId: question.id,
      opportunityId: requirement.opportunityId,
      relationship: "direct_requirement",
    });
    await transaction.insert(auditLogs).values({
      actorUserId,
      action: "editorial.notice_question.generated",
      entityType: "question",
      entityId: publicId,
      metadata: {
        requirementId: requirement.id,
        opportunityPublicId: requirement.opportunityPublicId,
        generator: NOTICE_QUESTION_GENERATOR_VERSION,
        bankSlug: assignment.bankSlug,
        sourceUrl: requirement.sourceUrl,
        similarityMaxBps: similarity.scoreBps,
      },
    });
    return true;
  });

  return { created, publicId };
}
