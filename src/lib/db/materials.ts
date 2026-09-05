import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questions,
  userAttempts,
} from "@/lib/db/schema";
import {
  accessibleQuestionIds,
  type StudyEntitlement,
} from "@/lib/study/access-policy";

const publishedQuestionConditions = [
  eq(questions.editorialStatus, "reviewed"),
  eq(legalArticles.editorialStatus, "reviewed"),
  eq(legalVersions.status, "current"),
  eq(legalActs.isActive, true),
] as const;

function accessCondition(entitlement: StudyEntitlement) {
  return entitlement.hasFullAccess
    ? undefined
    : inArray(questions.publicId, accessibleQuestionIds(entitlement));
}

export async function getMaterialsSnapshot(
  userId: number,
  entitlement: StudyEntitlement,
) {
  const db = getDb();
  const allowedQuestions = accessCondition(entitlement);

  const latestWrongAttempt = db
    .selectDistinctOn([userAttempts.questionId], {
      questionId: userAttempts.questionId,
      answeredAt: userAttempts.answeredAt,
    })
    .from(userAttempts)
    .where(
      and(eq(userAttempts.userId, userId), eq(userAttempts.isCorrect, false)),
    )
    .orderBy(userAttempts.questionId, desc(userAttempts.answeredAt))
    .as("latest_wrong_attempt");

  const [recentErrors, flashcards, notebooks] = await Promise.all([
    db
      .select({
        publicId: questions.publicId,
        prompt: questions.prompt,
        topic: questions.topic,
        articleRef: legalArticles.articleRef,
        actTitle: legalActs.shortTitle,
        answeredAt: latestWrongAttempt.answeredAt,
      })
      .from(latestWrongAttempt)
      .innerJoin(questions, eq(latestWrongAttempt.questionId, questions.id))
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(
        legalVersions,
        eq(legalArticles.legalVersionId, legalVersions.id),
      )
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(and(...publishedQuestionConditions, allowedQuestions))
      .orderBy(desc(latestWrongAttempt.answeredAt), asc(questions.id))
      .limit(6),
    db
      .selectDistinctOn([legalArticles.id], {
        id: legalArticles.id,
        topic: questions.topic,
        articleRef: legalArticles.articleRef,
        literalText: legalArticles.literalText,
        actTitle: legalActs.shortTitle,
        officialUrl: legalActs.officialUrl,
        verifiedAt: legalVersions.verifiedAt,
      })
      .from(questions)
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(
        legalVersions,
        eq(legalArticles.legalVersionId, legalVersions.id),
      )
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(and(...publishedQuestionConditions, allowedQuestions))
      .orderBy(legalArticles.id, asc(questions.id))
      .limit(12),
    db
      .select({
        topic: questions.topic,
        questionCount: sql<number>`count(distinct ${questions.id})::int`,
        articleCount: sql<number>`count(distinct ${legalArticles.id})::int`,
      })
      .from(questions)
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(
        legalVersions,
        eq(legalArticles.legalVersionId, legalVersions.id),
      )
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(and(...publishedQuestionConditions, allowedQuestions))
      .groupBy(questions.topic)
      .orderBy(asc(questions.topic)),
  ]);

  return { recentErrors, flashcards, notebooks };
}

export type MaterialsSnapshot = Awaited<
  ReturnType<typeof getMaterialsSnapshot>
>;
