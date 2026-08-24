import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionNotebookItems,
  questionNotebooks,
  questions,
  savedStudyFilters,
  userAttempts,
} from "@/lib/db/schema";
import {
  FREE_STUDY_QUESTION_IDS,
  type StudyEntitlement,
} from "@/lib/study/access-policy";

function questionAccessCondition(entitlement: StudyEntitlement) {
  return entitlement.hasFullAccess
    ? undefined
    : inArray(questions.publicId, [...FREE_STUDY_QUESTION_IDS]);
}

export async function getLegalActStudyView(
  userId: number,
  slug: string,
  entitlement: StudyEntitlement,
) {
  const db = getDb();
  const [act] = await db
    .select({
      id: legalActs.id,
      slug: legalActs.slug,
      title: legalActs.title,
      shortTitle: legalActs.shortTitle,
      jurisdiction: legalActs.jurisdiction,
      officialUrl: legalActs.officialUrl,
      versionId: legalVersions.id,
      verifiedAt: legalVersions.verifiedAt,
    })
    .from(legalActs)
    .innerJoin(legalVersions, eq(legalVersions.legalActId, legalActs.id))
    .where(
      and(
        eq(legalActs.slug, slug),
        eq(legalActs.isActive, true),
        eq(legalVersions.status, "current"),
      ),
    )
    .orderBy(desc(legalVersions.verifiedAt))
    .limit(1);

  if (!act) return null;

  const accessCondition = questionAccessCondition(entitlement);
  const articles = await db
    .select({
      id: legalArticles.id,
      articleRef: legalArticles.articleRef,
      articleOrder: legalArticles.articleOrder,
      heading: legalArticles.heading,
      path: legalArticles.path,
      literalText: legalArticles.literalText,
      questionCount: sql<number>`count(distinct ${questions.id})::int`,
      attemptCount: sql<number>`count(${userAttempts.id})::int`,
      correctCount: sql<number>`count(${userAttempts.id}) filter (where ${userAttempts.isCorrect})::int`,
      lastAnsweredAt: sql<Date | null>`max(${userAttempts.answeredAt})`,
    })
    .from(legalArticles)
    .leftJoin(
      questions,
      and(
        eq(questions.legalArticleId, legalArticles.id),
        eq(questions.editorialStatus, "reviewed"),
        accessCondition,
      ),
    )
    .leftJoin(
      userAttempts,
      and(eq(userAttempts.questionId, questions.id), eq(userAttempts.userId, userId)),
    )
    .where(
      and(
        eq(legalArticles.legalVersionId, act.versionId),
        eq(legalArticles.editorialStatus, "reviewed"),
      ),
    )
    .groupBy(legalArticles.id)
    .orderBy(asc(legalArticles.articleOrder));

  return {
    ...act,
    articles: articles.map((article) => ({
      ...article,
      accuracy:
        article.attemptCount > 0
          ? Math.round((article.correctCount / article.attemptCount) * 100)
          : null,
    })),
  };
}

export async function listSavedStudyFilters(userId: number, legalActId?: number) {
  return getDb()
    .select({
      id: savedStudyFilters.id,
      name: savedStudyFilters.name,
      articleStartOrder: savedStudyFilters.articleStartOrder,
      articleEndOrder: savedStudyFilters.articleEndOrder,
      legalActSlug: legalActs.slug,
      legalActTitle: legalActs.shortTitle,
      updatedAt: savedStudyFilters.updatedAt,
    })
    .from(savedStudyFilters)
    .innerJoin(legalActs, eq(savedStudyFilters.legalActId, legalActs.id))
    .where(
      and(
        eq(savedStudyFilters.userId, userId),
        legalActId ? eq(savedStudyFilters.legalActId, legalActId) : undefined,
      ),
    )
    .orderBy(desc(savedStudyFilters.updatedAt), asc(savedStudyFilters.name));
}

export async function listQuestionNotebooks(userId: number) {
  return getDb()
    .select({
      id: questionNotebooks.id,
      publicId: questionNotebooks.publicId,
      name: questionNotebooks.name,
      description: questionNotebooks.description,
      questionCount: sql<number>`count(${questionNotebookItems.questionId})::int`,
      updatedAt: questionNotebooks.updatedAt,
    })
    .from(questionNotebooks)
    .leftJoin(questionNotebookItems, eq(questionNotebookItems.notebookId, questionNotebooks.id))
    .where(eq(questionNotebooks.userId, userId))
    .groupBy(questionNotebooks.id)
    .orderBy(desc(questionNotebooks.updatedAt), asc(questionNotebooks.name));
}

export async function getQuestionNotebook(
  userId: number,
  publicId: string,
  entitlement: StudyEntitlement,
) {
  const db = getDb();
  const [notebook] = await db
    .select({
      id: questionNotebooks.id,
      publicId: questionNotebooks.publicId,
      name: questionNotebooks.name,
      description: questionNotebooks.description,
      updatedAt: questionNotebooks.updatedAt,
    })
    .from(questionNotebooks)
    .where(and(eq(questionNotebooks.userId, userId), eq(questionNotebooks.publicId, publicId)))
    .limit(1);

  if (!notebook) return null;

  const accessCondition = questionAccessCondition(entitlement);
  const items = await db
    .select({
      questionPublicId: questions.publicId,
      prompt: questions.prompt,
      topic: questions.topic,
      difficulty: questions.difficulty,
      articleRef: legalArticles.articleRef,
      actTitle: legalActs.shortTitle,
      addedAt: questionNotebookItems.createdAt,
    })
    .from(questionNotebookItems)
    .innerJoin(questions, eq(questionNotebookItems.questionId, questions.id))
    .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
    .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
    .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
    .where(
      and(
        eq(questionNotebookItems.notebookId, notebook.id),
        eq(questions.editorialStatus, "reviewed"),
        eq(legalArticles.editorialStatus, "reviewed"),
        eq(legalVersions.status, "current"),
        eq(legalActs.isActive, true),
        accessCondition,
      ),
    )
    .orderBy(asc(legalArticles.articleOrder), asc(questionNotebookItems.createdAt));

  return { ...notebook, items };
}

export type LegalActStudyView = NonNullable<Awaited<ReturnType<typeof getLegalActStudyView>>>;
export type QuestionNotebookSummary = Awaited<ReturnType<typeof listQuestionNotebooks>>[number];
