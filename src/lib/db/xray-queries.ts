import "server-only";

import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

import { approvedHistoricalPreviousExamQuestionExists } from "@/lib/commerce/previous-exam-content";
import { getDb } from "@/lib/db/client";
import {
  examEditions,
  legalActs,
  legalArticles,
  legalVersions,
  questionOptions,
  questions,
  quizBanks,
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

/**
 * Frequência editorial por banca. Só entram questões de provas anteriores cuja
 * cadeia comercial completa continua liberada e licenciada no momento da
 * leitura. Um rascunho, link público ou item autoral nunca aumenta a amostra.
 */
export async function getBankArticleXRay(bankSlug: string, limit = 100) {
  const eligible = and(
    eq(quizBanks.slug, bankSlug),
    eq(quizBanks.isActive, true),
    eq(questions.quizMode, "previous_exam"),
    eq(questions.editorialStatus, "reviewed"),
    eq(questions.sourceRights, "licensed"),
    isNotNull(questions.legalArticleId),
    sql`${examEditions.examDate} >= ((current_timestamp at time zone 'America/Sao_Paulo')::date - interval '10 years')::date`,
    approvedHistoricalPreviousExamQuestionExists(questions.id),
  );
  const db = getDb();
  const [rows, summaryRows] = await Promise.all([
    db
      .select({
        articleId: legalArticles.id,
        articleRef: legalArticles.articleRef,
        articleOrder: legalArticles.articleOrder,
        legalAct: legalActs.shortTitle,
        legalActSlug: legalActs.slug,
        questionCount: sql<number>`count(distinct ${questions.id})::int`,
        editionCount: sql<number>`count(distinct ${examEditions.id})::int`,
        lastExamDate: sql<string>`max(${examEditions.examDate})::text`,
      })
      .from(questions)
      .innerJoin(examEditions, eq(questions.examEditionId, examEditions.id))
      .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .innerJoin(legalVersions, eq(legalArticles.legalVersionId, legalVersions.id))
      .innerJoin(legalActs, eq(legalVersions.legalActId, legalActs.id))
      .where(eligible)
      .groupBy(legalArticles.id, legalActs.id)
      .orderBy(
        desc(sql`count(distinct ${questions.id})`),
        asc(legalActs.shortTitle),
        asc(legalArticles.articleOrder),
      )
      .limit(Math.max(1, Math.min(100, limit))),
    db
      .select({
        questionCount: sql<number>`count(distinct ${questions.id})::int`,
        editionCount: sql<number>`count(distinct ${examEditions.id})::int`,
      })
      .from(questions)
      .innerJoin(examEditions, eq(questions.examEditionId, examEditions.id))
      .innerJoin(quizBanks, eq(examEditions.bankId, quizBanks.id))
      .innerJoin(legalArticles, eq(questions.legalArticleId, legalArticles.id))
      .where(eligible),
  ]);
  const questionCount = summaryRows[0]?.questionCount ?? 0;
  const editionCount = summaryRows[0]?.editionCount ?? 0;

  return {
    bankSlug,
    questionCount,
    editionCount,
    articles: rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      sharePercent: questionCount
        ? Math.round((row.questionCount / questionCount) * 10_000) / 100
        : 0,
    })),
  };
}
