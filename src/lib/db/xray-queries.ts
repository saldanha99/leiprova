import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  userAttempts,
} from "@/lib/db/schema";

const mutationKindExpression = sql<string>`coalesce(
  ${questionOptions.mutationKind},
  ${questions.mutationKind},
  'unclassified'
)`;

const answeredExpression = sql<number>`count(*)::int`;
const correctExpression = sql<number>`count(*) filter (where ${userAttempts.isCorrect})::int`;
const incorrectExpression = sql<number>`count(*) filter (where not ${userAttempts.isCorrect})::int`;

function accuracy(correct: number, answered: number) {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0;
}

export async function getUserXRay(userId: number) {
  const db = getDb();

  const [mutationRows, articleRows, summaryRows] = await Promise.all([
    db
      .select({
        mutationKind: mutationKindExpression,
        answered: answeredExpression,
        correct: correctExpression,
        incorrect: incorrectExpression,
      })
      .from(userAttempts)
      .innerJoin(questions, eq(userAttempts.questionId, questions.id))
      .leftJoin(questionOptions, eq(userAttempts.selectedOptionId, questionOptions.id))
      .where(eq(userAttempts.userId, userId))
      .groupBy(mutationKindExpression)
      .orderBy(desc(incorrectExpression), desc(answeredExpression), asc(mutationKindExpression)),
    db
      .select({
        articleId: legalArticles.id,
        articleRef: legalArticles.articleRef,
        articleOrder: legalArticles.articleOrder,
        legalAct: legalActs.shortTitle,
        legalActSlug: legalActs.slug,
        topic: sql<string>`min(${questions.topic})`,
        answered: answeredExpression,
        correct: correctExpression,
        incorrect: incorrectExpression,
        lastAnsweredAt: sql<Date>`max(${userAttempts.answeredAt})`,
      })
      .from(userAttempts)
      .innerJoin(questions, eq(userAttempts.questionId, questions.id))
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(eq(userAttempts.userId, userId))
      .groupBy(
        legalArticles.id,
        legalArticles.articleRef,
        legalArticles.articleOrder,
        legalActs.shortTitle,
        legalActs.slug,
      )
      .orderBy(desc(incorrectExpression), desc(answeredExpression), asc(legalArticles.articleOrder)),
    db
      .select({
        answered: answeredExpression,
        correct: correctExpression,
      })
      .from(userAttempts)
      .where(eq(userAttempts.userId, userId)),
  ]);

  const byMutation = mutationRows;
  const byArticle = articleRows.map((row) => ({
    ...row,
    accuracy: accuracy(row.correct, row.answered),
  }));
  const answered = summaryRows[0]?.answered ?? 0;
  const correct = summaryRows[0]?.correct ?? 0;

  return {
    answered,
    correct,
    incorrect: answered - correct,
    accuracy: accuracy(correct, answered),
    articlesStudied: byArticle.length,
    byMutation,
    byArticle,
  };
}
